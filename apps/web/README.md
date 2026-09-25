# web (`apps/web`)

Aplikasi web publik **jajanah** — [Next.js](https://nextjs.org) 16 (App Router, Turbopack) + komponen dari [`@packages/ui`](../../packages/ui/README.md) dan pemanggilan API resmi lewat [`@packages/client`](../../packages/client/README.md). Berjalan di port **3000** (default; ubah lewat `WEB_PORT` di root `.env`).

## Perintah

| Perintah                      | Deskripsi                                             |
| ----------------------------- | ----------------------------------------------------- |
| `pnpm --filter web dev`       | Dev server via bin `next-app` di `:3000` (`WEB_PORT`) |
| `pnpm --filter web build`     | Production build                                      |
| `pnpm --filter web start`     | Production server via bin `next-app` (`WEB_PORT`)     |
| `pnpm --filter web lint`      | ESLint dengan preset `@configs/eslint/next`           |
| `pnpm --filter web typecheck` | `next typegen` + `tsc --noEmit`                       |

Dari root, `pnpm dev` / `pnpm build` / `pnpm check` otomatis mencakup app ini lewat Turbo.

## Struktur

```
apps/web/
├── package.json        # script Next.js + dependensi runtime (next, react, @packages/ui, @packages/client)
├── next.config.mts     # re-export @configs/next (SSOT: transpilePackages, reactStrictMode)
├── postcss.config.mjs  # re-export @packages/ui/postcss.config.mjs (SSOT Tailwind/PostCSS)
├── tsconfig.json       # extends @configs/typescript/react.json + opsi Next (paths @/* → ./*)
├── eslint.config.mjs   # re-export @configs/eslint/next (SSOT)
├── components.json     # config CLI shadcn — komponen baru masuk components/, utils → @packages/ui
├── components/
│   └── health-status.tsx  # demo: apiClient.getHealth() (@packages/client) → status API
└── app/
    ├── layout.tsx      # import @packages/ui/globals.css (satu-satunya sumber theme)
    └── page.tsx        # halaman contoh memakai Button, Card, Input, Badge + <HealthStatus />
```

## Aturan SSOT

- Konfigurasi Next/ESLint/TypeScript/Prettier **tidak** didefinisikan di app ini — hanya import dari `configs/`.
- Komunikasi dengan API **hanya** lewat `@packages/client` (jangan `fetch()` langsung) — request/response terkontrak & tervalidasi otomatis; base URL dari `NEXT_PUBLIC_API_URL` (root `.env*`).
- Port dev/start **tidak** dihardcode di `package.json` — dibaca dari `WEB_PORT` (root `.env`) oleh bin `next-app` milik `@configs/next`. Override cepat: `WEB_PORT=4000 pnpm --filter web dev`.
- `next-env.d.ts` dan `.next/` digenerate, di-ignore di `.gitignore` root (jangan commit / tulis manual).
- Menambah komponen shadcn untuk app ini: `pnpm dlx shadcn@latest add <nama> -c apps/web` (komponen bersama tetap lewat `-c packages/ui`).
