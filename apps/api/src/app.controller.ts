import { Controller, Get } from '@nestjs/common';
import {
  healthResponseSchema,
  ok,
  type ApiEnvelope,
  type HealthResponse,
} from '@packages/validators';

import { AppService } from './app.service';
import { logger } from './logger';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getStatus(): ApiEnvelope<HealthResponse> {
    logger.info('serving status');
    return ok(healthResponseSchema.parse(this.appService.getStatus()));
  }
}
