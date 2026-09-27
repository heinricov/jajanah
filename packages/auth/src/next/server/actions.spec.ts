import type { AuthUser, LoginRequest, RegisterRequest } from '@packages/validators';

import { AuthError } from '../../domain/errors';
import { clearSessionCookie, getSessionToken, setSessionCookie } from './cookie';
import { loginAction, logoutAction, meAction, registerAction } from './actions';

jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('../../domain/auth.service', () => ({
  authService: {
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    authenticate: jest.fn(),
  },
}));
jest.mock('./cookie', () => ({
  getSessionToken: jest.fn(),
  setSessionCookie: jest.fn(),
  clearSessionCookie: jest.fn(),
}));

const { authService } = jest.requireMock('../../domain/auth.service') as {
  authService: {
    login: jest.Mock;
    register: jest.Mock;
    logout: jest.Mock;
    authenticate: jest.Mock;
  };
};

const user: AuthUser = {
  id: 'u-1',
  name: 'Budi',
  email: 'budi@example.com',
  role: 'USER',
  lastLoginAt: null,
  isActive: true,
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
  it('berhasil: register + auto-login + set cookie', async () => {
    authService.register.mockResolvedValue(user);
    authService.login.mockResolvedValue(loginResponse);

    await expect(registerAction(registerRequest)).resolves.toEqual({ ok: true, user });
    expect(authService.register).toHaveBeenCalledWith(registerRequest);
    expect(authService.login).toHaveBeenCalledWith({
      email: registerRequest.email,
      password: registerRequest.password,
    });
    expect(setSessionCookie).toHaveBeenCalledWith('jwt-abc', loginResponse.expiresAt);
  });

  it('email terdaftar: hasil gagal EMAIL_TAKEN tanpa auto-login', async () => {
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
