# admin (`apps/admin`)

Panel administrasi **jajanah** — [Next.js](https://nextjs.org) 16 (App Router, Turbopack) + komponen dari [`@packages/ui`](../../packages/ui/README.md). Berjalan di port **3001** (default; ubah lewat `ADMIN_PORT` di root `.env`; berdampingan dengan `apps/web` saat `pnpm dev`).

Auth dijalankan **tanpa endpoint API di app ini**: halaman memanggil `useAuth()` (`@packages/auth/next`) → server actions di [`@packages/auth`](../../packages/auth/README.md) (`loginAction`/`logoutAction`/`meAction`) → domain `authService` langsung, cookie httpOnly di-set server-side. Panel memakai `requireAdmin()` (khusus role `ADMIN`).

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
├── package.json        # script Next.js + dependensi (next, react, @packages/ui, @packages/auth)
├── next.config.mts     # re-export @configs/next (SSOT: transpilePackages, reactStrictMode)
├── postcss.config.mjs  # re-export @packages/ui/postcss.config.mjs (SSOT Tailwind/PostCSS)
├── tsconfig.json       # extends @configs/typescript/react.json + opsi Next (paths @/* → ./*)
├── eslint.config.mjs   # re-export @configs/eslint/next (SSOT)
├── components.json     # config CLI shadcn — komponen baru masuk components/, utils → @packages/ui
├── proxy.ts            # lapis-1: cookie tj_token ada? → selain itu redirect /auth/login (edge, cek keberadaan saja)
├── components/
│   └── auth-dashboard-layout.tsx  # shell dashboard + user menu (useAuth → logout)
└── app/
    ├── layout.tsx      # import @packages/ui/globals.css + bootstrap <AuthProvider initialUser={await getSessionUser()}>
    ├── page.tsx        # redirect server-side ke /dashboard (guard login ada di (protected)/layout)
    ├── auth/           # login / forgot-password (client pages, via useAuth(); tanpa register)
    └── (protected)/
        ├── layout.tsx  # requireAdmin() — verifikasi token + role ADMIN, redirect bila bukan admin
        └── dashboard/  # halaman dashboard terproteksi
```

Catatan: **tidak ada `app/api/`** — app ini sengaja tidak mendefinisikan endpoint apa pun. Aksi register sengaja tidak diekspor ke UI (admin dibuat lewat seed/DB, bukan self-register).

## Aturan SSOT

- Konfigurasi Next/ESLint/TypeScript/Prettier **tidak** didefinisikan di app ini — hanya import dari `configs/`.
- **Auth** — jangan membuat route handler/endpoint di app ini; semua lewat `useAuth()` + guards dari `@packages/auth` (SSOT). Cookie hanya dicek keberadaannya di `proxy.ts`, verifikasi token/role via `requireAdmin()`.
- Port dev/start **tidak** dihardcode di `package.json` — dibaca dari `ADMIN_PORT` (root `.env`) oleh bin `next-app` milik `@configs/next`. Override cepat: `ADMIN_PORT=4001 pnpm --filter admin dev`.
- `next-env.d.ts` dan `.next/` digenerate, di-ignore di `.gitignore` root (jangan commit / tulis manual).
- Menambah komponen shadcn untuk app ini: `pnpm dlx shadcn@latest add <nama> -c apps/admin` (komponen bersama tetap lewat `-c packages/ui`).
