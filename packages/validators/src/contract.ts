import type { PaginationMeta, PaginationParams } from './types/common';

export interface ApiEnvelope<T> {
  data: T;
}

export interface PaginatedEnvelope<T> extends ApiEnvelope<T[]> {
  meta: PaginationMeta;
}

export interface ApiError {
  status: number;
  code: ApiErrorCode;
  message: string;
  details?: unknown;
}

export interface ApiErrorEnvelope {
  error: ApiError;
}

export const API_ERROR_CODES = [
  'BAD_REQUEST',
  'VALIDATION',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'INTERNAL',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export type ApiResponse<T> = ApiEnvelope<T> | PaginatedEnvelope<T> | ApiErrorEnvelope;

export const httpStatus = {
  ok: 200,
  created: 201,
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  internal: 500,
} as const;

export type HttpStatusCode = (typeof httpStatus)[keyof typeof httpStatus];

export const PAGINATION_DEFAULTS = { page: 1, limit: 20 } as const;

export function ok<T>(data: T): ApiEnvelope<T> {
  return { data };
}

export function paginated<T>(rows: T[], meta: PaginationMeta): PaginatedEnvelope<T> {
  return { data: rows, meta };
}

export function createPaginationMeta(params: PaginationParams = {}, total = 0): PaginationMeta {
  const page = params.page ?? PAGINATION_DEFAULTS.page;
  const limit = params.limit ?? PAGINATION_DEFAULTS.limit;
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
  };
}

export function apiError(
  status: HttpStatusCode,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
): ApiErrorEnvelope {
  const error: ApiError =
    details === undefined ? { status, code, message } : { status, code, message, details };

  return { error };
}

export function validationError(details?: unknown): ApiErrorEnvelope {
  return apiError(httpStatus.badRequest, 'VALIDATION', 'Validation failed', details);
}

export function notFoundError(message = 'Resource not found'): ApiErrorEnvelope {
  return apiError(httpStatus.notFound, 'NOT_FOUND', message);
}
