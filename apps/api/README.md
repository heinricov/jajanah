# api (`apps/api`)

REST API **jajanah** — [NestJS](https://nestjs.com) 11 (CommonJS, builder `tsc` via Nest CLI). Berjalan di port **3002** (berdampingan dengan `apps/web` :3000 dan `apps/admin` :3001 saat `pnpm dev`).

## Perintah

| Perintah                      | Deskripsi                                     |
| ----------------------------- | --------------------------------------------- |
| `pnpm --filter api dev`       | Dev server watch di `http://localhost:3002`   |
| `pnpm --filter api build`     | Production build (`nest build` → `dist/`)     |
| `pnpm --filter api start`     | Jalankan hasil build produksi (port dari env) |
| `pnpm --filter api lint`      | ESLint dengan preset `@configs/eslint/nest`   |
| `pnpm --filter api typecheck` | `tsc --noEmit`                                |
| `pnpm --filter api test`      | Unit test (Jest + ts-jest)                    |

Dari root, `pnpm dev` / `pnpm build` / `pnpm check` / `pnpm test` otomatis mencakup app ini lewat Turbo.

## Struktur

```
apps/api/
├── package.json          # script NestJS + dependensi (@nestjs/*, @packages/environment)
├── nest-cli.json         # config Nest CLI (sourceRoot src, hapus dist saat build)
├── tsconfig.json         # extends @configs/typescript/nest.json (+ types jest)
├── tsconfig.build.json   # untuk `nest build` — exclude *.spec.ts
├── eslint.config.mjs     # re-export @configs/eslint/nest (SSOT)
└── src/
    ├── main.ts           # import reflect-metadata + @packages/environment → bootstrap (port API_PORT)
    ├── app.module.ts     # root module
    ├── app.controller.ts # GET / → status payload
    ├── app.service.ts    # membaca env via `environment`/`getEnv` (@packages/environment)
    └── app.controller.spec.ts  # unit test (Jest)
```

## Endpoint

| Method | Path | Deskripsi                                                                        |
| ------ | ---- | -------------------------------------------------------------------------------- |
| `GET`  | `/`  | `{ service, status, mode, appName, baseUrl }` — nilai env dari file `.env*` root |

## Aturan SSOT

- Konfigurasi TypeScript/ESLint/Prettier **tidak** didefinisikan di app ini — hanya import dari `configs/` (preset `@configs/typescript/nest.json` & `@configs/eslint/nest`).
- Nilai environment hidup di file `.env*` **root**; `main.ts` meng-import `@packages/environment` sekali untuk memuatnya (mode mengikuti `NODE_ENV`, default `development`). Jangan membuat `.env` lokal di app ini.
- `dist/` dan `coverage/` adalah hasil generate — di-ignore di `.gitignore` root (jangan commit).
- Menambah modul/baris resource: `pnpm --filter api exec nest g module <nama>` (schematics dari `@nestjs/cli`).
