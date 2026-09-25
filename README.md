# jajanah

Monorepo yang dibangun dengan [Turborepo](https://turborepo.com) + [pnpm workspaces](https://pnpm.io/workspaces), dengan prinsip **SSOT** (Single Source of Truth): konfigurasi TypeScript, ESLint, dan Prettier didefinisikan **sekali** di folder `configs/` lalu di-consume semua workspace.

## Struktur

```
.
├── apps/
│   ├── web/               # Next.js 16 — situs web (port 3000)
│   └── admin/             # Next.js 16 — panel admin (port 3001)
├── packages/
│   └── ui/                # @packages/ui — komponen shadcn/ui + Tailwind v4
├── scripts/              # Script operasional (masih kosong)
├── configs/
│   ├── typescript/       # @configs/typescript — preset tsconfig
│   ├── eslint/           # @configs/eslint — preset flat config (base/node/react/next)
│   ├── next/             # @configs/next — konfigurasi Next.js bersama
│   └── prettier/         # @configs/prettier — 1-satunya config prettier
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

| Preset                           | Untuk                                              |
| -------------------------------- | -------------------------------------------------- |
| `@configs/typescript/base.json`  | Default (ESNext + bundler resolution)              |
| `@configs/typescript/node.json`  | CLI / backend Node.js (`NodeNext` + `@types/node`) |
| `@configs/typescript/react.json` | Frontend React (`jsx: react-jsx` + DOM lib)        |

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
| `@configs/eslint/react` | `base` + global browser + `eslint-plugin-react-hooks`  |
| `@configs/eslint/next`  | `react` + `eslint-config-next/core-web-vitals`         |

### Next.js

```ts
// next.config.mts di app Next.js
import { nextConfig } from '@configs/next';

export default nextConfig;
```

`@configs/next` menyiapkan `transpilePackages: ['@packages/ui']` dan `reactStrictMode` — semua app Next.js cukup re-export. Opsional: tambahkan konfigurasi khusus app sebagai object spread di atasnya.

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

## Aplikasi (Next.js)

| App          | Port | Peran              | README                                         |
| ------------ | ---- | ------------------ | ---------------------------------------------- |
| `apps/web`   | 3000 | Situs web publik   | [`apps/web/README.md`](apps/web/README.md)     |
| `apps/admin` | 3001 | Panel administrasi | [`apps/admin/README.md`](apps/admin/README.md) |

Keduanya Next.js 16 (App Router + Turbopack), memakai preset dari `configs/` (`tsconfig` → `@configs/typescript/react.json`, ESLint → `@configs/eslint/next`, config → `@configs/next`) dan komponen dari `@packages/ui`. `pnpm dev` menjalankan keduanya paralel (web :3000, admin :3001).

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
- Dependency dipasang di workspace yang **langsung** menggunakannya; versi yang dipakai bersama harus konsisten.
- Referensi antar workspace selalu pakai protokol `workspace:*`.
- `pnpm-lock.yaml` adalah satu-satunya sumber kebenaran resolusi dependency — jangan commit `node_modules/`.

## CI

`.github/workflows/ci.yml` berjalan di setiap push ke `main` dan setiap pull request:

`pnpm install --frozen-lockfile` → `pnpm format:check` → `pnpm lint` → `pnpm typecheck` → `pnpm build`

## Catatan tooling

- **ESLint ^9** — `eslint-config-next` (eslint-plugin-react/jsx-a11y/import) belum mendukung ESLint 10 (`context.getFilename()` dihapus di v10). Naikkan ke v10 setelah ekosistem siap.
- **PostCSS** — `packages/ui/postcss.config.mjs` memakai bentuk string (`'@tailwindcss/postcss': {}`); jangan diubah ke import instance (native binary `lightningcss` gagal dibundel Turbopack). App mere-export config ini lewat `postcss.config.mjs` sendiri.
