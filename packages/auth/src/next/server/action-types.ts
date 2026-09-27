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
export type RegisterActionResult = { ok: true; user: AuthUser } | AuthActionFailure;
export type LogoutActionResult = { ok: true };
export type MeActionResult = { ok: true; user: AuthUser | null };
