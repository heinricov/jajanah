import { AuthError } from '../../domain/errors';
import type { AuthUser } from '@packages/validators';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { getSessionToken, setSessionCookie } from './cookie';
import { getSessionUser, requireAdmin, requireAuth } from './guards';

jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('next/navigation', () => ({ redirect: jest.fn() }));
jest.mock('../../domain/auth.service', () => ({
  authService: { authenticate: jest.fn() },
}));

const { authService } = jest.requireMock('../../domain/auth.service') as {
  authService: { authenticate: jest.Mock };
};
const mockedCookies = cookies as jest.MockedFunction<typeof cookies>;
const mockedRedirect = redirect as jest.MockedFunction<typeof redirect>;

const user: AuthUser = {
  id: 'u-1',
  name: 'Demo',
  email: 'user@jajanah.local',
  role: 'USER',
  lastLoginAt: null,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function mockCookieStore(token?: string) {
  const store = {
    get: jest.fn(() => (token !== undefined ? { name: 'tj_token', value: token } : undefined)),
    set: jest.fn(),
    delete: jest.fn(),
    has: jest.fn(() => token !== undefined),
  };
  mockedCookies.mockResolvedValue(store as unknown as Awaited<ReturnType<typeof cookies>>);
  return store;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedRedirect.mockImplementation((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  });
});

describe('getSessionToken / setSessionCookie', () => {
  it('mengembalikan token dari cookie httpOnly', async () => {
    mockCookieStore('jwt-abc');
    await expect(getSessionToken()).resolves.toBe('jwt-abc');
  });

  it('mengembalikan null tanpa cookie', async () => {
    mockCookieStore();
    await expect(getSessionToken()).resolves.toBeNull();
  });

  it('set cookie dengan opsi httpOnly + umur dari expiresAt', async () => {
    const store = mockCookieStore();
    const expiresAt = new Date(Date.now() + 3_600_000).toISOString();
    await setSessionCookie('jwt-abc', expiresAt);

    expect(store.set).toHaveBeenCalledTimes(1);
    const [name, value, options] = store.set.mock.calls[0] as [
      string,
      string,
      { httpOnly: boolean; path: string; maxAge: number },
    ];
    expect(name).toBe('tj_token');
    expect(value).toBe('jwt-abc');
    expect(options.httpOnly).toBe(true);
    expect(options.path).toBe('/');
    expect(options.maxAge).toBeGreaterThan(0);
  });
});

describe('getSessionUser', () => {
  it('null tanpa cookie (tanpa memanggil domain)', async () => {
    mockCookieStore();
    await expect(getSessionUser()).resolves.toBeNull();
    expect(authService.authenticate).not.toHaveBeenCalled();
  });

  it('mengembalikan user via authService.authenticate', async () => {
    mockCookieStore('jwt-abc');
    authService.authenticate.mockResolvedValue(user);
    await expect(getSessionUser()).resolves.toEqual(user);
    expect(authService.authenticate).toHaveBeenCalledWith('jwt-abc');
  });

  it('null bila token 401 (kedaluwarsa/tercabut)', async () => {
    mockCookieStore('jwt-basi');
    authService.authenticate.mockRejectedValue(
      new AuthError('UNAUTHORIZED', 'Session is invalid or expired'),
    );
    await expect(getSessionUser()).resolves.toBeNull();
  });

  it('meneruskan error non-auth (outage tidak disembunyikan)', async () => {
    mockCookieStore('jwt-abc');
    authService.authenticate.mockRejectedValue(new Error('db down'));
    await expect(getSessionUser()).rejects.toThrow('db down');
  });
});

describe('requireAuth / requireAdmin', () => {
  it('requireAuth redirect ke /auth/login tanpa sesi', async () => {
    mockCookieStore();
    await expect(requireAuth()).rejects.toThrow('REDIRECT:/auth/login');
    expect(mockedRedirect).toHaveBeenCalledWith('/auth/login');
  });

  it('requireAuth mengembalikan user dengan sesi valid', async () => {
    mockCookieStore('jwt-abc');
    authService.authenticate.mockResolvedValue(user);
    await expect(requireAuth()).resolves.toEqual(user);
  });

  it('requireAdmin lolos untuk role ADMIN', async () => {
    mockCookieStore('jwt-abc');
    authService.authenticate.mockResolvedValue({ ...user, role: 'ADMIN' });
    await expect(requireAdmin()).resolves.toMatchObject({ role: 'ADMIN' });
  });

  it('requireAdmin redirect untuk role USER', async () => {
    mockCookieStore('jwt-abc');
    authService.authenticate.mockResolvedValue(user);
    await expect(requireAdmin()).rejects.toThrow('REDIRECT:/auth/login');
    expect(mockedRedirect).toHaveBeenCalledWith('/auth/login');
  });
});
