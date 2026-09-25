import '@packages/environment';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/prisma/client';

export type DbClient = PrismaClient;

export function createPrisma(connectionString: string = process.env.DATABASE_URL ?? ''): DbClient {
  if (!connectionString) {
    throw new Error('[db] Missing DATABASE_URL. Define it in a root .env file (see .env.example).');
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const prisma: DbClient = createPrisma();
