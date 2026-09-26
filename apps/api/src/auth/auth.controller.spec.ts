jest.mock('@packages/db', () => ({ prisma: {} }));
jest.mock('@packages/auth', () => ({
  authService: { register: jest.fn(), login: jest.fn(), logout: jest.fn() },
}));

import type { Request } from 'express';
import { authService } from '@packages/auth';
import { authUserSchema, type AuthUser, type LoginResponse } from '@packages/validators';

import { AuthController } from './auth.controller';

const authUser: AuthUser = {
  id: '3f1d3f2e-1c5a-4b7e-9d2a-8f6b5c4e3a21',
  name: 'Budi',
  email: 'budi@example.com',
  role: 'USER',
  lastLoginAt: null,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const loginResponse: LoginResponse = {
  token: 'header.payload.signature',
  expiresAt: '2026-09-03T00:00:00.000Z',
  user: authUser,
};

describe('AuthController', () => {
  const controller = new AuthController();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('mengembalikan envelope { data: AuthUser } tanpa password', async () => {
      (authService.register as jest.Mock).mockResolvedValue(authUser);

      const envelope = await controller.register({
        name: 'Budi',
        email: 'budi@example.com',
        password: 'password123',
      });

      expect(authUserSchema.safeParse(envelope.data).success).toBe(true);
      expect(envelope.data).not.toHaveProperty('password');
      expect(authService.register).toHaveBeenCalledWith({
        name: 'Budi',
        email: 'budi@example.com',
        password: 'password123',
      });
    });
  });

  describe('login', () => {
    it('meneruskan authAgent & ipAddress dari request ke service', async () => {
      (authService.login as jest.Mock).mockResolvedValue(loginResponse);
      const request = {
        headers: { 'user-agent': 'jest-agent' },
        ip: '127.0.0.1',
      } as unknown as Request & { user?: AuthUser; authToken?: string };

      const envelope = await controller.login(
        { email: 'budi@example.com', password: 'password123' },
        request,
      );

      expect(envelope.data.token).toBe(loginResponse.token);
      expect(envelope.data.user.email).toBe(authUser.email);
      expect(authService.login).toHaveBeenCalledWith(
        { email: 'budi@example.com', password: 'password123' },
        { authAgent: 'jest-agent', ipAddress: '127.0.0.1' },
      );
    });
  });

  describe('logout', () => {
    it('memanggil service.logout dengan token dari guard', async () => {
      (authService.logout as jest.Mock).mockResolvedValue(undefined);

      const envelope = await controller.logout('token-terpasang');

      expect(envelope).toEqual({ data: null });
      expect(authService.logout).toHaveBeenCalledWith('token-terpasang');
    });
  });

  describe('me', () => {
    it('mengembalikan user terautentikasi tervalidasi schema', () => {
      const envelope = controller.me(authUser);

      expect(authUserSchema.safeParse(envelope.data).success).toBe(true);
      expect(envelope.data.id).toBe(authUser.id);
    });
  });
});
