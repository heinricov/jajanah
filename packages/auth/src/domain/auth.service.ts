import { randomUUID } from 'node:crypto';

import { prisma } from '@packages/db';
import {
  authUserSchema,
  type AuthUser,
  type LoginRequest,
  type LoginResponse,
  type RegisterRequest,
  type Role,
} from '@packages/validators';

import { AuthError } from './errors';
import { hashPassword, verifyPassword } from './password';
import { getSessionTtlHours, signSessionToken, verifySessionToken } from './token';

export interface LoginContext {
  authAgent?: string | null;
  ipAddress?: string | null;
}

export interface OAuthLoginInput {
  /** Penyedia identitas — mis. `'google'`. */
  provider: string;
  /** ID stabil dari penyedia (Google `sub`). */
  providerId: string;
  /** Email ternormalisasi dari penyedia (wajib terverifikasi). */
  email: string;
  /** Nama tampilan dari penyedia (dipakai bila membuat akun baru). */
  name: string;
  /** Boolean `email_verified` dari ID token — ditolak bila false. */
  emailVerified: boolean;
}

type AuthRow = {
  id: string;
  name: string;
  email: string;
  password?: unknown;
  role: Role;
  lastLoginAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toAuthUser(row: AuthRow): AuthUser {
  return authUserSchema.parse({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  );
}

let dummyHashPromise: Promise<string> | undefined;

/**
 * Hash palsu agar verifikasi login dengan email yang tidak ada tetap
 * memakan waktu scrypt yang sama (anti timing oracle).
 */
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword(randomUUID());
  return dummyHashPromise;
}

export class AuthService {
  /**
   * Buat sesi: sign JWT (jti → kolom Session.token), perbarui lastLoginAt,
   * bersihkan sesi kedaluwarsa. Dipakai `login` (password) & `oauthLogin`.
   */
  private async createSession(auth: AuthRow, context: LoginContext): Promise<LoginResponse> {
    const ttlHours = getSessionTtlHours();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlHours * 3600 * 1000);
    const jti = randomUUID();
    const token = signSessionToken({ sub: auth.id, role: auth.role, ttlHours, jti });

    const updated = await prisma.auth.update({
      where: { id: auth.id },
      data: { lastLoginAt: now },
    });
    await prisma.session.deleteMany({
      where: { authId: auth.id, expiresAt: { lt: now } },
    });
    await prisma.session.create({
      data: {
        authId: auth.id,
        token: jti,
        expiresAt,
        authAgent: context.authAgent ?? null,
        ipAddress: context.ipAddress ?? null,
      },
    });

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      user: toAuthUser(updated),
    };
  }

  async register(input: RegisterRequest): Promise<AuthUser> {
    const email = normalizeEmail(input.email);
    const existing = await prisma.auth.findUnique({ where: { email } });
    if (existing) throw new AuthError('EMAIL_TAKEN', 'Email is already registered');

    const password = await hashPassword(input.password);
    try {
      const row = await prisma.auth.create({
        data: { name: input.name.trim(), email, password, role: 'USER' },
      });
      return toAuthUser(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AuthError('EMAIL_TAKEN', 'Email is already registered');
      }
      throw error;
    }
  }

  async login(input: LoginRequest, context: LoginContext = {}): Promise<LoginResponse> {
    const email = normalizeEmail(input.email);
    const user = await prisma.auth.findUnique({ where: { email } });

    const storedHash = user?.password ?? (await getDummyHash());
    const passwordOk = await verifyPassword(input.password, storedHash);
    if (!user || !passwordOk || !user.isActive) {
      throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
    }

    return this.createSession(user, context);
  }

  /**
   * Login/register lewat penyedia identitas (OAuth) — find-or-create + link
   * otomatis:
   *
   * - `(provider, providerId)` sudah ter-link → masuk ke akun tersebut (email
   *   Google boleh berubah, sub-lah yang stabil).
   * - belum ter-link tapi email sudah ada akun → link (akun password tetap
   *   bisa dipakai paralel).
   * - email baru → buat akun `password: null`, role USER.
   */
  async oauthLogin(input: OAuthLoginInput, context: LoginContext = {}): Promise<LoginResponse> {
    if (!input.emailVerified) {
      throw new AuthError('OAUTH_EMAIL_UNVERIFIED', 'Google account email is not verified');
    }

    const email = normalizeEmail(input.email);
    const provider = input.provider.trim().toLowerCase();
    if (!provider || !input.providerId) {
      throw new AuthError('INVALID_CREDENTIALS', 'Invalid OAuth identity');
    }

    const account = await prisma.oAuthAccount.findUnique({
      where: { provider_providerId: { provider, providerId: input.providerId } },
      include: { auth: true },
    });

    let auth: AuthRow | null = account ? account.auth : null;
    if (!auth) {
      auth = await prisma.auth.findUnique({ where: { email } });
      if (auth) {
        try {
          await prisma.oAuthAccount.create({
            data: { provider, providerId: input.providerId, email, authId: auth.id },
          });
        } catch (error) {
          if (isUniqueViolation(error)) {
            throw new AuthError(
              'OAUTH_ACCOUNT_LINKED',
              'This Google account is linked to another user',
            );
          }
          throw error;
        }
      }
    }

    if (!auth) {
      let created: AuthRow;
      try {
        created = await prisma.auth.create({
          data: { name: input.name.trim() || email, email, password: null, role: 'USER' },
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          // Race: email baru saja dibuat (mis. submit ganda) — coba lagi sekali.
          const raced = await prisma.auth.findUnique({ where: { email } });
          if (!raced) throw new AuthError('EMAIL_TAKEN', 'Email is already registered');
          created = raced;
        } else {
          throw error;
        }
      }
      auth = created;
      try {
        await prisma.oAuthAccount.create({
          data: { provider, providerId: input.providerId, email, authId: auth.id },
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AuthError(
            'OAUTH_ACCOUNT_LINKED',
            'This Google account is linked to another user',
          );
        }
        throw error;
      }
    }

    if (!auth.isActive) throw new AuthError('UNAUTHORIZED', 'Account is disabled');

    return this.createSession(auth, context);
  }

  async logout(token: string): Promise<void> {
    const claims = verifySessionToken(token);
    if (!claims) throw new AuthError('UNAUTHORIZED', 'Invalid or expired session token');
    await prisma.session.deleteMany({ where: { token: claims.jti } });
  }

  async authenticate(token: string): Promise<AuthUser> {
    const claims = verifySessionToken(token);
    if (!claims) throw new AuthError('UNAUTHORIZED', 'Invalid or expired session token');

    const session = await prisma.session.findUnique({
      where: { token: claims.jti },
      include: { auth: true },
    });
    if (!session || session.expiresAt.getTime() <= Date.now()) {
      throw new AuthError('UNAUTHORIZED', 'Session is invalid or expired');
    }
    if (!session.auth.isActive) throw new AuthError('UNAUTHORIZED', 'Account is disabled');

    return toAuthUser(session.auth);
  }
}

export const authService = new AuthService();
