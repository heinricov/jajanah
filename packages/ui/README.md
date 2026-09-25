# @packages/ui

Package bersama berisi komponen [shadcn/ui](https://ui.shadcn.com) (basis **Radix**, preset **Nova**, base color **neutral**, ikon **lucide**), Tailwind CSS v4, dan helper `cn`.

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

Jalankan dari root (atau dari direktori mana pun dengan `-c`):

```bash
pnpm dlx shadcn@latest add <nama-komponen> -c packages/ui
# contoh:
pnpm dlx shadcn@latest add dialog dropdown-menu toast -c packages/ui
```

- File masuk ke `src/components/`, dependensi radix dkk. otomatis ditambahkan ke `package.json`
- Setelah `add`, jalankan `pnpm install` bila CLI tidak melakukannya, lalu `pnpm format`
- **Jangan ubah `style`, `tailwind.baseColor`, dan `tailwind.cssVariables` di `components.json`** — tidak bisa diubah setelah inisialisasi dan menentukan hasil generate komponen

## Menggunakan di app (Next.js)

```bash
pnpm --filter apps/web add @packages/ui --workspace:*
```

1. **Komponen** — import lewat exports map:

   ```tsx
   import { Button } from '@packages/ui/components/button';
   import { Card, CardContent } from '@packages/ui/components/card';
   ```

2. **CSS** — import sekali di `app/layout.tsx` (satu-satunya sumber theme):

   ```tsx
   import '@packages/ui/globals.css';
   ```

3. **PostCSS** — app cukup re-export (jangan definisikan plugin sendiri):

   ```js
   // apps/web/postcss.config.mjs
   export { default } from '@packages/ui/postcss.config.mjs';
   ```

4. **Next.js** — tambahkan transpilasi source TS dari package:

   ```js
   // next.config.ts
   const nextConfig = {
     transpilePackages: ['@packages/ui'],
   };
   ```

## Catatan

- `globals.css` berisi `@source ../../**/*.{ts,tsx}` (kelas di package ini) dan `@source ../../../../apps/**/*.{ts,tsx}` (kelas di seluruh app) — pastikan path tetap menunjuk direktori yang ada.
- Dark mode: tambahkan class `dark` pada `<html>`; token tema diatur di `src/styles/globals.css` (`:root` / `.dark`).
- Komponen shadcn modern tidak memakai `"use client"` untuk komponen tanpa hooks (button, card, input, badge); komponen interaktif dari registry sudah menyertakannya sendiri.
