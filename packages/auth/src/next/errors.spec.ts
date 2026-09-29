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

  it('menerjemahkan kode EMAIL_NOT_VERIFIED ke pesan ramah', () => {
    const error = new AuthActionError('Email has not been verified yet', {
      status: 403,
      code: 'EMAIL_NOT_VERIFIED',
    });
    expect(authErrorMessage(error)).toBe(
      'Email Anda belum diverifikasi. Buka tautan konfirmasi di kotak masuk Anda.',
    );
  });

  it('menerjemahkan kode INVALID_VERIFY_TOKEN ke pesan ramah', () => {
    const error = new AuthActionError('Verification link is invalid or expired', {
      status: 400,
      code: 'INVALID_VERIFY_TOKEN',
    });
    expect(authErrorMessage(error)).toBe(
      'Tautan konfirmasi tidak valid atau sudah kedaluwarsa. Kirim ulang email konfirmasi.',
    );
  });

  it('menerjemahkan kode INVALID_RESET_TOKEN ke pesan ramah', () => {
    const error = new AuthActionError('Reset link is invalid or expired', {
      status: 400,
      code: 'INVALID_RESET_TOKEN',
    });
    expect(authErrorMessage(error)).toBe(
      'Tautan reset password tidak valid atau sudah kedaluwarsa. Minta tautan baru.',
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
