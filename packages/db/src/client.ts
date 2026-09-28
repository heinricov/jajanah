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

let instance: DbClient | undefined;

function getClient(): DbClient {
  instance ??= createPrisma();
  return instance;
}

/**
 * Lazy proxy — client dibuat saat pertama kali diakses, bukan saat module
 * di-import. Import aman tanpa `DATABASE_URL` (mis. `next build` di CI yang
 * hanya mengumpulkan page data); pesan error yang sama tetap muncul pada
 * query pertama bila env kosong.
 */
export const prisma: DbClient = new Proxy({} as DbClient, {
  get: (_target, property) => {
    const client = getClient();
    const value = Reflect.get(client, property, client);
    return typeof value === 'function' ? value.bind(client) : value;
  },
  set: (_target, property, value) => Reflect.set(getClient(), property, value),
  has: (_target, property) => Reflect.has(getClient(), property),
});
