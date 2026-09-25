import { z } from 'zod';

import { API_ERROR_CODES, type ApiError, type ApiErrorEnvelope } from '../contract';

export const apiErrorSchema: z.ZodType<ApiError> = z.object({
  status: z.number().int(),
  code: z.enum(API_ERROR_CODES),
  message: z.string(),
  details: z.unknown().optional(),
});

export const apiErrorEnvelopeSchema: z.ZodType<ApiErrorEnvelope> = z.object({
  error: apiErrorSchema,
});
