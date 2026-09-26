import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@packages/validators';

interface AuthedRequest {
  user?: AuthUser;
  authToken?: string;
}

/** Argumen handler: user yang sudah diverifikasi AuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser | undefined =>
    context.switchToHttp().getRequest<AuthedRequest>().user,
);

/** Argumen handler: token JWT mentah dari header Authorization. */
export const AuthToken = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined =>
    context.switchToHttp().getRequest<AuthedRequest>().authToken,
);
