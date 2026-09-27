import { AuthActionError, authErrorMessage } from './errors';

describe('authErrorMessage', () => {
  it('menerjemahkan kode INVALID_CREDENTIALS ke pesan ramah', () => {
    const error = new AuthActionError('Invalid email or password', {
      status: 401,
      code: 'INVALID_CREDENTIALS',
    });
    expect(authErrorMessage(error)).toBe('Email atau password salah.');
  });

  it('menerjemahkan kode EMAIL_TAKEN ke pesan ramah', () => {
    const error = new AuthActionError('Email is already registered', {
      status: 409,
      code: 'EMAIL_TAKEN',
    });
    expect(authErrorMessage(error)).toBe(
      'Email sudah terdaftar. Silakan masuk atau gunakan email lain.',
    );
  });

  it('menerjemahkan kode TRANSPORT ke pesan koneksi', () => {
    expect(authErrorMessage(new AuthActionError('x', { status: 0, code: 'TRANSPORT' }))).toBe(
      'Tidak dapat terhubung ke server. Coba lagi nanti.',
    );
  });

  it('jatuh ke pesan server untuk kode yang tidak dikenal', () => {
    const error = new AuthActionError('Kode aneh', { status: 400, code: 'WEIRD' });
    expect(authErrorMessage(error)).toBe('Kode aneh');
  });

  it('memakai message Error biasa, lalu fallback', () => {
    expect(authErrorMessage(new Error('langsung'))).toBe('langsung');
    expect(authErrorMessage(null)).toBe('Terjadi kesalahan. Coba lagi.');
    expect(authErrorMessage(undefined, 'custom')).toBe('custom');
  });
});
