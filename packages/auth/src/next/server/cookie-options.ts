/** Opsi cookie sesi httpOnly — pure (mudah diuji; tanpa `next/headers`). */

export type SessionCookieOptions = {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: '/';
  maxAge: number;
};

/** Hitung umur cookie (detik) dari `expiresAt` ISO milik `LoginResponse`. */
export function computeSessionMaxAge(expiresAt: string, now: number = Date.now()): number {
  const expires = Date.parse(expiresAt);
  if (Number.isNaN(expires)) return 0;
  return Math.max(0, Math.floor((expires - now) / 1000));
}

export function sessionCookieOptions(expiresAt: string): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: computeSessionMaxAge(expiresAt),
  };
}
