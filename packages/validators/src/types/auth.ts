export type Role = 'USER' | 'ADMIN';

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/** Tukar token reset password (`/auth/forgot-password/new-password`) → password baru. */
export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  /** Foto profil dari OAuth (`Auth.image`) — null = tampilkan inisial. */
  image: string | null;
  role: Role;
  lastLoginAt: string | null;
  isActive: boolean;
  /** true bila konfirmasi email pertama sudah selesai (`Auth.emailVerifiedAt`). */
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  user: AuthUser;
}
