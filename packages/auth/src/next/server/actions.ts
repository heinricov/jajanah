'use server';

import { emailService } from '@packages/email';
import { getEnv } from '@packages/environment';
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
  ResendVerificationActionResult,
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

/** URL absolut tautan konfirmasi — basis dari `APP_URL` (default localhost sesuai `WEB_PORT`). */
function verificationLink(token: string): string {
  const base = (getEnv('APP_URL') ?? 'http://localhost:3000').replace(/\/+$/, '');
  return `${base}/auth/verify-email?token=${encodeURIComponent(token)}`;
}

/**
 * Kirim email konfirmasi — kegagalan pengiriman TIDAK merusak aksi (akun
 * sudah terdaftar; user bisa meminta kirim ulang dari halaman verifikasi).
 */
async function sendVerificationMail(pending: {
  token: string;
  name: string;
  email: string;
}): Promise<void> {
  try {
    await emailService.sendConfirmation({
      to: pending.email,
      name: pending.name,
      link: verificationLink(pending.token),
    });
  } catch (cause) {
    console.error('[auth] gagal kirim email konfirmasi:', cause);
  }
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

/**
 * Register: buat akun (belum terverifikasi) + kirim email konfirmasi.
 * TIDAK auto-login — sesi baru dibuat setelah tautan dibuka (`verifyEmail`).
 */
export async function registerAction(request: RegisterRequest): Promise<RegisterActionResult> {
  try {
    const user = await authService.register(request);
    const pending = await authService.requestEmailVerification(user.email);
    if (pending) await sendVerificationMail(pending);
    return { ok: true, user, requiresEmailVerification: true };
  } catch (error) {
    return toFailure(error);
  }
}

/**
 * Kirim ulang email konfirmasi — respons sukses identik entah email dikenal,
 * sudah terverifikasi, atau tidak ada (anti-enumerasi; token lama dinonaktifkan).
 */
export async function resendVerificationAction(
  email: string,
): Promise<ResendVerificationActionResult> {
  try {
    const pending = await authService.requestEmailVerification(email);
    if (pending) await sendVerificationMail(pending);
    return { ok: true };
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
