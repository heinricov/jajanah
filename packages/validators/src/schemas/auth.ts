import { z } from 'zod';

import type { AuthUser, LoginRequest, LoginResponse, RegisterRequest, Role } from '../types/auth';

export const roleSchema: z.ZodType<Role> = z.enum(['USER', 'ADMIN']);

export const registerRequestSchema: z.ZodType<RegisterRequest> = z.object({
  name: z.string().min(2).max(120),
  email: z.email().max(254),
  password: z.string().min(8).max(128),
});

export const loginRequestSchema: z.ZodType<LoginRequest> = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(128),
});

export const authUserSchema: z.ZodType<AuthUser> = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  role: roleSchema,
  lastLoginAt: z.iso.datetime().nullable(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const loginResponseSchema: z.ZodType<LoginResponse> = z.object({
  token: z.string().min(1),
  expiresAt: z.iso.datetime(),
  user: authUserSchema,
});
