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
│   └── environment/       # @packages/environment — loader .env (SSOT env)
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

| Preset                           | Untuk                                                                |
| -------------------------------- | -------------------------------------------------------------------- |
| `@configs/typescript/base.json`  | Default (ESNext + bundler resolution)                                |
| `@configs/typescript/node.json`  | CLI / backend Node.js (`NodeNext` + `@types/node`)                   |
| `@configs/typescript/nest.json`  | Backend NestJS (`node.json` + decorator metadata, output ke `dist/`) |
| `@configs/typescript/react.json` | Frontend React (`jsx: react-jsx` + DOM lib)                          |

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
- Precedence: `.env` → `.env.<mode>` → `.env.local` → `.env.<mode>.local` (yang belakangan menang); variabel yang sudah ada di `process.env` (shell/CI) **selalu** menang.
- Mode mengikuti `NODE_ENV` (default `development`).

Detail lengkap (precedence, API `getEnv`/`requireEnv`/`environment`, cara menambah variabel): lihat [`packages/environment/README.md`](packages/environment/README.md).

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
