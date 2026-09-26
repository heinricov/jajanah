# jajanah

Monorepo yang dibangun dengan [Turborepo](https://turborepo.com) + [pnpm workspaces](https://pnpm.io/workspaces), dengan prinsip **SSOT** (Single Source of Truth): konfigurasi TypeScript, ESLint, dan Prettier didefinisikan **sekali** di folder `configs/` lalu di-consume semua workspace.

## Struktur

```
.
├── apps/
│   ├── web/               # Next.js 16 — situs web (port 3000)
│   ├── admin/             # Next.js 16 — panel admin (port 3001)
│   └── api/               # NestJS 11 — REST API (port 3002)
├── packages/
│   ├── ui/                # @packages/ui — komponen shadcn/ui + Tailwind v4
│   ├── environment/       # @packages/environment — loader .env (SSOT env)
│   ├── db/                # @packages/db — Prisma ORM 7 (PostgreSQL)
│   ├── validators/        # @packages/validators — SSOT types + kontrak request/response API
│   ├── auth/              # @packages/auth — SSOT domain auth (scrypt, JWT sesi, register/login/logout)
│   ├── client/            # @packages/client — typed API client (satu-satunya jalur web → api)
│   └── logger/            # @packages/logger — structured logger + request context (AsyncLocalStorage)
├── scripts/              # Script operasional (masih kosong)
├── configs/
│   ├── typescript/       # @configs/typescript — preset tsconfig (base/node/nest/react)
│   ├── eslint/           # @configs/eslint — preset flat config (base/node/nest/react/next)
│   ├── next/             # @configs/next — konfigurasi Next.js bersama (+ auto-load env)
│   └── prettier/         # @configs/prettier — 1-satunya config prettier
├── .env.example          # Dokumentasi variabel env (nilai di .env*, gitignored)
├── .github/workflows/    # CI pipeline
├── turbo.json            # Task graph & caching
└── pnpm-workspace.yaml   # Daftar workspace
```

## Perintah

| Perintah            | Deskripsi                                        |
| ------------------- | ------------------------------------------------ |
| `pnpm install`      | Install semua dependency workspace               |
| `pnpm build`        | Build semua workspace (urut topologis via Turbo) |
| `pnpm dev`          | Jalankan task `dev` semua workspace              |
| `pnpm lint`         | Lint semua workspace + root                      |
| `pnpm typecheck`    | Type-check semua workspace                       |
| `pnpm test`         | Jalankan unit test semua workspace (Jest)        |
| `pnpm check`        | Lint + typecheck sekaligus                       |
| `pnpm format`       | Format seluruh kode dengan Prettier              |
| `pnpm format:check` | Cek format tanpa menulis (dipakai di CI)         |

## Konfigurasi bersama (SSOT)

Jangan pernah meng-copy konfigurasi antar workspace. Selalu **extend/import** dari `configs/`:

### TypeScript

```jsonc
// tsconfig.json di app/package
{
  "extends": "@configs/typescript/base.json", // atau node.json / react.json
  "compilerOptions": {
    // hanya override yang berbeda dari preset
  },
}
```

| Preset                             | Untuk                                                                |
| ---------------------------------- | -------------------------------------------------------------------- |
| `@configs/typescript/base.json`    | Default (ESNext + bundler resolution)                                |
| `@configs/typescript/browser.json` | Isomorphic lib yang menyentuh DOM (`fetch`, `URL`) — base + lib DOM  |
| `@configs/typescript/node.json`    | CLI / backend Node.js (`NodeNext` + `@types/node`)                   |
| `@configs/typescript/nest.json`    | Backend NestJS (`node.json` + decorator metadata, output ke `dist/`) |
| `@configs/typescript/react.json`   | Frontend React (`jsx: react-jsx` + DOM lib)                          |

### ESLint

```js
// eslint.config.js di app/package
import node from '@configs/eslint/node';

export default [...node];
```

| Preset                  | Untuk                                                  |
| ----------------------- | ------------------------------------------------------ |
| `@configs/eslint/base`  | JS/TS + `typescript-eslint` + `eslint-config-prettier` |
| `@configs/eslint/node`  | `base` + global Node.js                                |
| `@configs/eslint/nest`  | `node` + global Jest (untuk file test NestJS)          |
| `@configs/eslint/react` | `base` + global browser + `eslint-plugin-react-hooks`  |
| `@configs/eslint/next`  | `react` + `eslint-config-next/core-web-vitals`         |

### Next.js

```ts
// next.config.mts di app Next.js
import { nextConfig } from '@configs/next';

export default nextConfig;
```

`@configs/next` menyiapkan `transpilePackages: ['@packages/ui']` dan `reactStrictMode` — semua app Next.js cukup re-export. Opsional: tambahkan konfigurasi khusus app sebagai object spread di atasnya. Config ini juga meng-import `@packages/environment`, sehingga setiap app Next.js **otomatis** memuat file `.env*` root (lihat section Environment). Package ini juga menyediakan bin **`next-app`** — launcher `next dev`/`next start` yang menyetel `process.env.PORT` dari variabel port di root `.env` (dipakai script `dev`/`start` kedua app).

### Prettier

Tidak ada `.prettierrc` di root maupun workspace. Root `package.json` menunjuk langsung ke `@configs/prettier` — ubah konfigurasi hanya di `configs/prettier/index.js`.

## UI package (shadcn/ui)

`packages/ui` (`@packages/ui`) berisi komponen [shadcn/ui](https://ui.shadcn.com) dengan Tailwind CSS v4 — Radix basis, preset Nova, base color neutral, ikon lucide. Konfigurasi paket ini memakai preset dari `configs/` (`@configs/typescript/react.json` + `@configs/eslint/react`), CSS theme hidup di `packages/ui/src/styles/globals.css`, dan `postcss.config.mjs` di-reexport oleh app (SSOT).

```bash
# tambah komponen
pnpm dlx shadcn@latest add dialog -c packages/ui

# dari app Next.js
import { Button } from '@packages/ui/components/button';
import '@packages/ui/globals.css';
```

Detail lengkap (integrasi Next.js, exports map, aturan components.json): lihat [`packages/ui/README.md`](packages/ui/README.md).

## Environment (SSOT)

Nilai environment hidup **hanya di root repo**: `.env`, `.env.development`, `.env.test`, `.env.production` (+ varian `.local` yang di-gitignore; `.env.example` di-commit sebagai dokumentasi). Loader `@packages/environment` membacanya dari root (walk-up via `pnpm-workspace.yaml`), jadi berlaku untuk konsumen di folder mana pun — apps, packages, scripts.

```js
// Konsumen non-Next (scripts/, tooling) — tambah dependency workspace dulu:
import '@packages/environment'; // side-effect: isi process.env dari .env* root

import { getEnv, requireEnv, environment } from '@packages/environment';
```

- **App Next.js tidak perlu apa-apa** — `@configs/next` sudah meng-import package ini; `NEXT_PUBLIC_*` otomatis ter-inline saat build.
- **App NestJS (`apps/api`)** meng-import package ini sekali di `main.ts` sebelum bootstrap; endpoint membaca env lewat `environment` / `getEnv`.
- **Port server** juga hidup di sini: `WEB_PORT`, `ADMIN_PORT`, `API_PORT`. Next.js dibaca lewat bin `next-app` (`@configs/next`), API lewat `process.env.API_PORT`; shell tetap bisa override (precedence menang).
- **Base URL API client**: `NEXT_PUBLIC_API_URL` (di-inline Next ke bundle; dev = `http://localhost:3002` via `.env.development`, dasar = URL publik). Berbeda dari `API_BASE_URL` — alamat yang dilaporkan API tentang dirinya sendiri (field `baseUrl` di `GET /`).
- **Logging backend**: `LOG_LEVEL` (`debug|info|warn|error`) & `LOG_FORMAT` (`json|pretty`) — dibaca `apps/api` via `getEnv` untuk `@packages/logger`. Default: info/json (prod), debug/pretty (dev), error (test via `.env.test`).
- **Auth sesi**: `JWT_SECRET` (tanda tangan JWT HS256 — wajib; buat baru `openssl rand -base64 48`) & `AUTH_SESSION_TTL_HOURS` (umur sesi jam, default 168) — dibaca `@packages/auth` lazily. Nilai asli hanya di `.env` (gitignored), `.env.example` cukup placeholder.
- **Koneksi database**: `DATABASE_URL`, `POSTGRES_URL`, `PRISMA_DATABASE_URL` (nilainya sama). Dibaca `@packages/db` via `prisma.config.ts` yang meng-import `@packages/environment` — sama seperti consumer lain, Prisma tidak punya loader `.env` sendiri.
- Precedence: `.env` → `.env.<mode>` → `.env.local` → `.env.<mode>.local` (yang belakangan menang); variabel yang sudah ada di `process.env` (shell/CI) **selalu** menang.
- Mode mengikuti `NODE_ENV` (default `development`).

Detail lengkap (precedence, API `getEnv`/`requireEnv`/`environment`, cara menambah variabel): lihat [`packages/environment/README.md`](packages/environment/README.md).

## Database (Prisma)

`packages/db` (`@packages/db`) adalah paket database tunggal: Prisma ORM 7 + PostgreSQL (driver adapter `@prisma/adapter-pg`). Schema (`prisma/schema.prisma`) berisi `enum Role` + model `Auth` & `Session` (migration versioned di `prisma/migrations/`), URL koneksi hidup di `prisma.config.ts` (dibaca dari `DATABASE_URL` root `.env` lewat `@packages/environment`), dan client hasil `generate` output ke `src/generated/prisma/` (di-gitignore). Konsumen cukup:

```ts
import { prisma } from '@packages/db';
```

Perintah: `pnpm --filter @packages/db migrate|db:push|studio|generate`. Detail lengkap (struktur, cara menambah model): lihat [`packages/db/README.md`](packages/db/README.md).

## API Contracts (`@packages/validators`)

`packages/validators` adalah SSOT untuk **types/interface + bagaimana request & response API**, dipakai semua app (api, web, admin). Satu kontrak didefinisikan sekali dalam tiga lapisan saling terkunci:

- **interface** (`src/types/`) — kanonik, satu kebenaran bentuk.
- **Zod schema** (`src/schemas/`) — `z.ZodType<T>` dicek thd interface; untuk runtime validation di server & client.
- **class-validator DTO** (`src/dtos/`) — `implements T`; untuk validasi request via `ValidationPipe` Nest.

Envelope respon baku (1 kebenaran): sukses `{ data }`, paginated `{ data, meta }`, error `{ error: { status, code, message, details? } }` — via helper `ok()` / `paginated()` / `apiError()`.

```ts
import {
  ok,
  healthResponseSchema,
  type HealthResponse,
  PaginationQueryDto,
} from '@packages/validators';
```

Cara menambah kontrak & detail pemakaian (server/client): lihat [`packages/validators/README.md`](packages/validators/README.md).

## API Client (`@packages/client`)

`packages/client` adalah **satu-satunya cara resmi** aplikasi web memanggil REST API `apps/api` — typed, dan request/response di-unwrap dari envelope `{ data }` serta **divalidasi otomatis** oleh schema Zod dari `@packages/validators` (client tidak punya definisi tipe sendiri).

```ts
import { apiClient, ApiHttpError } from '@packages/client';

const health = await apiClient.getHealth(); // Promise<HealthResponse> — tervalidasi
try {
  await apiClient.getHealth();
} catch (e) {
  if (e instanceof ApiHttpError) console.error(e.status, e.code, e.message);
}
```

- Base URL: `NEXT_PUBLIC_API_URL` (root `.env*`, di-inline Next; dev = `http://localhost:3002`) → fallback `http://localhost:3002`.
- Error terketik: `ApiTransportError` (jaringan), `ApiHttpError` (non-2xx, envelope error terkontrak), `ApiValidationError` (tak sesuai schema/envelope).
- Browser → API lintas-origin didukung `app.enableCors()` di `apps/api`.

Detail (alur request, cara menambah endpoint, perintah): lihat [`packages/client/README.md`](packages/client/README.md).

## Logging (`@packages/logger`)

`packages/logger` adalah logger terstruktur backend Node dengan **request context otomatis** — memakai `AsyncLocalStorage`, setiap baris log keluaran otomatis membawa `requestId`, `method`, `path` (dan `userId` setelah melewati `AuthGuard` auth) tanpa dioper lewat parameter.

```ts
import { createLogger, runWithContext } from '@packages/logger';

const logger = createLogger({ level: 'info', format: 'json' });
logger.info('melayani'); // context aktif ikut terbawa otomatis
```

- `apps/api` memasang `createRequestLogger` (middleware: `requestId` dari header `x-request-id` masuk → di-`runWithContext` → dibalikkan di response header + log `request completed` dengan `statusCode`/`durationMs`) dan `NestLoggerService` (log internal Nest ikut format/level yang sama).
- Format `json` (prod) / `pretty` (dev) & level diatur via env `LOG_LEVEL` / `LOG_FORMAT`.
- Key sensitif (`authorization`, `password`, `token`, ...) otomatis `[REDACTED]`.

Detail (API ALS, redaction, mapping Nest): lihat [`packages/logger/README.md`](packages/logger/README.md).

## Otentikasi (`@packages/auth`)

`packages/auth` adalah **SSOT domain auth** — hashing password, pembuatan/verifikasi token sesi, dan service `register`/`login`/`logout`/`authenticate` hidup sekali di sini (app cukup memanggil `authService`, tanpa mengulang logika).

```ts
import { authService, AuthError } from '@packages/auth';

const { token, user } = await authService.login({ email, password }, { authAgent, ipAddress });
const me = await authService.authenticate(token); // dipakai AuthGuard apps/api
await authService.logout(token); // hapus row Session by jti → token ter-revoke
```

- **Password**: `crypto.scrypt` + `timingSafeEqual` (zero dependency), tersimpan `scrypt$N$r$p$salt$hash`; login email tak dikenal tetap menjalankan scrypt (hash dummy) — timing setara, anti oracle.
- **Token**: JWT HS256 (`node:crypto`, tanpa library eksternal) berisi `sub`/`jti`/`role`/`exp`; `jti` disimpan di kolom `Session.token` sehingga logout **bisa menarik token yang sudah terbit** (hybrid JWT + sesi DB, bukan JWT murni yang tak bisa di-revoke).
- **Error domain** `AuthError` (`EMAIL_TAKEN` 409, `INVALID_CREDENTIALS` 401, `UNAUTHORIZED` 401) diterjemahkan `AllExceptionsFilter` `apps/api` ke envelope `{ error }` SSOT → sampai ke `ApiHttpError.code` di `@packages/client`.
- **HTTP** tetap di `apps/api` (`AuthController` + `AuthGuard` + decorator `@CurrentUser`/`@AuthToken`); guard juga menyetel `userId` di context ALS logger supaya log sesudah login otomatis membawa `userId`.

Detail (desain, env `JWT_SECRET`/`AUTH_SESSION_TTL_HOURS`, cara pakai): lihat [`packages/auth/README.md`](packages/auth/README.md).

## Aplikasi

| App          | Port | Peran                     | README                                         |
| ------------ | ---- | ------------------------- | ---------------------------------------------- |
| `apps/web`   | 3000 | Situs web publik (Next)   | [`apps/web/README.md`](apps/web/README.md)     |
| `apps/admin` | 3001 | Panel administrasi (Next) | [`apps/admin/README.md`](apps/admin/README.md) |
| `apps/api`   | 3002 | REST API (NestJS 11)      | [`apps/api/README.md`](apps/api/README.md)     |

`apps/web` & `apps/admin` adalah Next.js 16 (App Router + Turbopack), memakai preset dari `configs/` (`tsconfig` → `@configs/typescript/react.json`, ESLint → `@configs/eslint/next`, config → `@configs/next`) dan komponen dari `@packages/ui`. `pnpm dev` menjalankan semuanya paralel (web :3000, admin :3001, api :3002) — port bawaan berasal dari `WEB_PORT` / `ADMIN_PORT` / `API_PORT` di root `.env` dan bisa diubah di sana.

`apps/api` adalah NestJS 11 (CommonJS via `NodeNext`, builder `tsc`): `tsconfig` → `@configs/typescript/nest.json`, ESLint → `@configs/eslint/nest`, dan env dari `@packages/environment` (di-import di `main.ts`). Unit test memakai Jest (`pnpm test`).

## Menambah workspace baru

### App (`apps/<nama>`)

1. Buat `apps/<nama>/package.json` (`"private": true`) dengan script `build` / `dev` / `lint` / `typecheck` sesuai kebutuhan — Turbo otomatis mendeteksinya
2. `tsconfig.json` → `extends` preset `@configs/typescript/*` (+ opsi Next bila perlu)
3. `eslint.config.mjs` → import preset `@configs/eslint/*`
4. Untuk app Next.js: `next.config.mts` → re-export `@configs/next`
5. `pnpm install`

### Package (`packages/<nama>`)

1. Buat `packages/<nama>/package.json` dengan `"name": "@packages/<nama>"` dan `exports`
2. Konfigurasi seperti di atas
3. Konsumen memakai `"@packages/<nama>": "workspace:*"`
4. `pnpm install`

## Aturan SSOT

- Konfigurasi hidup **hanya** di `configs/` — workspace lain hanya extend/import.
- Nilai environment hidup **hanya** di file `.env*` root — jangan membuat `.env` lokal di app/package.
- Kontrak request/response API (interface + Zod schema + class-validator DTO) hidup **hanya** di `packages/validators` — apps import dari sana, jangan deklarasikan ulang.
- Komunikasi web → API **hanya** lewat `@packages/client` — jangan memanggil `fetch()` ke `apps/api` secara langsung.
- Dependency dipasang di workspace yang **langsung** menggunakannya; versi yang dipakai bersama harus konsisten.
- Referensi antar workspace selalu pakai protokol `workspace:*`.
- `pnpm-lock.yaml` adalah satu-satunya sumber kebenaran resolusi dependency — jangan commit `node_modules/`.

## CI

`.github/workflows/ci.yml` berjalan di setiap push ke `main` dan setiap pull request:

`pnpm install --frozen-lockfile` → `pnpm format:check` → `pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm build`

## Catatan tooling

- **ESLint ^9** — `eslint-config-next` (eslint-plugin-react/jsx-a11y/import) belum mendukung ESLint 10 (`context.getFilename()` dihapus di v10). Naikkan ke v10 setelah ekosistem siap.
- **PostCSS** — `packages/ui/postcss.config.mjs` memakai bentuk string (`'@tailwindcss/postcss': {}`); jangan diubah ke import instance (native binary `lightningcss` gagal dibundel Turbopack). App mere-export config ini lewat `postcss.config.mjs` sendiri.
- **NestJS** — preset `@configs/typescript/nest.json` memakai `emitDecoratorMetadata` + `experimentalDecorators` (wajib untuk DI Nest; opsi legacy) dan meng-extend `node.json` (`NodeNext`) tanpa `"type": "module"`, sehingga output tetap CommonJS dengan resolusi modern. Jangan ganti builder ke SWC/esbuild tanpa plugin yang mendukung decorator metadata.
- **Prisma** — dikunci di v7 (`prisma@^7`): URL pindah dari schema ke `prisma.config.ts`, klien wajib driver adapter (`PrismaPg`), dan generator `prisma-client` output ke folder di repo (bukan `node_modules`). Naik ke v8 (`prisma@latest`) butuh config shape baru (`definePrismaConfig`) dan rename API (`.limit/.offset`, `db.raw.sql`) — lakukan terpisah saat diperlukan.
- **`@packages/validators`** — tsconfig extends preset `nest` (butuh `experimentalDecorators`/`emitDecoratorMetadata` untuk DTO class-validator) tetapi `types: []` + ESLint preset `base` (murni, browser-safe). Paket di-build ke `dist/` CJS seperti `@packages/db`; task `typecheck` Turbo sudah `dependsOn: ["^typecheck", "^build"]` supaya dist konsumen tersedia.
- **`@packages/client`** — preset baru `browser.json` (base + lib DOM) lalu di-override `module: NodeNext` untuk emit CJS. `NEXT_PUBLIC_API_URL` hanya di-inline oleh Next; di Node (smoke/tes) dibaca dari `process.env` runtime lewat deklarasi lokal `env.d.ts` (package sengaja tanpa `@types/node`).
- **`@packages/logger`** — Node-only (pakai `node:async_hooks`), zero runtime deps; tsconfig extend `node.json` + `verbatimModuleSyntax: false` (emit CJS). `@nestjs/common` sengaja hanya devDependency (tipe `LoggerService` via `import type`).
- **`@packages/auth`** — Node-only, hanya dependency workspace (`db`, `environment`, `validators`); JWT HS256 diimplementasikan sendiri via `node:crypto` (bukan `jose` — lib itu ESM-only, bentrok dengan build CJS + jest repo ini). Verifikasi JWT tidak mendispatch `alg` dari header (mencegah algorithm confusion) dan membanding signature dengan `timingSafeEqual`.
