import '@packages/environment';

import { prisma } from '@packages/db';
import type { Role } from '@packages/validators';

import { hashPassword } from './password';

/**
 * Seed data domain auth — idempotent: akun yang sudah ada di-skip (password
 * dibiarkan apa adanya, sesi yang hidup tidak disentuh). Hash scrypt memakai
 * `hashPassword` dari package ini (SSOT), sehingga akun seed pasti bisa login
 * via `POST /auth/login` (min. 8 karakter — selaras dengan Zod/DTO validators).
 *
 * Jalankan dari `packages/db`: `pnpm --filter @packages/db db:seed`
 * (`prisma db seed` → `node ../auth/dist/seed.js`).
 *
 * Catatan: seed sengaja ada di `@packages/auth` (bukan `@packages/db`) karena
 * db → auth akan membuat siklus task Turbo; arah `auth → db` sudah ada.
 */
type SeedAccount = {
  name: string;
  email: string;
  password: string;
  role: Role;
};

const ACCOUNTS: readonly SeedAccount[] = [
  {
    name: 'Admin Jajanah',
    email: 'admin@jajanah.local',
    password: 'admin123',
    role: 'ADMIN',
  },
  {
    name: 'User Demo',
    email: 'user@jajanah.local',
    password: 'user1234',
    role: 'USER',
  },
];

async function main(): Promise<void> {
  for (const account of ACCOUNTS) {
    const existing = await prisma.auth.findUnique({ where: { email: account.email } });

    if (existing) {
      // eslint-disable-next-line no-console -- CLI seed, output ke stdout
      console.log(
        `[seed] skip ${account.email} — sudah ada (password & sesi dibiarkan apa adanya)`,
      );
      continue;
    }

    const passwordHash = await hashPassword(account.password);
    const created = await prisma.auth.create({
      data: {
        name: account.name,
        email: account.email,
        password: passwordHash,
        role: account.role,
      },
    });

    // eslint-disable-next-line no-console -- CLI seed, output ke stdout
    console.log(`[seed] dibuat ${created.email} (role=${created.role})`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error('[seed] gagal:', error);
    await prisma.$disconnect().catch(() => undefined);
    process.exitCode = 1;
  });
