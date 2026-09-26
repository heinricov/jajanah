jest.mock('@packages/db', () => ({ prisma: {} }));
jest.mock('@packages/auth', () => ({
  authService: { authenticate: jest.fn() },
}));

import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { authService } from '@packages/auth';

import { AuthGuard } from './auth.guard';

function makeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  const guard = new AuthGuard();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('menolak request tanpa header Authorization (401 UNAUTHORIZED)', async () => {
    const context = makeContext({ headers: {} });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authService.authenticate).not.toHaveBeenCalled();
  });

  it('menolak skema selain Bearer', async () => {
    const context = makeContext({ headers: { authorization: 'Basic dXNlcjpwYXNz' } });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authService.authenticate).not.toHaveBeenCalled();
  });

  it('memverifikasi token dan attach user + authToken ke request', async () => {
    const user = { id: 'user-1' };
    (authService.authenticate as jest.Mock).mockResolvedValue(user);
    const request: Record<string, unknown> = {
      headers: { authorization: 'Bearer token-sah' },
    };

    const result = await guard.canActivate(makeContext(request));

    expect(result).toBe(true);
    expect(authService.authenticate).toHaveBeenCalledWith('token-sah');
    expect(request.user).toBe(user);
    expect(request.authToken).toBe('token-sah');
  });

  it('meneruskan error dari authService.authenticate (ditangani exception filter)', async () => {
    const failure = new Error('session expired');
    (authService.authenticate as jest.Mock).mockRejectedValue(failure);
    const context = makeContext({ headers: { authorization: 'Bearer token-mati' } });

    await expect(guard.canActivate(context)).rejects.toBe(failure);
  });
});
