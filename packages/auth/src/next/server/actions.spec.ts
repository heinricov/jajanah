import type { AuthUser, LoginRequest, RegisterRequest } from '@packages/validators';

import { AuthError } from '../../domain/errors';
import { clearSessionCookie, getSessionToken, setSessionCookie } from './cookie';
import {
  forgotPasswordAction,
  loginAction,
  logoutAction,
  meAction,
  registerAction,
  resendVerificationAction,
  resetPasswordAction,
} from './actions';

jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('../../domain/auth.service', () => ({
  authService: {
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    authenticate: jest.fn(),
    requestEmailVerification: jest.fn(),
    requestPasswordReset: jest.fn(),
    resetPassword: jest.fn(),
  },
}));
jest.mock('./cookie', () => ({
  getSessionToken: jest.fn(),
  setSessionCookie: jest.fn(),
  clearSessionCookie: jest.fn(),
}));
jest.mock('@packages/email', () => ({
  emailService: { sendConfirmation: jest.fn(), sendPasswordReset: jest.fn() },
}));

const { authService } = jest.requireMock('../../domain/auth.service') as {
  authService: {
    login: jest.Mock;
    register: jest.Mock;
    logout: jest.Mock;
    authenticate: jest.Mock;
    requestEmailVerification: jest.Mock;
    requestPasswordReset: jest.Mock;
    resetPassword: jest.Mock;
  };
};
const { emailService } = jest.requireMock('@packages/email') as {
  emailService: { sendConfirmation: jest.Mock; sendPasswordReset: jest.Mock };
};

