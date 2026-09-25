# admin (`apps/admin`)

Panel administrasi **jajanah** — [Next.js](https://nextjs.org) 16 (App Router, Turbopack) + komponen dari [`@packages/ui`](../../packages/ui/README.md). Berjalan di port **3001** (default; ubah lewat `ADMIN_PORT` di root `.env`; berdampingan dengan `apps/web` saat `pnpm dev`).

## Perintah

| Perintah                        | Deskripsi                                               |
| ------------------------------- | ------------------------------------------------------- |
| `pnpm --filter admin dev`       | Dev server via bin `next-app` di `:3001` (`ADMIN_PORT`) |
| `pnpm --filter admin build`     | Production build                                        |
| `pnpm --filter admin start`     | Production server via bin `next-app` (`ADMIN_PORT`)     |
| `pnpm --filter admin lint`      | ESLint dengan preset `@configs/eslint/next`             |
| `pnpm --filter admin typecheck` | `next typegen` + `tsc --noEmit`                         |

Dari root, `pnpm dev` / `pnpm build` / `pnpm check` otomatis mencakup app ini lewat Turbo.

## Struktur

```
apps/admin/
├── package.json        # script Next.js + dependensi runtime (next, react, @packages/ui)
├── next.config.mts     # re-export @configs/next (SSOT: transpilePackages, reactStrictMode)
├── postcss.config.mjs  # re-export @packages/ui/postcss.config.mjs (SSOT Tailwind/PostCSS)
├── tsconfig.json       # extends @configs/typescript/react.json + opsi Next (paths @/* → ./*)
├── eslint.config.mjs   # re-export @configs/eslint/next (SSOT)
├── components.json     # config CLI shadcn — komponen baru masuk components/, utils → @packages/ui
└── app/
    ├── layout.tsx      # import @packages/ui/globals.css (satu-satunya sumber theme)
    └── page.tsx        # halaman contoh dashboard memakai Button, Card, Input, Badge
```

## Aturan SSOT

- Konfigurasi Next/ESLint/TypeScript/Prettier **tidak** didefinisikan di app ini — hanya import dari `configs/`.
- Port dev/start **tidak** dihardcode di `package.json` — dibaca dari `ADMIN_PORT` (root `.env`) oleh bin `next-app` milik `@configs/next`. Override cepat: `ADMIN_PORT=4001 pnpm --filter admin dev`.
- `next-env.d.ts` dan `.next/` digenerate, di-ignore di `.gitignore` root (jangan commit / tulis manual).
- Menambah komponen shadcn untuk app ini: `pnpm dlx shadcn@latest add <nama> -c apps/admin` (komponen bersama tetap lewat `-c packages/ui`).
