# jajanah

Monorepo yang dibangun dengan [Turborepo](https://turborepo.com) + [pnpm workspaces](https://pnpm.io/workspaces), dengan prinsip **SSOT** (Single Source of Truth): konfigurasi TypeScript, ESLint, dan Prettier didefinisikan **sekali** di folder `configs/` lalu di-consume semua workspace.

## Struktur

```
.
├── apps/                 # Aplikasi (masih kosong)
├── packages/             # Package bersama (masih kosong)
├── scripts/              # Script operasional (masih kosong)
├── configs/
│   ├── typescript/       # @configs/typescript — preset tsconfig
│   ├── eslint/           # @configs/eslint — preset flat config
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

| Preset                 | Untuk                                                  |
| ---------------------- | ------------------------------------------------------ |
| `@configs/eslint/base` | JS/TS + `typescript-eslint` + `eslint-config-prettier` |
| `@configs/eslint/node` | `base` + global Node.js                                |

> Preset React akan ditambahkan ke `configs/eslint/` saat aplikasi React pertama dibuat.

### Prettier

Tidak ada `.prettierrc` di root maupun workspace. Root `package.json` menunjuk langsung ke `@configs/prettier` — ubah konfigurasi hanya di `configs/prettier/index.js`.

## Menambah workspace baru

### App (`apps/<nama>`)

1. Buat `apps/<nama>/package.json` (`"private": true`)
2. `tsconfig.json` → `extends` preset `@configs/typescript/*`
3. `eslint.config.js` → import preset `@configs/eslint/*`
4. Tambahkan script `build` / `dev` / `lint` / `typecheck` sesuai kebutuhan — Turbo otomatis mendeteksinya
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

`pnpm install --frozen-lockfile` → `pnpm format:check` → `pnpm lint` → `pnpm typecheck`