const user: AuthUser = {
  id: 'u-1',
  name: 'Budi',
  email: 'budi@example.com',
  image: null,
  role: 'USER',
  lastLoginAt: null,
  isActive: true,
  emailVerified: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const loginRequest: LoginRequest = { email: 'budi@example.com', password: 'rahasia123' };
const registerRequest: RegisterRequest = {
  name: 'Budi',
  email: 'budi@example.com',
  password: 'rahasia123',
};

const loginResponse = {
  token: 'jwt-abc',
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  user,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('loginAction', () => {
  it('berhasil: login domain + set cookie sesi + kembalikan user', async () => {
    authService.login.mockResolvedValue(loginResponse);

    await expect(loginAction(loginRequest)).resolves.toEqual({ ok: true, user });
    expect(authService.login).toHaveBeenCalledWith(loginRequest);
    expect(setSessionCookie).toHaveBeenCalledWith('jwt-abc', loginResponse.expiresAt);
  });

  it('kredensial salah: hasil gagal dengan code INVALID_CREDENTIALS', async () => {
    authService.login.mockRejectedValue(
      new AuthError('INVALID_CREDENTIALS', 'Invalid email or password'),
    );

    await expect(loginAction(loginRequest)).resolves.toEqual({
      ok: false,
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    });
    expect(setSessionCookie).not.toHaveBeenCalled();
  });

  it('error tak terduga: hasil gagal INTERNAL (tidak bocorkan detail)', async () => {
    authService.login.mockRejectedValue(new Error('prisma exploded'));

    await expect(loginAction(loginRequest)).resolves.toEqual({
      ok: false,
      status: 500,
      code: 'INTERNAL',
      message: 'Terjadi kesalahan di server.',
    });
  });
});

describe('registerAction', () => {
  it('berhasil: register TANPA auto-login — kirim email konfirmasi', async () => {
    authService.register.mockResolvedValue(user);
    authService.requestEmailVerification.mockResolvedValue({
      token: 'tok-abc',
      name: 'Budi',
      email: 'budi@example.com',
    });
    emailService.sendConfirmation.mockResolvedValue({ delivered: true });

    await expect(registerAction(registerRequest)).resolves.toEqual({
      ok: true,
      user,
      requiresEmailVerification: true,
    });
    expect(authService.register).toHaveBeenCalledWith(registerRequest);
    expect(authService.requestEmailVerification).toHaveBeenCalledWith('budi@example.com');
    expect(emailService.sendConfirmation).toHaveBeenCalledWith({
      to: 'budi@example.com',
      name: 'Budi',
      link: expect.stringContaining('/auth/verify-email?token=tok-abc'),
    });
    expect(authService.login).not.toHaveBeenCalled();
    expect(setSessionCookie).not.toHaveBeenCalled();
  });

  it('kirim email gagal: pendaftaran tetap sukses (best-effort)', async () => {
    authService.register.mockResolvedValue(user);
    authService.requestEmailVerification.mockResolvedValue({
      token: 'tok-abc',
      name: 'Budi',
      email: 'budi@example.com',
    });
    emailService.sendConfirmation.mockRejectedValue(new Error('smtp down'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(registerAction(registerRequest)).resolves.toEqual({
      ok: true,
      user,
      requiresEmailVerification: true,
    });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('email terdaftar: hasil gagal EMAIL_TAKEN tanpa mengirim email', async () => {
    authService.register.mockRejectedValue(
      new AuthError('EMAIL_TAKEN', 'Email is already registered'),
    );

    await expect(registerAction(registerRequest)).resolves.toEqual({
      ok: false,
      status: 409,
      code: 'EMAIL_TAKEN',
      message: 'Email is already registered',
    });
    expect(authService.login).not.toHaveBeenCalled();
    expect(setSessionCookie).not.toHaveBeenCalled();
    expect(authService.requestEmailVerification).not.toHaveBeenCalled();
    expect(emailService.sendConfirmation).not.toHaveBeenCalled();
  });
});

describe('resendVerificationAction', () => {
  it('akun belum terverifikasi → kirim email konfirmasi baru, ok: true', async () => {
    authService.requestEmailVerification.mockResolvedValue({
      token: 'tok-2',
      name: 'Budi',
      email: 'budi@example.com',
    });
    emailService.sendConfirmation.mockResolvedValue({ delivered: true });

    await expect(resendVerificationAction('budi@example.com')).resolves.toEqual({ ok: true });
    expect(emailService.sendConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'budi@example.com', name: 'Budi' }),
    );
  });

  it('email tak dikenal / sudah terverifikasi → ok: true tanpa email (anti-enumerasi)', async () => {
    authService.requestEmailVerification.mockResolvedValue(null);

    await expect(resendVerificationAction('orang@example.com')).resolves.toEqual({ ok: true });
    expect(emailService.sendConfirmation).not.toHaveBeenCalled();
  });

  it('error server → hasil gagal INTERNAL (tanpa bocorkan detail)', async () => {
    authService.requestEmailVerification.mockRejectedValue(new Error('db down'));

    await expect(resendVerificationAction('budi@example.com')).resolves.toEqual({
      ok: false,
      status: 500,
      code: 'INTERNAL',
      message: 'Terjadi kesalahan di server.',
    });
  });
});

describe('forgotPasswordAction', () => {
  it('akun dikenal → kirim tautan reset, ok: true', async () => {
    authService.requestPasswordReset.mockResolvedValue({
      token: 'tok-rst',
      name: 'Budi',
      email: 'budi@example.com',
    });
    emailService.sendPasswordReset.mockResolvedValue({ delivered: true });

    await expect(forgotPasswordAction('budi@example.com')).resolves.toEqual({ ok: true });
    expect(authService.requestPasswordReset).toHaveBeenCalledWith('budi@example.com');
    expect(emailService.sendPasswordReset).toHaveBeenCalledWith({
      to: 'budi@example.com',
      name: 'Budi',
      link: expect.stringContaining('/auth/forgot-password/new-password?token=tok-rst'),
    });
  });

  it('email tak dikenal → ok: true tanpa email (anti-enumerasi)', async () => {
    authService.requestPasswordReset.mockResolvedValue(null);

    await expect(forgotPasswordAction('orang@example.com')).resolves.toEqual({ ok: true });
    expect(emailService.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('kirim email gagal: aksi tetap sukses (best-effort)', async () => {
    authService.requestPasswordReset.mockResolvedValue({
      token: 'tok-rst',
      name: 'Budi',
      email: 'budi@example.com',
    });
    emailService.sendPasswordReset.mockRejectedValue(new Error('smtp down'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(forgotPasswordAction('budi@example.com')).resolves.toEqual({ ok: true });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('error server → hasil gagal INTERNAL (tanpa bocorkan detail)', async () => {
    authService.requestPasswordReset.mockRejectedValue(new Error('db down'));

    await expect(forgotPasswordAction('budi@example.com')).resolves.toEqual({
      ok: false,
      status: 500,
      code: 'INTERNAL',
      message: 'Terjadi kesalahan di server.',
    });
  });
});

describe('resetPasswordAction', () => {
  it('token valid → password diganti, hasil ok dengan user', async () => {
    authService.resetPassword.mockResolvedValue(user);

    await expect(resetPasswordAction({ token: 'tok-rst', password: 'Baru1234' })).resolves.toEqual({
      ok: true,
      user,
    });
    expect(authService.resetPassword).toHaveBeenCalledWith('tok-rst', 'Baru1234');
  });

  it('input tidak valid (password terlalu pendek) → VALIDATION tanpa menyentuh domain', async () => {
    await expect(resetPasswordAction({ token: 'tok-rst', password: 'pendek' })).resolves.toEqual({
      ok: false,
      status: 400,
      code: 'VALIDATION',
      message: 'Invalid reset request',
    });
    expect(authService.resetPassword).not.toHaveBeenCalled();
  });

  it('token kedaluwarsa → gagal INVALID_RESET_TOKEN (400)', async () => {
    authService.resetPassword.mockRejectedValue(
      new AuthError('INVALID_RESET_TOKEN', 'Reset link is invalid or expired'),
    );

    await expect(resetPasswordAction({ token: 'tok-exp', password: 'Baru1234' })).resolves.toEqual({
      ok: false,
      status: 400,
      code: 'INVALID_RESET_TOKEN',
      message: 'Reset link is invalid or expired',
    });
  });

  it('error server → hasil gagal INTERNAL (tanpa bocorkan detail)', async () => {
    authService.resetPassword.mockRejectedValue(new Error('db down'));

    await expect(resetPasswordAction({ token: 'tok-rst', password: 'Baru1234' })).resolves.toEqual({
      ok: false,
      status: 500,
      code: 'INTERNAL',
      message: 'Terjadi kesalahan di server.',
    });
  });
});

describe('logoutAction', () => {
  it('revoke sesi + hapus cookie', async () => {
    (getSessionToken as jest.Mock).mockResolvedValue('jwt-abc');
    authService.logout.mockResolvedValue(undefined);

    await expect(logoutAction()).resolves.toEqual({ ok: true });
    expect(authService.logout).toHaveBeenCalledWith('jwt-abc');
    expect(clearSessionCookie).toHaveBeenCalled();
  });

  it('revoke gagal tetap lanjut hapus cookie (best-effort)', async () => {
    (getSessionToken as jest.Mock).mockResolvedValue('jwt-basi');
    authService.logout.mockRejectedValue(
      new AuthError('UNAUTHORIZED', 'Invalid or expired session token'),
    );

    await expect(logoutAction()).resolves.toEqual({ ok: true });
    expect(clearSessionCookie).toHaveBeenCalled();
  });

  it('tanpa cookie: tidak panggil domain, cookie tetap dibersihkan', async () => {
    (getSessionToken as jest.Mock).mockResolvedValue(null);

    await expect(logoutAction()).resolves.toEqual({ ok: true });
    expect(authService.logout).not.toHaveBeenCalled();
    expect(clearSessionCookie).toHaveBeenCalled();
  });
});

describe('meAction', () => {
  it('tanpa cookie: user null', async () => {
    (getSessionToken as jest.Mock).mockResolvedValue(null);

    await expect(meAction()).resolves.toEqual({ ok: true, user: null });
    expect(authService.authenticate).not.toHaveBeenCalled();
  });

  it('token valid: kembalikan user', async () => {
    (getSessionToken as jest.Mock).mockResolvedValue('jwt-abc');
    authService.authenticate.mockResolvedValue(user);

    await expect(meAction()).resolves.toEqual({ ok: true, user });
  });

  it('token 401: user null (bukan error)', async () => {
    (getSessionToken as jest.Mock).mockResolvedValue('jwt-basi');
    authService.authenticate.mockRejectedValue(
      new AuthError('UNAUTHORIZED', 'Session is invalid or expired'),
    );

    await expect(meAction()).resolves.toEqual({ ok: true, user: null });
  });

  it('error non-auth diteruskan (outage terlihat)', async () => {
    (getSessionToken as jest.Mock).mockResolvedValue('jwt-abc');
    authService.authenticate.mockRejectedValue(new Error('db down'));

    await expect(meAction()).rejects.toThrow('db down');
  });
});
