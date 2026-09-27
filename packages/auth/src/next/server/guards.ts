import type { AuthUser } from '@packages/validators';
import { redirect } from 'next/navigation';

import { authService } from '../../domain/auth.service';
import { AuthError } from '../../domain/errors';

import { getSessionToken } from './cookie';

/**
 * User untuk request berjalan (cookie → verifikasi langsung ke domain
 * `authService`, tanpa HTTP ke `apps/api`).
 * `null` bila tanpa cookie atau token 401 (kedaluwarsa/tercabut).
 * Error non-auth (mis. DB down) diteruskan agar outage terlihat, bukan
 * disamarkan jadi "belum login".
 */
export async function getSessionUser(): Promise<AuthUser | null> {
  const token = await getSessionToken();
  if (token === null) return null;

  try {
    return await authService.authenticate(token);
  } catch (error) {
    if (error instanceof AuthError && error.code === 'UNAUTHORIZED') return null;
    throw error;
  }
}

/** Wajib login — redirect ke halaman login bila tidak ada sesi valid. */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getSessionUser();
  if (user === null) redirect('/auth/login');
  return user;
}

/** Wajib login + role `ADMIN` — selain itu redirect ke halaman login. */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role !== 'ADMIN') redirect('/auth/login');
  return user;
}
