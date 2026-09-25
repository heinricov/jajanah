import { z } from 'zod';

import type { PaginationMeta, PaginationParams } from '../types/common';

export const paginationParamsSchema: z.ZodType<PaginationParams> = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const paginationMetaSchema: z.ZodType<PaginationMeta> = z.object({
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
  hasNext: z.boolean(),
  hasPrevious: z.boolean(),
});
