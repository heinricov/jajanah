import { Injectable } from '@nestjs/common';
import { environment, getEnv } from '@packages/environment';

@Injectable()
export class AppService {
  getStatus() {
    return {
      service: 'api',
      status: 'ok' as const,
      mode: process.env.NODE_ENV ?? 'development',
      appName: environment.APP_NAME ?? null,
      baseUrl: getEnv('API_BASE_URL') ?? null,
    };
  }
}
