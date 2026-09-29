---
name: jajanah-project
description: Peta proyek, aturan SSOT, dan daftar gotcha repo jajanah (Turborepo + pnpm; apps/web, apps/admin, apps/api; packages auth, db, validators, client, logger, email, ui, environment). Use ONLY when working inside the jajanah repo — menambah workspace/package baru, menambah env var, mengubah kontrak API atau server action di @packages/auth, migrasi Prisma, halaman auth di apps/web, atau melanjutkan pengembangan proyek ini.
---

# jajanah — peta proyek & aturan kerja

Dokumen ini adalah "otak" sesi opencode untuk repo ini. Angka, path, dan kontrak di bawah
diverifikasi terhadap kode pada commit `0a852ff` (branch `main`, ter-push ke
`github.com/heinricov/jajanah`). **Jangan menebak kontrak — baca file sumbernya.**
Detail kontrak ada di `references/` (tautan di bagian §11).

## 1. Proyek ini apa

Monorepo Turborepo + pnpm dengan prinsip **SSOT**: TypeScript/ESLint/Prettier didefinisikan
sekali di `configs/`, lalu dikonsumsi semua workspace. Bahasa dokumentasi & komentar =
**Indonesian**; bahasa string user-facing & pesan error domain = **English**.

**Status produk saat ini:** platform autentikasi yang sudah lengkap dan teruji (148 test)
— register + konfirmasi email, password login, Google OAuth, sesi hybrid JWT + DB, role
USER/ADMIN, REST API auth. **Belum ada fitur domain bisnis**; ketiga app masih "sepatu
bot" (landing + auth di web, shell dashboard di admin, health + auth di API).
`jajanah` sendiri belum didefinisikan sebagai produk — bila user bertanya scope bisnis,
konfirmasi dulu.

## 2. Kapan skill ini aktif

- Menambah **workspace/package/app baru** ke monorepo
- Menambah **env var baru**, atau error `Missing required environment variable`
- Menambah/mengubah **kontrak API** (interface + Zod schema + DTO)
- Menambah **server action**, endpoint, atau halaman auth
- Menambah **migrasi Prisma** / model DB
- Error saat **build/typecheck** yang aneh (baca §9 dulu)
- Melanjutkan pekerjaan di sesi baru (mulai dari `references/state.md`)

## 3. Peta repo

```
jajanah/
├── apps/
│   ├── web/      (name: web)      Next.js 16 + React 19, port 3000 — situs publik
│   ├── admin/    (name: admin)    Next.js 16 + React 19, port 3001 — panel admin
│   └── api/      (name: api)      NestJS 11, port 3002, output CJS
├── packages/
│   ├── auth/         @packages/auth        — HUB: domain auth + server actions Next
│   ├── client/       @packages/client      — satu-satunya jalur web → api
│   ├── db/           @packages/db          — Prisma 7 + PostgreSQL (driver adapter pg)
│   ├── email/        @packages/email       — adapter Resend + fallback console (tanpa dependency)
│   ├── environment/  @packages/environment — loader .env root (CJS, auto-load saat import)
│   ├── logger/       @packages/logger      — logger terstruktur + AsyncLocalStorage
│   ├── ui/           @packages/ui          — shadcn/ui + Tailwind v4 (source, tanpa build)
│   └── validators/   @packages/validators  — SSOT kontrak API (interface + Zod + DTO)
├── configs/   @configs/{eslint,next,prettier,typescript}
├── scripts/   dev.mjs (orchestrator `pnpm dev`)
└── turbo.json, pnpm-workspace.yaml, package.json, eslint.config.mjs
```

### Arah dependency (aturan yang tidak boleh dilanggar)

```
apps/web ─┬─► @packages/auth ─┬─► @packages/db ──► @packages/environment
apps/admin┘   ├─► @packages/email            └─► @packages/environment
apps/admin ──► @packages/validators           └─► @packages/validators
apps/api ────► @packages/auth, @packages/environment, @packages/logger, @packages/validators
apps/web, admin ──► @packages/client ──► @packages/validators
apps/web, admin ──► @packages/ui        (tanpa dependensi workspace sama sekali)
@configs/next ──► @packages/environment
```

- **Daun** (tak boleh import apa pun dari `@packages/*`): `environment`, `validators`,
  `email`, `logger`, `ui`.
