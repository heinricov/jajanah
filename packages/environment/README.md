# @packages/environment

Loader environment tunggal (SSOT) untuk seluruh monorepo. Semua yang butuh file env cukup `import '@packages/environment'` — file `.env*` di **root repo** otomatis dibaca, apa pun cwd konsumennya.

> Format paket: **CommonJS** (tanpa `"type": "module"`) supaya bisa dikonsumsi dari ESM (`import`), CJS (`require`), maupun Jest — tanpa dual-build.

## Sumber nilai (SSOT)

Nilai env hidup **hanya** di root repo — bukan di tiap app:

```
jajanah/                      # root repo (dicari via pnpm-workspace.yaml)
├── .env                      # selalu dibaca
├── .env.development          # dibaca saat NODE_ENV=development
├── .env.test                 # dibaca saat NODE_ENV=test
├── .env.production           # dibaca saat NODE_ENV=production
├── .env.local                # override lokal (dilewati saat mode test)
├── .env.<mode>.local         # override lokal per mode
└── .env.example              # dokumentasi semua variabel (di-commit)
```

Urutan precedence (yang belakangan menang, `.local` paling kuat):

| #   | File                | Catatan                               |
| --- | ------------------- | ------------------------------------- |
| 1   | `.env`              | Dasar                                 |
| 2   | `.env.<mode>`       | `development` / `test` / `production` |
| 3   | `.env.local`        | Dilewati saat mode `test`             |
| 4   | `.env.<mode>.local` | Override paling kuat                  |

Aturan penting:

- **Nilai yang sudah ada di `process.env` (shell/CI) SELALU menang** — file `.env` tidak pernah menimpa variabel dari luar.
- Mode diambil dari `process.env.NODE_ENV` (default `development`).
- File `.env*` (kecuali `.env.example`) sudah di-ignore oleh `.gitignore` root.

## Pemakaian

### Otomatis di app Next.js (web & admin)

`@configs/next` meng-import package ini di `configs/next/index.js` — semua app Next yang re-export `nextConfig` memuat env secara otomatis sebelum build/typegen. `NEXT_PUBLIC_*` jadi ter-inline oleh Next.js.

```tsx
// app/page.tsx — server component
<p>{process.env.NEXT_PUBLIC_APP_NAME}</p>
```

### Manual (scripts/, tooling, package lain)

Tambahkan dependency lalu import sekali di entry point:

```bash
pnpm --filter scripts add @packages/environment --workspace:*
```

```js
import '@packages/environment'; // side-effect: load .env* → process.env

import { getEnv, requireEnv, environment } from '@packages/environment';

getEnv('API_BASE_URL'); // string | undefined
requireEnv('API_BASE_URL'); // throw bila kosong/absen
environment.API_BASE_URL; // live view read-only atas process.env
```

## API

| Ekspor                    | Fungsi                                                                 |
| ------------------------- | ---------------------------------------------------------------------- |
| _(side-effect)_           | `loadEnvironment()` berjalan otomatis saat package di-import           |
| `loadEnvironment(opts?)`  | Muat ulang file untuk `mode`/`root` tertentu; kembalikan snapshot beku |
| `findRepoRoot(startDir?)` | Cari root repo (walk-up sampai `pnpm-workspace.yaml`)                  |
| `getEnv(name, fallback?)` | Baca `process.env[name]` dengan fallback opsional                      |
| `requireEnv(name)`        | Baca atau lempar Error bila kosong                                     |
| `environment`             | Proxy read-only live atas `process.env`                                |

## Menambah variabel

1. Tambahkan kunci ke `.env.example` (dokumentasi, di-commit) + `.env` (nilai).
2. Bila perlu beda per mode: `.env.development` / `.env.production` dst.
3. `pnpm install` tidak diperlukan — cukup restart proses (dev server / CLI).

## Perintah

| Perintah                                   | Deskripsi                                   |
| ------------------------------------------ | ------------------------------------------- |
| `pnpm --filter @packages/environment lint` | ESLint dengan preset `@configs/eslint/node` |
