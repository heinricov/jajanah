# @packages/db

Akses database PostgreSQL monorepo via [Prisma ORM 7](https://www.prisma.io) (Vercel Prisma Postgres). Paket ini adalah **satu-satunya** tempat konfigurasi Prisma, schema, dan klien DB didefinisikan — app lain cukup `import { prisma } from '@packages/db'`.

## Prinsip SSOT

- **Env**: `prisma.config.ts` dan `src/client.ts` meng-import `@packages/environment`, sehingga `DATABASE_URL` dibaca dari file `.env*` **root repo** (satu sumber dengan app lain). Prisma 7 tidak lagi auto-load `.env` — jangan tambahkan `.env` lokal di package ini.
- **Konfigurasi**: `tsconfig.json` extend `@configs/typescript/node.json`, `eslint.config.mjs` re-export `@configs/eslint/node` — tanpa compilerOptions/rule duplikat.
- **Schema**: `prisma/schema.prisma` hanya deklarasi `datasource` (provider) + `generator` + model (`enum Role`, `Auth`, `Session`); URL koneksi **tidak** ada di schema (Prisma 7 memindahkannya ke `prisma.config.ts`).
- **Generated client**: output ke `src/generated/prisma/` (di-ignore `.gitignore` & `.prettierignore`) — jangan di-commit atau di-edit manual.

## Struktur

```
packages/db/
├── prisma.config.ts        # konfigurasi Prisma CLI (datasource.url ← DATABASE_URL root .env)
├── prisma/
│   ├── schema.prisma       # enum Role + model Auth & Session (domain auth)
│   └── migrations/         # migration versioned (`migrate dev` / `migrate:deploy`)
├── src/
│   ├── index.ts            # entry: export { prisma, createPrisma, PrismaClient }
│   ├── client.ts           # adapter @prisma/adapter-pg + singleton PrismaClient
│   └── generated/prisma/   # hasil `prisma generate` (gitignored)
├── tsconfig.json           # typecheck (extends @configs/typescript/node.json)
├── tsconfig.build.json     # emit ke dist/ (di-consume app via exports map)
└── eslint.config.mjs       # re-export @configs/eslint/node
```

## Pemakaian

```ts
import { prisma, createPrisma } from '@packages/db';

// singleton (env sudah termuat via @packages/environment)
await prisma.$queryRaw`SELECT 1`;

// atau instance terpisah dengan kustomisasi
const db = createPrisma(process.env.DATABASE_URL);
```

Menambahkan dependency workspace di app:

```json
{
  "dependencies": {
    "@packages/db": "workspace:*"
  }
}
```

## Model

| Model     | Field                                                                                                                                                                               |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Auth`    | `id` (uuid) · `name` · `email` (unique) · `password` · `role` (`Role` enum, default `USER`) · `lastLoginAt?` · `isActive` · `createdAt` · `updatedAt` — relasi `sessions Session[]` |
| `Session` | `id` (uuid) · `authId` (uuid, FK → `Auth`, cascade delete) · `token` (unique — menyimpan `jti` JWT) · `expiresAt` · `authAgent?` · `ipAddress?` · `createdAt`                       |

`enum Role { USER ADMIN }` — nilai tipe di-SSOT-kan dengan `Role` di `@packages/validators` (interface `AuthUser`). Logika di atas model ini hidup di [`@packages/auth`](../auth/README.md).

## Menambah model

1. Definisikan model di `prisma/schema.prisma` (mis. `model User { ... }`).
2. `pnpm --filter @packages/db migrate` — buat migration + update client (butuh `DATABASE_URL` valid).
3. `pnpm --filter @packages/db build` — regenerate & kompilasi ke `dist/`.
4. Konsumen tinggal `import { prisma } from '@packages/db'`.

## Perintah

| Perintah                                    | Deskripsi                                  |
| ------------------------------------------- | ------------------------------------------ |
| `pnpm --filter @packages/db generate`       | Generate Prisma Client ke `src/generated/` |
| `pnpm --filter @packages/db migrate`        | Buat/jalankan migration (`migrate dev`)    |
| `pnpm --filter @packages/db migrate:deploy` | Jalankan migration di environment lain     |
| `pnpm --filter @packages/db db:push`        | Push schema tanpa migration (prototyping)  |
| `pnpm --filter @packages/db studio`         | Prisma Studio (GUI)                        |
| `pnpm --filter @packages/db lint`           | ESLint (`@configs/eslint/node`)            |
| `pnpm --filter @packages/db typecheck`      | `tsc --noEmit` (generate dulu)             |
| `pnpm --filter @packages/db build`          | Generate + compile ke `dist/`              |

## Catatan

- **Prisma 7** membutuhkan _driver adapter_: klien dibuat via `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })` — sudah dibungkus `createPrisma()`.
- `prisma.config.ts` memuat env dari root `.env*` via `@packages/environment`; `datasource.url` memakai `DATABASE_URL`. Variabel `POSTGRES_URL` / `PRISMA_DATABASE_URL` tersedia untuk tooling lain (semua ada di `.env.example`).
- Kredensial database **hanya** di `.env` (gitignored) — `.env.example` cukup placeholder.
