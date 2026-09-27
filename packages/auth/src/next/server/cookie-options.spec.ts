import { computeSessionMaxAge, sessionCookieOptions } from './cookie-options';

describe('computeSessionMaxAge', () => {
  const now = Date.parse('2026-01-01T00:00:00.000Z');

  it('menghitung umur cookie dari expiresAt (detik, dibulatkan ke bawah)', () => {
    expect(computeSessionMaxAge('2026-01-01T01:00:00.000Z', now)).toBe(3600);
    expect(computeSessionMaxAge('2026-01-01T00:00:01.900Z', now)).toBe(1);
  });

  it('membatasi ke 0 bila sudah lewat', () => {
    expect(computeSessionMaxAge('2025-12-31T23:00:00.000Z', now)).toBe(0);
  });

  it('mengembalikan 0 untuk tanggal tidak valid', () => {
    expect(computeSessionMaxAge('bukan-tanggal', now)).toBe(0);
  });
});

describe('sessionCookieOptions', () => {
  it('selalu httpOnly, sameSite=lax, path=/ dan umur > 0 untuk sesi mendatang', () => {
    const options = sessionCookieOptions(new Date(Date.now() + 60_000).toISOString());
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe('lax');
    expect(options.path).toBe('/');
    expect(options.maxAge).toBeGreaterThan(0);
  });

  it('secure mengikuti NODE_ENV (di test: false)', () => {
    const options = sessionCookieOptions(new Date(Date.now() + 60_000).toISOString());
    expect(options.secure).toBe(process.env.NODE_ENV === 'production');
  });
});
