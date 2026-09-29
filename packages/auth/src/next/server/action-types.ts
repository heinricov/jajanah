import type { AuthUser } from '@packages/validators';

/**
 * Hasil gagal server action — polos & JSON-serializable (class error tidak
 * bisa dikirim lewat batas RPC). Dinaikkan lagi jadi `AuthActionError` di
 * `AuthProvider` sehingga kontrak error UI tidak berubah.
 */
export type AuthActionFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
};

export type LoginActionResult = { ok: true; user: AuthUser } | AuthActionFailure;

/**
 * Register sukses TIDAK auto-login: akun dibuat dengan `emailVerifiedAt` null
 * dan email konfirmasi dikirim — user harus membuka tautan dulu.
 */
export type RegisterActionResult =
  { ok: true; user: AuthUser; requiresEmailVerification: true } | AuthActionFailure;

/** Kirim ulang email konfirmasi — selalu `ok: true` bila tidak ada error server (anti-enumerasi). */
export type ResendVerificationActionResult = { ok: true } | AuthActionFailure;

/** Kirim tautan reset password — selalu `ok: true` bila tidak ada error server (anti-enumerasi). */
export type ForgotPasswordActionResult = { ok: true } | AuthActionFailure;

/**
 * Reset password sukses: password diganti, token dipakai sekali, dan SEMUA
 * sesi akun dicabut — user masuk ulang dengan password baru.
 */
export type ResetPasswordActionResult = { ok: true; user: AuthUser } | AuthActionFailure;
export type LogoutActionResult = { ok: true };
export type MeActionResult = { ok: true; user: AuthUser | null };
