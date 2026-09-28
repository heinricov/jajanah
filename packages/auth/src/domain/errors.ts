import { httpStatus } from '@packages/validators';

export type AuthErrorCode =
  | 'EMAIL_TAKEN'
  | 'INVALID_CREDENTIALS'
  | 'UNAUTHORIZED'
  | 'OAUTH_ACCOUNT_LINKED'
  | 'OAUTH_EMAIL_UNVERIFIED';

/**
 * Error domain auth — membawa `code` dari `API_ERROR_CODES` + status HTTP.
 * Diterjemahkan oleh exception filter `apps/api` ke envelope `{ error }`.
 */
export class AuthError extends Error {
  readonly status: number;

  constructor(
    readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
    this.status =
      code === 'EMAIL_TAKEN' || code === 'OAUTH_ACCOUNT_LINKED'
        ? httpStatus.conflict
        : code === 'OAUTH_EMAIL_UNVERIFIED'
          ? httpStatus.badRequest
          : httpStatus.unauthorized;
  }
}
