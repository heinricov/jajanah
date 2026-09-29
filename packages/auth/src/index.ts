export { authService, AuthService, type LoginContext } from './domain/auth.service';
export { AuthError, type AuthErrorCode } from './domain/errors';
export {
  hashPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  verifyPassword,
} from './domain/password';
export {
  DEFAULT_RESET_TTL_HOURS,
  DEFAULT_SESSION_TTL_HOURS,
  DEFAULT_VERIFY_TTL_HOURS,
  getResetTtlHours,
  getSessionTtlHours,
  getVerifyTtlHours,
  signSessionToken,
  verifySessionToken,
  type SessionTokenClaims,
  type SignSessionTokenInput,
} from './domain/token';
