# @packages/ui

Package bersama berisi komponen [shadcn/ui](https://ui.shadcn.com) (basis **Radix**, preset **Mira** / `radix-mira`, base color **mist**, theme **sky**, font **Oxanium**, ikon **lucide**), Tailwind CSS v4, dan helper `cn`.

## Struktur

```
packages/ui/
├── components.json        # Config CLI shadcn (aliases → @packages/ui/*)
├── package.json           # exports map + script lint/typecheck
├── tsconfig.json          # extends @configs/typescript/react.json (SSOT)
├── eslint.config.mjs      # import @configs/eslint/react (SSOT)
├── postcss.config.mjs     # @tailwindcss/postcss — di-reexport app (SSOT)
└── src/
    ├── components/        # Komponen shadcn (button, card, input, badge, …)
    ├── auth/              # Form auth (form-login/register/forgot-password/new-password, auth-card, password-input, social-buttons, user-auth) — logo AppLogo di tengah layar
    ├── navigations/       # Navbar & Footer (server component, props-driven; dipanggil di layout app)
    ├── dashboard/         # Layout dashboard (app-layout, app-sidebar, nav-*, team-switcher)
    ├── apps/              # Logo aplikasi (app-logo)
    ├── lib/utils.ts       # export { cn } from "cn"
    ├── hooks/             # Hook bersama (opsional)
    └── styles/globals.css # 1-satunya sumber theme/Tailwind — di-import app
```

## Perintah

| Perintah                               | Deskripsi                                                              |
| -------------------------------------- | ---------------------------------------------------------------------- |
| `pnpm --filter @packages/ui lint`      | ESLint dengan preset `@configs/eslint/react` (termasuk Rules of Hooks) |
| `pnpm --filter @packages/ui typecheck` | `tsc --noEmit`                                                         |
| `pnpm lint` / `pnpm typecheck`         | Menjalankan keduanya lewat Turbo dari root                             |

## Menambah komponen shadcn

Jalankan dari root dengan `-c` menunjuk **path app** (preflight CLI butuh proyek framework — `packages/ui` sendiri ditolak):

```bash
pnpm dlx shadcn@latest add <nama-komponen> -c apps/web
# contoh:
pnpm dlx shadcn@latest add dialog dropdown-menu toast -c apps/web
```

- Routing monorepo: file tetap masuk ke `packages/ui/src/components/`, dependensi ditambahkan ke `package.json` yang tepat
- Setelah `add`, jalankan `pnpm install` bila CLI tidak melakukannya, lalu `pnpm format`
- Setelah menambah komponen, sinkronkan `style` & `tailwind.baseColor` ke ketiga `components.json` (`packages/ui`, `apps/web`, `apps/admin`) bila berbeda

## Menerapkan preset shadcn

Preset saat ini: **`b5KJfbheS`** ([buka di shadcn create](https://ui.shadcn.com/create?preset=b5KJfbheS)) — `radix-mira` / base color `mist` / theme `sky` / font `Oxanium` / radius default / chart `sky`.

```bash
pnpm dlx shadcn@latest apply --preset b5KJfbheS -y -c apps/web
```

- Jalankan dari **path app** (sama seperti `add` — preflight butuh framework); theme ditulis ke `packages/ui/src/styles/globals.css`, komponen ke `packages/ui/src/components/`
- `apply` menulis `components.json` cwd + `packages/ui` — **sinkronkan manual `apps/admin/components.json`** supaya ketiganya sama (`radix-mira` + `mist`)
- Sesudah apply: pastikan `@source` di `globals.css` tidak hilang/duplikat, `pnpm format`, lalu `pnpm check && pnpm test && pnpm build`

## Menggunakan di app (Next.js)

```bash
pnpm --filter web add @packages/ui --workspace:*
```

1. **Komponen** — import lewat exports map:

   ```tsx
   import { Button } from '@packages/ui/components/button';
   import { Card, CardContent } from '@packages/ui/components/card';
   import { Navbar, Footer } from '@packages/ui/navigations/';
   ```

   `Navbar`/`Footer` adalah server component props-driven (`user`, `items`, `showAuth`, `copyright`) — contoh pemakaian ada di `apps/web/app/layout.tsx`.

2. **CSS** — import sekali di `app/layout.tsx` (satu-satunya sumber theme):

   ```tsx
   import '@packages/ui/globals.css';
   ```

3. **PostCSS** — app cukup re-export (jangan definisikan plugin sendiri):

   ```js
   // apps/web/postcss.config.mjs
   export { default } from '@packages/ui/postcss.config.mjs';
   ```

   Config di package ini memakai **bentuk string** (`'@tailwindcss/postcss': {}`) — resolusi plugin mengikuti lokasi file config ini. Jangan diganti ke import instance: Turbopack ikut membundel `lightningcss` (native binary) lalu build gagal.

4. **Next.js** — konfigurasi Next bersama sudah didefinisikan sekali di `@configs/next` (`transpilePackages: ['@packages/ui']` + `reactStrictMode`); app cukup:

   ```ts
   // apps/web/next.config.mts
   import { nextConfig } from '@configs/next';

   export default nextConfig;
   ```

## Catatan

- `globals.css` berisi `@source ../../**/*.{ts,tsx}` (kelas di package ini) dan `@source ../../../../apps/**/*.{ts,tsx}` (kelas di seluruh app) — pastikan path tetap menunjuk direktori yang ada.
- Dark mode: tambahkan class `dark` pada `<html>`; token tema diatur di `src/styles/globals.css` (`:root` / `.dark`).
- Komponen shadcn modern tidak memakai `"use client"` untuk komponen tanpa hooks (button, card, input, badge); komponen interaktif dari registry sudah menyertakannya sendiri.
