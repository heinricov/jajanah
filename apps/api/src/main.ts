import 'reflect-metadata';
import '@packages/environment';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.API_PORT ?? 3002);
  await app.listen(port);
  Logger.log(`listening on http://localhost:${port}`, 'Bootstrap');
}

bootstrap();
