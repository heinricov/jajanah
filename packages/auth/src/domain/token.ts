import '@packages/environment';

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import { getEnv } from '@packages/environment';

import type { Role } from '@packages/validators';

/** Default umur sesi: 7 hari (override via `AUTH_SESSION_TTL_HOURS`). */
export const DEFAULT_SESSION_TTL_HOURS = 168;

export interface SessionTokenClaims {
  /** Subject — id user (model `Auth`). */
  sub: string;
  /** Token id; disimpan di kolom `Session.token` untuk revoke (logout). */
  jti: string;
  role: Role;
  /** Issued at (epoch detik). */
  iat: number;
  /** Expiry (epoch detik). */
  exp: number;
}

function resolveSecret(): string {
  const secret = getEnv('JWT_SECRET');
  if (!secret) {
    throw new Error('[auth] JWT_SECRET is not set. Define it in the root .env (see .env.example).');
  }
  return secret;
}

export function getSessionTtlHours(): number {
  const raw = getEnv('AUTH_SESSION_TTL_HOURS');
  const value = raw === undefined ? Number.NaN : Number(raw);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_SESSION_TTL_HOURS;
}

function base64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function hmacBase64url(signingInput: string): string {
  return createHmac('sha256', resolveSecret()).update(signingInput, 'utf8').digest('base64url');
}

export interface SignSessionTokenInput {
  sub: string;
  role: Role;
  ttlHours?: number;
  jti?: string;
}

/**
 * Buat JWT HS256. Verifikasi tidak pernah mendispatch berdasar header `alg`
 * (selalu hitung ulang HMAC-SHA256) — mencegah algorithm confusion.
 */
export function signSessionToken(input: SignSessionTokenInput): string {
  const now = Math.floor(Date.now() / 1000);
  const ttlSeconds = Math.round((input.ttlHours ?? getSessionTtlHours()) * 3600);

  const header = { alg: 'HS256', typ: 'JWT' };
  const claims: SessionTokenClaims = {
    sub: input.sub,
    jti: input.jti ?? randomUUID(),
    role: input.role,
    iat: now,
    exp: now + ttlSeconds,
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  return `${signingInput}.${hmacBase64url(signingInput)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function verifySessionToken(token: string): SessionTokenClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedClaims, signature] = parts;
  if (encodedHeader === undefined || encodedClaims === undefined || signature === undefined) {
    return null;
  }
  if (signature.length === 0) return null;

  const expected = hmacBase64url(`${encodedHeader}.${encodedClaims}`);
  const given = Buffer.from(signature, 'utf8');
  const want = Buffer.from(expected, 'utf8');
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;

  let header: unknown;
  let claims: unknown;
  try {
    header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
    claims = JSON.parse(Buffer.from(encodedClaims, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!isRecord(header) || header.alg !== 'HS256') return null;
  if (!isRecord(claims)) return null;

  const { sub, jti, role, iat, exp } = claims;
  if (typeof sub !== 'string' || sub.length === 0) return null;
  if (typeof jti !== 'string' || jti.length === 0) return null;
  if (role !== 'USER' && role !== 'ADMIN') return null;
  if (typeof iat !== 'number' || !Number.isFinite(iat)) return null;
  if (typeof exp !== 'number' || !Number.isFinite(exp)) return null;
  if (exp <= Math.floor(Date.now() / 1000)) return null;

  return { sub, jti, role, iat, exp };
}