- **`@packages/ui` tidak boleh** mengimpor `@packages/auth`, `@packages/db`, atau
  `@packages/client` — ini dijaga secara struktural (zero workspace dependency). Logout
  disuntikkan lewat prop callback.
- `@packages/db` **tidak boleh** depend ke `@packages/auth` (akan membentuk cycle Turbo);
  sebab itu **seed berada di auth** (`packages/auth/src/domain/seed.ts`).

## 4. Aturan SSOT (dari README §"Aturan SSOT")

1. Konfigurasi hidup **hanya** di `configs/` — jangan menyalin compilerOptions/rule.
2. Environment hidup **hanya** di file `.env*` root — jangan buat `.env` lokal di app/package.
3. Kontrak request/response API hidup **hanya** di `packages/validators`.
4. Web → API **hanya** lewat `@packages/client` — jangan `fetch()` langsung.
   **Pengecualian auth**: server action `@packages/auth` dan route handler
   `apps/web/app/api/auth/google*`.
5. Dependency dipasang di workspace yang **langsung** memakainya, protokol `workspace:*`,
   `pnpm-lock.yaml` sebagai SSoT.
6. `.env.example` adalah dokumentasi yang di-commit; nilai asli `.env*` jangan pernah masuk git.

## 5. Perintah

| Perintah | Fungsi |
| --- | --- |
| `pnpm dev` | semua app sekaligus (`scripts/dev.mjs` → turbo dev, 3 port) |
| `pnpm dev:web` / `dev:admin` / `dev:api` | satu app saja |
| `pnpm check` | **gate utama** = lint + lint:root + typecheck |
| `pnpm test` | semua test (turbo, pakai cache) |
| `pnpm build` | build topologi lengkap |
| `pnpm format` / `pnpm format:check` | Prettier (langsung, bukan via turbo) |
| `pnpm --filter @packages/db migrate` | `prisma migrate dev` (butuh `DATABASE_URL`) |
| `pnpm --filter @packages/db db:seed` | build db + auth, lalu seed (idempoten) |
| `pnpm --filter @packages/db migrate:deploy` | migrasi ke DB remote/production |

Urutan gate di CI (`.github/workflows/ci.yml`) =
`format:check → lint → typecheck → test → build`. **Selalu jalankan `pnpm check` +
`pnpm test` + `pnpm build` sebelum menyatakan pekerjaan selesai.**

## 6. Konvensi kode

- **File**: kebab-case + sufiks peran — `.service.ts`, `.controller.ts`, `.guard.ts`,
  `.filter.ts`, `.dto.ts`, `.spec.ts`, `index.ts` barrel per folder, `page.tsx`/`layout.tsx`
  Next. Component React juga kebab-case: `form-login.tsx`, `auth-provider.tsx`.
- **Komentar**: JSDoc `/** ... */` berbahasa Indonesia untuk API publik & multi-langkah;
  `//` satu baris untuk penjelasan sisi-effek. String pesan error/validasi **English**.
- **Import**: built-in Node pakai awalan `node:` (`node:crypto`, `node:fs`). Tidak ada
  aturan `import/order` di ESLint — urutan visual: eksternal → blank → `@packages/*` →
  blank → relatif.
- **Gaya**: `export async function` untuk API top-level, `export const x = ...` untuk
  helper/decorator satu-kerangka, `as const` untuk tabel enum/lookup.
- **Error**: domain melempar `AuthError(code, message)`; jangan pernah
  `throw new Error()` mentah untuk error yang harus sampai ke client.
- **`no-console`** = warn (hanya `console.warn`/`console.error` lolos) — `console.log`
  butuh `// eslint-disable-next-line no-console` (lihat `packages/email/src/index.ts`).

## 7. Testing

- **Jest + ts-jest** (bukan vitest), konfigurasi inline di `package.json` tiap package,
  **kolokal** `*.spec.ts` di samping source-nya.
- `testRegex: ".*\\.spec\\.ts$"` — file `.spec.tsx` **diam-diam diabaikan**, jangan buat.
- `rootDir: src`, `testEnvironment: node`, coverage ke `../coverage`.
- Test domain **mock `@packages/db`** (`jest.mock('@packages/db')`) → tidak butuh DB;
  test `next/server` mock `next/headers`; test client/email **injeksi `fetch`**.
