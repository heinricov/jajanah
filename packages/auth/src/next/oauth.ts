import { randomBytes, timingSafeEqual } from 'node:crypto';

import { getEnv } from '@packages/environment';
import { OAuth2Client } from 'google-auth-library';
import { cookies } from 'next/headers';

import { authService } from '../domain/auth.service';
import { AuthError } from '../domain/errors';
import { setSessionCookie } from './server/cookie';

/**
 * Gateway OAuth Google — dipanggil **route handler** `apps/web`
 * (`/api/auth/google` + `/callback`).
 *
 * Kenapa route handler, bukan server action? OAuth2 butuh `redirect_uri` GET
 * yang mengikat origin/URL — server action tidak punya endpoint GET yang bisa
 * didaftarkan di Google Console. Ini satu-satunya pengecualian arsitektur
 * "tanpa route `/api/auth/*`" (dokumentasi: README package ini).
 *
 * State + tujuan redirect disimpan di cookie httpOnly `tj_oauth_state`
 * (sekali pakai, 10 menit) dan diverifikasi dengan `timingSafeEqual` —
 * mitigasi CSRF/open-redirect.
 */

export const GOOGLE_OAUTH_STATE_COOKIE = 'tj_oauth_state';

const GOOGLE_OAUTH_STATE_MAX_AGE = 600;
const GOOGLE_OAUTH_SCOPES = ['openid', 'email', 'profile'];
const GOOGLE_OAUTH_CALLBACK_PATH = '/api/auth/google/callback';

export type GoogleOAuthError =
  /** Kegagalan umum (state tidak cocok, token ditolak Google, dsb). */
  | 'oauth'
  /** `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` belum di-set di `.env`. */
  | 'oauth_config'
  /** `(provider, providerId)` sudah tertaut ke akun lain. */
  | 'oauth_account_linked'
  /** `email_verified` di ID token false. */
  | 'oauth_email_unverified';

export type GoogleOAuthStart =
  { ok: true; url: string } | { ok: false; error: GoogleOAuthError; log?: string };

export type GoogleOAuthResult =
  { ok: true; next: string } | { ok: false; error: GoogleOAuthError; log?: string };

/** Env OAuth belum lengkap — beda dari error alur (pesan bisa ditindaklanjuti). */
class OAuthConfigError extends Error {
  constructor() {
    super(
      '[auth] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET is not set. See packages/auth/README.md — "Login dengan Google (OAuth)".',
    );
    this.name = 'OAuthConfigError';
  }
}

