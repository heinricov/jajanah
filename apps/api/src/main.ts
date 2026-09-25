import 'reflect-metadata';
import '@packages/environment';

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  const port = Number(process.env.API_PORT ?? 3002);
  await app.listen(port);
  Logger.log(`listening on http://localhost:${port}`, 'Bootstrap');
}

bootstrap();
