import { Injectable } from '@nestjs/common';
import { environment, getEnv } from '@packages/environment';
import type { HealthResponse } from '@packages/validators';

@Injectable()
export class AppService {
  getStatus(): HealthResponse {
    return {
      service: 'api',
      status: 'ok',
      mode: process.env.NODE_ENV ?? 'development',
      appName: environment.APP_NAME ?? null,
      baseUrl: getEnv('API_BASE_URL') ?? null,
    };
  }
}