function resolveGoogleConfig(): { clientId: string; clientSecret: string } {
  const clientId = getEnv('GOOGLE_CLIENT_ID');
  const clientSecret = getEnv('GOOGLE_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw new OAuthConfigError();
  return { clientId, clientSecret };
}

/** Hanya path internal (`/...`, bukan `//`/`/\`) — cegah open redirect. */
function safeNext(next: string | null | undefined): string {
  if (
    typeof next === 'string' &&
    next.startsWith('/') &&
    !next.startsWith('//') &&
    !next.startsWith('/\\') &&
    next.length <= 512
  ) {
    return next;
  }
  return '/profile';
}

function callbackUrl(requestUrl: string): string {
  return new URL(GOOGLE_OAUTH_CALLBACK_PATH, requestUrl).toString();
}

const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

/** Bentuk minimal `fetch` untuk userinfo (pola sama dengan `FetchLike` @packages/email). */
export type PictureFetchLike = (
  input: string,
  init?: { headers?: Record<string, string> },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export type PictureDeps = {
  /** Inject `fetch` untuk test (default: `fetch` global). */
  fetchImpl?: PictureFetchLike;
};

/**
 * URL foto profil Google → dipakai `oauthLogin` untuk `Auth.image` +
 * `OAuthAccount.image`.
 *
 * Urutan: claim `picture` di ID token (tanpa request tambahan) → bila kosong,
 * panggil endpoint userinfo memakai `access_token` yang sudah dipegang. Klaim
 * itu menurut dokumen Google hanya "**might** be provided" dan bisa hilang
 * sama sekali untuk sebagian akun (googleapis/google-auth-library-nodejs#822),
 * makanya butuh fallback.
 *
 * Tidak pernah melempar — foto bukan alasan login gagal:
 * - `string`  → ada foto, simpan;
 * - `null`    → penyedia memastikan tidak ada foto → kolom dikosongkan;
 * - `undefined` → tidak bisa dipastikan (http non-2xx, JSON rusak, jaringan) →
 *   `oauthLogin` membiarkan nilai lama, avatar tidak ikut hilang.
 */
export async function resolveGooglePicture(
  accessToken: string | null | undefined,
  idTokenPicture: string | null | undefined,
  deps: PictureDeps = {},
): Promise<string | null | undefined> {
  if (idTokenPicture) return idTokenPicture;
  if (!accessToken) return undefined;

  try {
    const fetchImpl: PictureFetchLike = deps.fetchImpl ?? (globalThis.fetch as PictureFetchLike);
    const response = await fetchImpl(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return undefined;

    const payload = await response.json();
    const picture =
      typeof payload === 'object' && payload !== null
        ? (payload as { picture?: unknown }).picture
        : undefined;
    if (picture === null || picture === undefined) return null;
    return typeof picture === 'string' ? picture : null;
  } catch {
    return undefined;
  }
}

function toFailure(error: unknown): { ok: false; error: GoogleOAuthError; log?: string } {
  if (error instanceof OAuthConfigError) return { ok: false, error: 'oauth_config' };
  if (error instanceof AuthError) {
    if (error.code === 'OAUTH_ACCOUNT_LINKED') return { ok: false, error: 'oauth_account_linked' };
    if (error.code === 'OAUTH_EMAIL_UNVERIFIED') {
      return { ok: false, error: 'oauth_email_unverified' };
    }
    return { ok: false, error: 'oauth', log: `${error.code}: ${error.message}` };
  }
  return {
    ok: false,
    error: 'oauth',
    log: error instanceof Error ? error.message : String(error),
  };
}

/**
 * Langkah 1: balas URL consent screen Google + set cookie state (httpOnly).
 * `next` = path tujuan setelah sukses (divalidasi internal, default `/profile`).
 */
export async function beginGoogleOAuth(
  requestUrl: string,
  next?: string | null,
): Promise<GoogleOAuthStart> {
  try {
    const { clientId, clientSecret } = resolveGoogleConfig();
    const state = randomBytes(16).toString('base64url');

    const cookieStore = await cookies();
    cookieStore.set(GOOGLE_OAUTH_STATE_COOKIE, JSON.stringify({ state, next: safeNext(next) }), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: GOOGLE_OAUTH_STATE_MAX_AGE,
    });

    const client = new OAuth2Client(clientId, clientSecret);
    const url = client.generateAuthUrl({
      access_type: 'online',
      prompt: 'select_account',
      scope: GOOGLE_OAUTH_SCOPES,
      redirect_uri: callbackUrl(requestUrl),
      state,
    });
    return { ok: true, url };
  } catch (error) {
    return toFailure(error);
  }
}

/**
 * Langkah 2: validasi state → tukar kode dengan token → verifikasi ID token →
 * `authService.oauthLogin` (find-or-create + link) → set cookie sesi.
 * Gagal? hasil `{ ok: false, error }` untuk redirect balik ke halaman login.
 */
export async function completeGoogleOAuth(
  requestUrl: string,
  code: string | null,
  state: string | null,
): Promise<GoogleOAuthResult> {
  try {
    if (!code || !state) throw new AuthError('UNAUTHORIZED', 'Missing OAuth code or state');

    const cookieStore = await cookies();
    const raw = cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
    cookieStore.delete(GOOGLE_OAUTH_STATE_COOKIE); // sekali pakai
    if (!raw) throw new AuthError('UNAUTHORIZED', 'OAuth state missing or expired');

    let stored: { state?: unknown; next?: unknown };
    try {
      stored = JSON.parse(raw) as { state?: unknown; next?: unknown };
    } catch {
      throw new AuthError('UNAUTHORIZED', 'OAuth state cookie is invalid');
    }
    if (typeof stored.state !== 'string') {
      throw new AuthError('UNAUTHORIZED', 'OAuth state cookie is invalid');
    }

    const expected = Buffer.from(stored.state, 'utf8');
    const given = Buffer.from(state, 'utf8');
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      throw new AuthError('UNAUTHORIZED', 'OAuth state mismatch');
    }

    const { clientId, clientSecret } = resolveGoogleConfig();
    const client = new OAuth2Client(clientId, clientSecret);
    const { tokens } = await client.getToken({ code, redirect_uri: callbackUrl(requestUrl) });
    if (!tokens.id_token) throw new AuthError('UNAUTHORIZED', 'Google did not return an ID token');

    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      throw new AuthError('UNAUTHORIZED', 'Google ID token is missing identity');
    }

    const session = await authService.oauthLogin({
      provider: 'google',
      providerId: payload.sub,
      email: payload.email,
      name: payload.name ?? '',
      emailVerified: payload.email_verified === true,
      image: await resolveGooglePicture(tokens.access_token, payload.picture),
    });
    await setSessionCookie(session.token, session.expiresAt);

    return { ok: true, next: safeNext(typeof stored.next === 'string' ? stored.next : null) };
  } catch (error) {
    return toFailure(error);
  }
}
