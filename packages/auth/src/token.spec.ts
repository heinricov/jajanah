import { createHmac } from 'node:crypto';

import {
  DEFAULT_SESSION_TTL_HOURS,
  getSessionTtlHours,
  signSessionToken,
  verifySessionToken,
} from './token';

const SECRET = 'unit-test-secret-0123456789';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('signSessionToken / verifySessionToken', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
    delete process.env.AUTH_SESSION_TTL_HOURS;
  });

  it('roundtrip — klaim valid dikembalikan utuh', () => {
    const token = signSessionToken({ sub: 'user-1', role: 'USER', ttlHours: 1 });
    const claims = verifySessionToken(token);

    expect(claims).not.toBeNull();
    expect(claims?.sub).toBe('user-1');
    expect(claims?.role).toBe('USER');
    expect(claims?.jti).toMatch(UUID_PATTERN);
    expect(claims?.exp).toBe((claims?.iat ?? 0) + 3600);
  });

  it('jti bisa di-override (dipakai kolom Session.token)', () => {
    const token = signSessionToken({ sub: 'u', role: 'ADMIN', jti: 'fixed-jti' });

    expect(verifySessionToken(token)?.jti).toBe('fixed-jti');
  });

  it('menolak payload yang dimanipulasi', () => {
    const token = signSessionToken({ sub: 'user-1', role: 'USER' });
    const [header, , signature] = token.split('.');

    const forged = Buffer.from(
      JSON.stringify({
        sub: 'attacker',
        jti: 'x',
        role: 'ADMIN',
        iat: 1,
        exp: 9_999_999_999,
      }),
    ).toString('base64url');

    expect(verifySessionToken(`${header}.${forged}.${signature}`)).toBeNull();
  });

  it('menolak signature salah dan token rusak', () => {
    const token = signSessionToken({ sub: 'user-1', role: 'USER' });

    expect(verifySessionToken(`${token}x`)).toBeNull();
    expect(verifySessionToken('a.b.c')).toBeNull();
    expect(verifySessionToken('abc')).toBeNull();
    expect(verifySessionToken('')).toBeNull();
  });

  it('menolak token yang sudah kedaluwarsa', () => {
    const token = signSessionToken({ sub: 'user-1', role: 'USER', ttlHours: -1 });

    expect(verifySessionToken(token)).toBeNull();
  });

  it('menolak secret yang berbeda', () => {
    const token = signSessionToken({ sub: 'user-1', role: 'USER' });
    process.env.JWT_SECRET = 'secret-lain';

    expect(verifySessionToken(token)).toBeNull();
  });

  it('menolak header alg selain HS256 meski signature valid', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS512', typ: 'JWT' })).toString('base64url');
    const claims = Buffer.from(
      JSON.stringify({ sub: 'u', jti: 'j', role: 'USER', iat: 1, exp: 9_999_999_999 }),
    ).toString('base64url');
    const signature = createHmac('sha256', SECRET)
      .update(`${header}.${claims}`)
      .digest('base64url');

    expect(verifySessionToken(`${header}.${claims}.${signature}`)).toBeNull();
  });

  it('menolak role yang tidak sah', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const claims = Buffer.from(
      JSON.stringify({ sub: 'u', jti: 'j', role: 'SUPERADMIN', iat: 1, exp: 9_999_999_999 }),
    ).toString('base64url');
    const signature = createHmac('sha256', SECRET)
      .update(`${header}.${claims}`)
      .digest('base64url');

    expect(verifySessionToken(`${header}.${claims}.${signature}`)).toBeNull();
  });

  it('melempar error jelas bila JWT_SECRET tidak di-set', () => {
    delete process.env.JWT_SECRET;

    expect(() => signSessionToken({ sub: 'u', role: 'USER' })).toThrow(/JWT_SECRET/);
  });

  it('getSessionTtlHours memakai default bila env kosong/tidak valid', () => {
    expect(getSessionTtlHours()).toBe(DEFAULT_SESSION_TTL_HOURS);

    process.env.AUTH_SESSION_TTL_HOURS = '0';
    expect(getSessionTtlHours()).toBe(DEFAULT_SESSION_TTL_HOURS);

    process.env.AUTH_SESSION_TTL_HOURS = 'abc';
    expect(getSessionTtlHours()).toBe(DEFAULT_SESSION_TTL_HOURS);

    process.env.AUTH_SESSION_TTL_HOURS = '24';
    expect(getSessionTtlHours()).toBe(24);
  });
});