- Package yang punya test: `apps/api` (5/20), `@packages/auth` (7/86),
  `@packages/logger` (3/24), `@packages/client` (1/13), `@packages/email` (1/5).
- **Belum ada test** untuk `ui`, `web`, `admin`, `environment`, `validators`, `configs/*`.

## 8. Kredensial demo & seed

| Email | Password | Role |
| --- | --- | --- |
| `admin@jajanah.local` | `admin123` | ADMIN |
| `user@jajanah.local` | `user1234` | USER |

- Seed idempoten: akun yang sudah ada **tidak ditulis ulang** (password & sesi diabaikan),
  hanya di-backfill `emailVerifiedAt` bila masih null.
- Jalankan `pnpm --filter @packages/db db:seed` — perintah ini **wajib build**
  `@packages/auth` dulu karena seed = `node ../auth/dist/domain/seed.js`.
- Cookie sesi: `tj_token`. Cookie state OAuth: `tj_oauth_state`.
- Port dev: web 3000, admin 3001, api 3002.

## 9. Gotcha — baca sebelum mengedit

1. **Client component jangan import barrel `@packages/auth/next/server`.**
   Dari file `'use client'` gunakan `@packages/auth/next` atau
   `@packages/auth/next/server/actions`. Barrel `.../next/server` menarik
   `next/headers` + Prisma ke bundle client → error saat `next build`.
2. **`src/next/**` di `@packages/auth` sengaja tidak di-build** (ada di `exclude`
   `tsconfig.build.json`) — di-ekspor sebagai raw source ESM. Konsekuensinya: **tidak ada
   build step yang menangkap import rusak**; kesalahan baru muncul saat typecheck/build app.
3. **Import `@packages/ui/auth/*` dan `@packages/ui/navigations/*` harus lewat barrel**
   (`@packages/ui/auth/`, `@packages/ui/navigations/`) — wildcard-nya collapse ke satu
   `index.ts`, bukan ke file per komponen. `components/*`, `lib/*`, `hooks/*` boleh per-file.
4. **Tambah kode error baru = 2 file sekaligus**: `AuthErrorCode` di
   `packages/auth/src/domain/errors.ts` **dan** `API_ERROR_CODES` di
   `packages/validators/src/contract.ts`. Lalu **tambahkan cabang status** di ternary
   `AuthError` — kalau lupa, error diam-diam jadi **401** (bukan status yang benar).
5. **`turbo.json` tidak mendeklarasikan env apa pun** (tidak ada `globalEnv`) → cache turbo
   tidak menyertakan env. Setelah mengubah `.env*`, **restart proses dev** — turbo tidak
   akan restartkannya.
6. **Env baru harus masuk 4 file**: `.env.example` (di-commit), `.env`,
   `.env.development`, `.env.test`. Nilai di file yang lebih akhir **men-shadow** file
   sebelumnya (`.env` → `.env.<mode>` → `.env.local` → `.env.<mode>.local`), jadi kunci
   yang terlewat di file mode akan mematikan nilainya.
7. **`.next/dev/types/*` bisa korup** (terutama setelah rename/ganti type) → typecheck app
   gagal dengan error aneh di file generated. Fix: hapus `apps/<name>/.next/dev`, lalu
   jalankan ulang typecheck (Next akan regenerate).
8. **Setiap package yang bisa di-build butuh DUA tsconfig**: `tsconfig.json`
   (`noEmit`, untuk typecheck) + `tsconfig.build.json` (emit ke `dist/`, mengecualikan
   `**/*.spec.ts`). `@packages/auth` juga mengecualikan `src/next/**`.
9. **Prisma 7**: tidak ada `url` di schema (pakai adapter `@prisma/adapter-pg`), client
   di-generate ke `packages/db/src/generated/prisma` (gitignored). `typecheck` db sudah
   disetel untuk `prisma generate` dulu (lihat `packages/db/turbo.json`).
10. **Prisma client import-nya lazy** (`Proxy` di `packages/db/src/client.ts`) — aman
    di-import saat `next build` di CI tanpa `DATABASE_URL`; error hanya muncul saat query
    pertama. Jangan diganti jadi instance langsung.
