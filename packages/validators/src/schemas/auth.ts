import { z } from 'zod';

import type {
  AuthUser,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  ResetPasswordRequest,
  Role,
} from '../types/auth';

export const roleSchema: z.ZodType<Role> = z.enum(['USER', 'ADMIN']);

/**
 * URL gambar untuk avatar — hanya `http(s)` (tolak `javascript:`/`data:`/
 * `ftp:` yang bisa lolos `z.url()`) dan maks 2048 karakter.
 * Cek skema pakai regex (bukan `new URL`) supaya package ini tetap aman
 * dipakai di browser tanpa lib node.
 * Dipakai `authUserSchema.image` (dan domain untuk menulis `Auth.image`).
 */
export const imageUrlSchema: z.ZodType<string> = z
  .url()
  .max(2048)
  .refine((value) => /^https?:\/\//i.test(value));

export const registerRequestSchema: z.ZodType<RegisterRequest> = z.object({
  name: z.string().min(2).max(120),
  email: z.email().max(254),
  password: z.string().min(8).max(128),
});

export const loginRequestSchema: z.ZodType<LoginRequest> = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(128),
});

export const resetPasswordRequestSchema: z.ZodType<ResetPasswordRequest> = z.object({
  // base64url 32 byte = 43 karakter; batas atas menahan input liar dari query.
  token: z.string().min(1).max(256),
  password: z.string().min(8).max(128),
});

export const authUserSchema: z.ZodType<AuthUser> = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  /** Foto profil (OAuth) — null = tampilkan inisial. */
  image: imageUrlSchema.nullable(),
  role: roleSchema,
  lastLoginAt: z.iso.datetime().nullable(),
  isActive: z.boolean(),
  emailVerified: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const loginResponseSchema: z.ZodType<LoginResponse> = z.object({
  token: z.string().min(1),
  expiresAt: z.iso.datetime(),
  user: authUserSchema,
});
