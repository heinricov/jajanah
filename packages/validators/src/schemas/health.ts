import { z } from 'zod';

import type { HealthResponse } from '../types/health';

export const healthResponseSchema: z.ZodType<HealthResponse> = z.object({
  service: z.string(),
  status: z.literal('ok'),
  mode: z.string(),
  appName: z.string().nullable(),
  baseUrl: z.string().nullable(),
});
