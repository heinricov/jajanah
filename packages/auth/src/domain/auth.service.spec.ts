jest.mock('@packages/db', () => ({
  prisma: {
    auth: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    session: { findUnique: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
  },
}));

import { randomUUID } from 'node:crypto';

import { authService } from './auth.service';
import { AuthError } from './errors';
import { hashPassword } from './password';
import { signSessionToken, verifySessionToken } from './token';

type AuthRow = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'USER' | 'ADMIN';
  lastLoginAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const { prisma } = jest.requireMock('@packages/db') as {
  prisma: {
    auth: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    session: { findUnique: jest.Mock; create: jest.Mock; deleteMany: jest.Mock };
  };
};

function makeRow(overrides: Partial<AuthRow> = {}): AuthRow {
  return {
    id: randomUUID(),
    name: 'Budi',
    email: 'budi@example.com',
    password: 'scrypt$16384$8$1$c2FsdA$aGFzaA',
    role: 'USER',
    lastLoginAt: null,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

async function captureError(promise: Promise<unknown>): Promise<AuthError> {
  try {
    await promise;
  } catch (error) {
    return error as AuthError;
  }
  throw new Error('Expected promise to reject');
}

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'auth-service-spec-secret';
    delete process.env.AUTH_SESSION_TTL_HOURS;
  });

  describe('register', () => {
    it('menolak email yang sudah terdaftar (409 EMAIL_TAKEN)', async () => {
      prisma.auth.findUnique.mockResolvedValue(makeRow());

      const error = await captureError(
        authService.register({ name: 'Budi', email: 'budi@example.com', password: 'password123' }),
      );

      expect(error).toBeInstanceOf(AuthError);
      expect(error.code).toBe('EMAIL_TAKEN');
      expect(error.status).toBe(409);
      expect(prisma.auth.create).not.toHaveBeenCalled();
    });

    it('membuat user baru dengan email ternormalisasi & password ter-hash', async () => {
      const row = makeRow();
      prisma.auth.findUnique.mockResolvedValue(null);
      prisma.auth.create.mockResolvedValue(row);

      const user = await authService.register({
        name: '  Budi  ',
        email: ' Budi@Example.COM ',
        password: 'password123',
      });

      const createArgs = prisma.auth.create.mock.calls[0]?.[0] as {
        data: { name: string; email: string; password: string; role: string };
      };
      expect(createArgs.data.email).toBe('budi@example.com');
      expect(createArgs.data.name).toBe('Budi');
      expect(createArgs.data.password).toMatch(/^scrypt\$/);
      expect(createArgs.data.password).not.toBe('password123');
      expect(createArgs.data.role).toBe('USER');

      expect(user.email).toBe('budi@example.com');
      expect(user).not.toHaveProperty('password');
    });

    it('menerjemahkan race unique constraint (P2002) ke EMAIL_TAKEN', async () => {
      prisma.auth.findUnique.mockResolvedValue(null);
      prisma.auth.create.mockRejectedValue({ code: 'P2002' });

      const error = await captureError(
        authService.register({ name: 'Budi', email: 'budi@example.com', password: 'password123' }),
      );

      expect(error).toBeInstanceOf(AuthError);
      expect(error.code).toBe('EMAIL_TAKEN');
    });
  });

  describe('login', () => {
    it('menolak password salah (401 INVALID_CREDENTIALS)', async () => {
      const row = makeRow({ password: await hashPassword('password123') });
      prisma.auth.findUnique.mockResolvedValue(row);

      const error = await captureError(
        authService.login({ email: row.email, password: 'password-salah' }),
      );

      expect(error).toBeInstanceOf(AuthError);
      expect(error.code).toBe('INVALID_CREDENTIALS');
      expect(error.status).toBe(401);
      expect(prisma.session.create).not.toHaveBeenCalled();
    });

    it('menolak email yang tidak terdaftar (401 INVALID_CREDENTIALS)', async () => {
      prisma.auth.findUnique.mockResolvedValue(null);

      const error = await captureError(
        authService.login({ email: 'tidakada@example.com', password: 'password123' }),
      );

      expect(error).toBeInstanceOf(AuthError);
      expect(error.code).toBe('INVALID_CREDENTIALS');
      expect(prisma.session.create).not.toHaveBeenCalled();
    });

    it('menolak akun non-aktif meski password benar', async () => {
      const row = makeRow({ password: await hashPassword('password123'), isActive: false });
      prisma.auth.findUnique.mockResolvedValue(row);

      const error = await captureError(
        authService.login({ email: row.email, password: 'password123' }),
      );

      expect(error).toBeInstanceOf(AuthError);
      expect(error.code).toBe('INVALID_CREDENTIALS');
      expect(prisma.session.create).not.toHaveBeenCalled();
    });

    it('login sukses — buat sesi, perbarui lastLoginAt, kirim token JWT', async () => {
      const row = makeRow({ password: await hashPassword('password123') });
      const updatedAt = new Date('2026-09-26T10:00:00.000Z');
      prisma.auth.findUnique.mockResolvedValue(row);
      prisma.auth.update.mockResolvedValue({ ...row, lastLoginAt: updatedAt, updatedAt });
      prisma.session.deleteMany.mockResolvedValue({ count: 0 });
      prisma.session.create.mockResolvedValue({ id: 'session-1' });

      const response = await authService.login(
        { email: row.email, password: 'password123' },
        { authAgent: 'jest-agent', ipAddress: '127.0.0.1' },
      );

      expect(response.token.split('.')).toHaveLength(3);
      expect(response.user.email).toBe(row.email);
      expect(response.user.lastLoginAt).toBe('2026-09-26T10:00:00.000Z');
      expect(new Date(response.expiresAt).getTime()).toBeGreaterThan(Date.now());

      const claims = verifySessionToken(response.token);
      expect(claims).not.toBeNull();

      const sessionArgs = prisma.session.create.mock.calls[0]?.[0] as {
        data: {
          authId: string;
          token: string;
          authAgent: string | null;
          ipAddress: string | null;
        };
      };
      expect(sessionArgs.data.authId).toBe(row.id);
      expect(sessionArgs.data.token).toBe(claims?.jti);
      expect(sessionArgs.data.authAgent).toBe('jest-agent');
      expect(sessionArgs.data.ipAddress).toBe('127.0.0.1');

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { authId: row.id, expiresAt: { lt: expect.any(Date) } },
      });
      expect(prisma.auth.update).toHaveBeenCalledWith({
        where: { id: row.id },
        data: { lastLoginAt: expect.any(Date) },
      });
    });
  });

  describe('logout', () => {
    it('menghapus sesi berdasar jti token yang valid', async () => {
      const token = signSessionToken({ sub: randomUUID(), role: 'USER', jti: 'jti-1' });

      await authService.logout(token);

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { token: 'jti-1' } });
    });

    it('menolak token rusak (401 UNAUTHORIZED)', async () => {
      const error = await captureError(authService.logout('bukan-jwt'));

      expect(error).toBeInstanceOf(AuthError);
      expect(error.code).toBe('UNAUTHORIZED');
      expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('authenticate', () => {
    it('mengembalikan AuthUser bila token & sesi valid', async () => {
      const row = makeRow();
      const token = signSessionToken({ sub: row.id, role: 'USER', jti: 'jti-ok' });
      prisma.session.findUnique.mockResolvedValue({
        id: 'session-1',
        authId: row.id,
        token: 'jti-ok',
        expiresAt: new Date(Date.now() + 60_000),
        auth: row,
      });

      const user = await authService.authenticate(token);

      expect(user.id).toBe(row.id);
      expect(user).not.toHaveProperty('password');
      expect(prisma.session.findUnique).toHaveBeenCalledWith({
        where: { token: 'jti-ok' },
        include: { auth: true },
      });
    });

    it('menolak token kedaluwarsa', async () => {
      const token = signSessionToken({ sub: randomUUID(), role: 'USER', ttlHours: -1 });

      const error = await captureError(authService.authenticate(token));

      expect(error).toBeInstanceOf(AuthError);
      expect(error.code).toBe('UNAUTHORIZED');
      expect(prisma.session.findUnique).not.toHaveBeenCalled();
    });

    it('menolak bila sesi sudah dihapus (logout)', async () => {
      const token = signSessionToken({ sub: randomUUID(), role: 'USER', jti: 'hilang' });
      prisma.session.findUnique.mockResolvedValue(null);

      const error = await captureError(authService.authenticate(token));

      expect(error).toBeInstanceOf(AuthError);
      expect(error.code).toBe('UNAUTHORIZED');
    });

    it('menolak bila sesi sudah kedaluwarsa di DB', async () => {
      const row = makeRow();
      const token = signSessionToken({ sub: row.id, role: 'USER', jti: 'jti-lama' });
      prisma.session.findUnique.mockResolvedValue({
        id: 'session-1',
        authId: row.id,
        token: 'jti-lama',
        expiresAt: new Date(Date.now() - 1000),
        auth: row,
      });

      const error = await captureError(authService.authenticate(token));

      expect(error).toBeInstanceOf(AuthError);
      expect(error.code).toBe('UNAUTHORIZED');
    });

    it('menolak bila akun dinonaktifkan', async () => {
      const row = makeRow({ isActive: false });
      const token = signSessionToken({ sub: row.id, role: 'USER', jti: 'jti-mati' });
      prisma.session.findUnique.mockResolvedValue({
        id: 'session-1',
        authId: row.id,
        token: 'jti-mati',
        expiresAt: new Date(Date.now() + 60_000),
        auth: row,
      });

      const error = await captureError(authService.authenticate(token));

      expect(error).toBeInstanceOf(AuthError);
      expect(error.code).toBe('UNAUTHORIZED');
    });
  });
});
