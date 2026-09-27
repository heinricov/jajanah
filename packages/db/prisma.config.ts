import '@packages/environment';

import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // Seed berada di @packages/auth (domain pemilik data Auth) — path relatif
    // dari cwd package ini. Sumber: packages/auth/src/domain/seed.ts.
    seed: 'node ../auth/dist/domain/seed.js',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
