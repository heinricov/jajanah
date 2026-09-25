import 'reflect-metadata';
import '@packages/environment';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createRequestLogger } from '@packages/logger';

import { AppModule } from './app.module';
import { logger, nestLogger } from './logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useLogger(nestLogger);
  app.use(createRequestLogger({ logger }));
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  const port = Number(process.env.API_PORT ?? 3002);
  await app.listen(port);
  logger.info(`listening on http://localhost:${port}`, { component: 'bootstrap' });
}

bootstrap();
