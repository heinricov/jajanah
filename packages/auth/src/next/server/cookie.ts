import { cookies } from 'next/headers';

import { SESSION_COOKIE } from '../cookie';
import { sessionCookieOptions } from './cookie-options';

/** Baca token sesi dari cookie httpOnly; `null` bila belum login. */
export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/** Set cookie httpOnly dengan umur = `expiresAt` (LoginResponse) — hanya dari route handler. */
export async function setSessionCookie(token: string, expiresAt: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

/** Hapus cookie sesi — idempoten. */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  if (store.has(SESSION_COOKIE)) {
    store.delete(SESSION_COOKIE);
  }
}