11. **`transpilePackages` harus tetap berisi** `['@packages/ui', '@packages/auth']`
    (`configs/next/index.js`) — tanpa ini bundle Next gagal memproses source package.
12. **`turbo typecheck` dependsOn `^build`** — maka seluruh dependensi di-build dulu.
    Kalau tiba-tiba error "cannot find module" di dist, jalankan `pnpm build`.
13. **Tidak ada root `tsconfig.json`.** Semua workspace extend
    `@configs/typescript/{base,browser,react,node,nest}.json`.
14. **Prettier dikonfigurasi lewat field `"prettier"` di root `package.json`** (→
    `@configs/prettier`); tidak ada `.prettierrc`. Format `printWidth: 100`,
    `singleQuote: true`, `trailingComma: 'all'`.
15. **Jangan commit** `node_modules/`, `dist/`, `.next/`, `coverage/`, atau nilai `.env`
    (selain `.env.example`). `.opencode/` juga mengabaikan `node_modules`/`package.json`
    lockfiles-nya sendiri.
16. **Build NestJS pakai `tsc`** (bukan SWC/esbuild) — decorator metadata NestJS
    butuh plugin khusus. Jangan ganti builder sembarangan.

## 10. Fitur yang sudah ada (ringkas)

- **Register** → kirim email konfirmasi → redirect `/auth/verify-email?sent=1&email=...`
  (**tanpa auto-login**) → link `GET /auth/verify-email?token=` → redirect
  `/auth/login?verified=1`.
- **Login password** → scrypt + dummy-hash anti-timing-oracle; akun belum terverifikasi
  ditolak `EMAIL_NOT_VERIFIED` (403) dan tombol kirim-ulang muncul.
- **Login Google** (hanya `apps/web`) → `GET /api/auth/google` + `/callback`, cookie
  state `tj_oauth_state` anti-CSRF, find-or-create + auto-link, akun Google otomatis
  terverifikasi.
- **Lupa/reset password** → `forgotPasswordAction` (anti-enumerasi) → email tautan
  `${APP_URL}/auth/forgot-password/new-password?token=` → `resetPasswordAction` (zod)
  → token one-time `PasswordResetToken` (TTL `RESET_TOKEN_TTL_HOURS`, default 1 jam) →
  ganti hash + **cabut semua sesi** → redirect `/auth/login?reset=1`. Halaman aktif di
  web & admin.
- **Logout** mencabut sesi di DB (berdasar `jti`) + menghapus cookie.
- **Halaman terproteksi**: `(protected)/home` di web (matcher `/home/:path*`),
  `(protected)/dashboard` di admin (matcher `/dashboard/:path*`) — via `proxy.ts`.
- **REST API**: `GET /`, `POST /auth/register|login|logout`, `GET /auth/me`
  (Bearer token) — hanya untuk konsumen eksternal, bukan untuk Next app.
- **Belum ada**: GitHub OAuth (tipe ada, implementasi tidak), `not-found.tsx`/
  `loading.tsx`/`error.tsx`, isi dashboard admin.

Detail lengkap + daftar kandidat pekerjaan berikutnya → `references/state.md`.

## 11. Referensi

Baca sesuai kebutuhan, jangan semua sekaligus:

- `references/auth.md` — kontrak lengkap `@packages/auth`: exports map, 7 server action,
  metode domain, `AuthError`, format hash/JWT, cookie/guard, alur OAuth, verifikasi email
  & reset password.
- `references/packages.md` — API publik tiap package, prosedur "menambah X" (kontrak API,
  endpoint client, env var, tipe email, komponen UI, workspace baru), matriks tsconfig/modul.
- `references/apps.md` — peta route & boundary client/server tiap app, bootstrap
  `apps/api`, filter error, aturan `proxy.ts`.
- `references/state.md` — status fitur, tech-debt/gap yang disengaja, gaya commit,
  riwayat git, dan kandidat pekerjaan berikutnya.

### Menjaga skill ini tetap benar

Saat kontrak/aturan berubah (exports map, daftar error, env var, struktur package),
**perbarui file `references/` yang terdampak di sesi yang sama**. Setiap fakta dalam skill
ini harus dapat ditelusuri ke `path/file` — bila tidak yakin, buka filenya, jangan
lanjutkan berdasarkan ingatan.
