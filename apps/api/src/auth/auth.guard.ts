import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { authService } from '@packages/auth';
import { updateContext } from '@packages/logger';

interface AuthedRequest {
  headers: { authorization?: string | undefined };
  user?: unknown;
  authToken?: string;
}

/** Wajib `Authorization: Bearer <JWT>` — attach `user` + `authToken` ke request. */
@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const header = request.headers.authorization;
    const token =
      header !== undefined && header.startsWith('Bearer ') ? header.slice(7).trim() : '';

    if (token.length === 0) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Missing bearer token',
      });
    }

    const user = await authService.authenticate(token);
    request.user = user;
    request.authToken = token;
    updateContext({ userId: user.id });
    return true;
  }
}
