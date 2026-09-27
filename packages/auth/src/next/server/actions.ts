'use server';

import type { LoginRequest, RegisterRequest } from '@packages/validators';

import { authService } from '../../domain/auth.service';
import { AuthError } from '../../domain/errors';
import { clearSessionCookie, getSessionToken, setSessionCookie } from './cookie';
import type {
  AuthActionFailure,
  LoginActionResult,
  LogoutActionResult,
  MeActionResult,
  RegisterActionResult,
} from './action-types';

/**
 * Server action auth — satu-satunya pintu auth untuk aplikasi Next.
 *
 * Semua aksi memanggil domain `authService` (Prisma) langsung: tidak ada
 * route handler `/api/auth/*` per-app dan tidak ada proxy HTTP ke `apps/api`.
 * Cookie httpOnly di-set/dihapus di sini sehingga token tidak pernah
 * terlihat oleh JavaScript, dan proteksi Origin/CSRF bawaan Next berlaku.
 */

function toFailure(error: unknown): AuthActionFailure {
  if (error instanceof AuthError) {
    return { ok: false, status: error.status, code: error.code, message: error.message };
  }
  return { ok: false, status: 500, code: 'INTERNAL', message: 'Terjadi kesalahan di server.' };
}

/** Login: verifikasi kredensial lalu set cookie sesi httpOnly. */
export async function loginAction(request: LoginRequest): Promise<LoginActionResult> {
  try {
    const result = await authService.login(request);
    await setSessionCookie(result.token, result.expiresAt);
    return { ok: true, user: result.user };
  } catch (error) {
    return toFailure(error);
  }
}

/** Register: buat akun lalu auto-login (set cookie sesi dari kredensial sama). */
export async function registerAction(request: RegisterRequest): Promise<RegisterActionResult> {
  try {
    await authService.register(request);
    const result = await authService.login({
      email: request.email,
      password: request.password,
    });
    await setSessionCookie(result.token, result.expiresAt);
    return { ok: true, user: result.user };
  } catch (error) {
    return toFailure(error);
  }
}

/**
 * Logout: revoke sesi di server (best-effort) + hapus cookie.
 * Kegagalan revoke tidak menggagalkan — cookie tetap dibersihkan.
 */
export async function logoutAction(): Promise<LogoutActionResult> {
  const token = await getSessionToken();
  if (token !== null) {
    try {
      await authService.logout(token);
    } catch {
      // Sesi mungkin sudah mati di server — cookie tetap dibersihkan.
    }
  }
  await clearSessionCookie();
  return { ok: true };
}

/**
 * Ambil user sesi berjalan dari cookie; `null` bila belum login / token
 * kedaluwarsa/tercabut. Error non-auth (mis. DB down) diteruskan agar
 * outage terlihat, bukan disamarkan jadi "belum login".
 */
export async function meAction(): Promise<MeActionResult> {
  const token = await getSessionToken();
  if (token === null) return { ok: true, user: null };

  try {
    return { ok: true, user: await authService.authenticate(token) };
  } catch (error) {
    if (error instanceof AuthError && error.code === 'UNAUTHORIZED') {
      return { ok: true, user: null };
    }
    throw error;
  }
}
