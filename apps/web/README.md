# web (`apps/web`)

Aplikasi web publik **jajanah** — [Next.js](https://nextjs.org) 16 (App Router, Turbopack) + komponen dari [`@packages/ui`](../../packages/ui/README.md). Berjalan di port **3000** (default; ubah lewat `WEB_PORT` di root `.env`).

Auth dijalankan **tanpa endpoint API di app ini**: halaman memanggil `useAuth()` (`@packages/auth/next`) → server actions di [`@packages/auth`](../../packages/auth/README.md) (`loginAction`/`registerAction`/`resendVerificationAction`/`forgotPasswordAction`/`resetPasswordAction`/`logoutAction`/`meAction`) → domain `authService` langsung, cookie httpOnly di-set server-side. Data API lain (mis. demo health) lewat [`@packages/client`](../../packages/client/README.md).

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
├── package.json        # script Next.js + dependensi (next, react, @packages/ui, @packages/auth, @packages/client)
├── next.config.mts     # re-export @configs/next (SSOT: transpilePackages, reactStrictMode)
├── postcss.config.mjs  # re-export @packages/ui/postcss.config.mjs (SSOT Tailwind/PostCSS)
├── tsconfig.json       # extends @configs/typescript/react.json + opsi Next (paths @/* → ./*)
├── eslint.config.mjs   # re-export @configs/eslint/next (SSOT)
├── components.json     # config CLI shadcn — komponen baru masuk components/, utils → @packages/ui
├── proxy.ts            # lapis-1: cookie tj_token ada? → selain itu redirect /auth/login (edge, cek keberadaan saja)
├── components/
│   ├── health-status.tsx  # demo: apiClient.getHealth() (@packages/client) → status API
│   ├── resend-verification.tsx # tombol kirim ulang email konfirmasi (halaman verify-email)
│   └── reset-password-form.tsx # form setel password baru → resetPasswordAction
└── app/
    ├── layout.tsx      # globals.css + font Oxanium + <AuthProvider initialUser={await getSessionUser()}> + Navbar/Footer (@packages/ui/navigations)
    ├── page.tsx        # landing publik
    ├── auth/           # login / register / verify-email (server) / forgot-password + new-password (reset password)
    ├── api/auth/       # GET google{,/callback} — 2 route handler OAuth (satu-satunya endpoint app)
    └── (protected)/
        ├── layout.tsx  # requireAuth() — verifikasi otoritatif ke domain, redirect bila belum login
        └── home/       # halaman terproteksi (butuh sesi)
```

Catatan: satu-satunya endpoint di app ini adalah 2 route handler OAuth (`app/api/auth/google{,/callback}`); semua auth lain lewat server action `@packages/auth` — jangan menambah endpoint baru.

## Aturan SSOT

- Konfigurasi Next/ESLint/TypeScript/Prettier **tidak** didefinisikan di app ini — hanya import dari `configs/`.
- **Auth** — jangan membuat route handler/endpoint di app ini; semua lewat `useAuth()` + guards dari `@packages/auth` (SSOT). Cookie hanya dicek keberadaannya di `proxy.ts`, verifikasi token/role via `requireAuth()`/`requireAdmin()`.
- Komunikasi dengan API (data non-auth) **hanya** lewat `@packages/client` (jangan `fetch()` langsung) — request/response terkontrak & tervalidasi otomatis; base URL dari `NEXT_PUBLIC_API_URL` (root `.env*`).
- Port dev/start **tidak** dihardcode di `package.json` — dibaca dari `WEB_PORT` (root `.env`) oleh bin `next-app` milik `@configs/next`. Override cepat: `WEB_PORT=4000 pnpm --filter web dev`.
- `next-env.d.ts` dan `.next/` digenerate, di-ignore di `.gitignore` root (jangan commit / tulis manual).
- Menambah komponen shadcn untuk app ini: `pnpm dlx shadcn@latest add <nama> -c apps/web` (komponen bersama tetap lewat `-c packages/ui`).
