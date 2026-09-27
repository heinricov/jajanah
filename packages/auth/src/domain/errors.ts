import { httpStatus } from '@packages/validators';

export type AuthErrorCode = 'EMAIL_TAKEN' | 'INVALID_CREDENTIALS' | 'UNAUTHORIZED';

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
    this.status = code === 'EMAIL_TAKEN' ? httpStatus.conflict : httpStatus.unauthorized;
  }
}
