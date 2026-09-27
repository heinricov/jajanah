import { hashPassword, verifyPassword } from './password';

describe('hashPassword / verifyPassword', () => {
  it('menghasilkan hash scrypt dengan parameter tetap', async () => {
    const hash = await hashPassword('password123');

    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
    expect(hash).not.toContain('password123');
  });

  it('menerima password yang benar dan menolak yang salah', async () => {
    const hash = await hashPassword('password123');

    await expect(verifyPassword('password123', hash)).resolves.toBe(true);
    await expect(verifyPassword('password124', hash)).resolves.toBe(false);
    await expect(verifyPassword('', hash)).resolves.toBe(false);
  });

  it('salt unik — password sama menghasilkan hash berbeda', async () => {
    const first = await hashPassword('password123');
    const second = await hashPassword('password123');

    expect(first).not.toBe(second);
    await expect(verifyPassword('password123', second)).resolves.toBe(true);
  });

  it('menolak stored hash yang rusak atau tidak dikenal', async () => {
    await expect(verifyPassword('x', '')).resolves.toBe(false);
    await expect(verifyPassword('x', 'plaintext')).resolves.toBe(false);
    await expect(verifyPassword('x', 'bcrypt$16384$8$1$c2FsdA$aGFzaA')).resolves.toBe(false);
    await expect(verifyPassword('x', 'scrypt$abc$8$1$c2FsdA$aGFzaA')).resolves.toBe(false);
    await expect(verifyPassword('x', 'scrypt$16384$8$1$$aGFzaA')).resolves.toBe(false);
    await expect(verifyPassword('x', 'scrypt$99999999$8$1$c2FsdA$aGFzaA')).resolves.toBe(false);
  });
});
