# Status proyek — fitur, gap, riwayat, pekerjaan berikutnya

Diverifikasi pada commit **`0a852ff`** (branch `main`, remote
`github.com/heinricov/jajanah`, working tree bersih saat skill dibuat).
Perbarui bagian ini setiap kali fitur besar selesai.

## 1. Posisi saat ini

Platform **autentikasi** yang lengkap dan teruji, di atas kerangka monorepo SSOT.
**Fitur domain bisnis (`jajanah` sebagai produk) belum ada** — belum ada model, endpoint,
atau halaman selain auth/dashboard-shell. Bila user mengarah ke scope produk (mis. jual
beli/makanan), konfirmasi dulu sebelum menggali schema bisnis.

Statistik: 148 test / 17 suite (semua hijau), CI 5 langkah, 14 workspace
(3 app, 8 package, 4 configs + scripts), 25 commit, penulis tunggal.

## 2. Peta fitur

| Fitur | Lokasi | Status |
| --- | --- | --- |
| Landing publik + demo health API | `apps/web/app/page.tsx`, `components/health-status.tsx` | ✅ |
| Register email+password → email konfirmasi → **tanpa auto-login** | `auth.service.register`, `registerAction`, `apps/web/app/auth/register` | ✅ |
| Verifikasi email (token one-time, TTL 24 jam, kirim ulang) | `auth.service.{requestEmailVerification,verifyEmail}`, `apps/web/app/auth/verify-email` | ✅ |
| Login password (scrypt + anti timing-oracle, blokir belum verifikasi 403) | `auth.service.login`, `loginAction` | ✅ |
| Google OAuth (web saja; state cookie, safeNext, auto-link) | `packages/auth/src/next/oauth.ts`, `apps/web/app/api/auth/google*` | ✅ |
| Logout revocable (DB `jti`) + cookie clear | `auth.service.logout`, `logoutAction` | ✅ |
| Guard: `requireAuth` / `requireAdmin` + `proxy.ts` 2 lapis | `packages/auth/src/next/server/guards.ts`, `apps/*/proxy.ts` | ✅ |
| Navbar user-aware + menu Logout | `packages/ui/src/navigations`, `apps/web/components/site-navbar.tsx` | ✅ |
| Shell dashboard admin (sidebar shadcn) | `packages/ui/src/dashboard`, `apps/admin/app/(protected)` | ⚠️ **isi placeholder** (data contoh shadcn, halaman teks "ini untuk admin") |
| REST API auth (`/auth/*` Bearer) + filter error envelope | `apps/api/src/{auth,filters}` | ✅ (dipakai konsumen eksternal saja) |
| Logger terstruktur (ALS requestId, redaction) | `packages/logger` | ✅ |
| Env loader + port bin + CI | `packages/environment`, `configs/next`, `.github/workflows` | ✅ |
| **Forgot/reset password** | 4 halaman stub + `FormForgotPassword`/`FormNewPassword` | ❌ **stub disabled** (UI saja, backend belum ada) |
| GitHub OAuth | tipe `SocialProvider = 'google' \| 'github'` di `packages/ui/src/auth/social-buttons.tsx` | ❌ dideklarasikan, belum diimplementasi ("github menyusul") |
| `not-found.tsx` / `loading.tsx` / `error.tsx` | kedua app Next | ❌ belum ada (pakai default Next) |
| Email konfirmasi untuk registrasi via REST API | `apps/api/src/auth/auth.controller.ts` | ❌ **belum ada path email** — hanya server action |

## 3. Gap / tech-debt yang disengaja (bukan lupa)

- **Pin tooling** (terdokumentasi di root README §"Catatan tooling"): ESLint ^9
  (`eslint-config-next` belum dukung v10), Prisma dikunci v7 (v8 = config shape baru),
  PostCSS **string form** (lightningcss/Turbopack), NestJS builder `tsc`
  (decorator metadata), JWT hand-rolled (`jose` ESM-only pecah di build CJS+jest).
- **CORS terbuka** di `apps/api/src/main.ts` (`enableCors()` tanpa opsi) — README
  menyarankan origin allowlist untuk produksi.
- **Tidak ada test** untuk `ui`, `web`, `admin`, `environment`, `validators`, `configs/*`.
- **Seed men-backfill `emailVerifiedAt`** akun demo agar login tetap jalan (disebabkan
  fitur verifikasi email).
- Admin sengaja **tanpa login Google dan tanpa self-register** (akun admin via seed/DB).
- `apps/api` tidak punya jalur email konfirmasi (server action Next = jalur utama web).
- Paket `@packages/validators` memakai class-validator decorators → tsconfig extend
  preset `nest`, tapi `types: []` + eslint preset `base` (browser-safe).

## 4. Dokumen yang terbukti basi (candidate perbaikan docs)

| Lokasi | Klaim yang sudah tidak benar |
| --- | --- |
| `README.md:22` | `scripts/ # Script operasional (masih kosong)` — padahal `scripts/dev.mjs` sudah ada |
| `apps/web/README.md:41` | *"tidak ada `app/api/`"* — padahal sudah ada 2 route handler OAuth |
| `packages/db/README.md:9,18,55-56` | menyebut hanya model `Auth` & `Session` — schema kini punya `OAuthAccount` + `EmailVerificationToken` |

## 5. Konvensi commit

Format: **`<area> - <deskripsi Bahasa Indonesia, satu baris padat>`**
(boleh sangat panjang; berisi daftar perubahan utama dipisah koma, bukan body).

Contoh:

```
auth - konfirmasi email registrasi: blok login sampai terverifikasi (EMAIL_NOT_VERIFIED 403),
package @packages/email (adapter Resend + fallback console), token one-time
EmailVerificationToken + migrasi, register tanpa auto-login + halaman /auth/verify-email,
tombol kirim ulang dari cek-email & login, panduan README + env baru (...)
```

`<area>` yang pernah dipakai: `auth`, `ui`, `packages/ui`, `apps`, `apps/api`, `db`,
`configs/next`, `vscode`. Fitur biasa menggabungkan kode + test + migrasi + README dalam
satu commit. **Commit hanya bila user memintanya** (aturan sesi opencode).

Urutan verifikasi sebelum commit: `pnpm format` → `pnpm check` → `pnpm test` → `pnpm build`.

## 6. Riwayat (kelompok fitur)

| # | Kelompok | Commit |
| --- | --- | --- |
| 1 | Bootstrap monorepo (ui, apps, environment, api, configs/next) | `56c40c0` … `d4202e6` |
| 2 | Paket SSOT inti (db, validators, client, logger) | `40ffbc5`, `56448c0`, `9a8e595`, `f862bd4` |
| 3 | Auth domain + model + seed | `5c6080e`, `eb00acc` |
| 4 | UI auth shadcn props-driven | `cbe09b8`, `d00deea` |
| 5 | Server actions menggantikan route handler `/api/auth` | `5cb6f95` |
| 6 | Prisma lazy (build CI tanpa `DATABASE_URL`) | `4c6dde6` |
| 7 | Navbar/Footer/layout + VS Code 3-tab | `de47e04`, `d127dcb`, `7f54886` |
| 8 | **Google OAuth** | `d6e4a1e` |
| 9 | Navbar pakai `UserAuth` + logout | `b43c2c2` |
| 10 | **Konfirmasi email registrasi** + `@packages/email` | `0a852ff` (HEAD) |

## 7. Kandidat pekerjaan berikutnya

1. **Forgot/reset password** — `PasswordResetToken` di `schema.prisma` + migrasi;
   `requestPasswordReset`/`resetPassword` di `auth.service.ts`; template email baru di
   `packages/email` (lihat prosedur di `packages.md`); server action; nyalakan
   `FormForgotPassword`/`FormNewPassword` + 4 halaman stub (web & admin).
2. **Fitur domain bisnis pertama** — model Prisma → kontrak `@packages/validators` →
   controller `apps/api` → method `@packages/client` → halaman `apps/web` (urutan ini
   mengikuti alur SSOT).
3. **Isi dashboard admin** — ganti data contoh di `packages/ui/src/dashboard/*`
   (hapus `// This is sample data.`) + isi `apps/admin/app/(protected)/dashboard/page.tsx`.
4. **UX boundary Next** — `not-found.tsx`, `loading.tsx`, `error.tsx` di kedua app.
5. **Test yang belum ada** — `@packages/environment` (precedence loader) & komponen
   `@packages/ui` (ingat: `testRegex` hanya `.spec.ts`).
6. **GitHub OAuth** atau hapus dari tipe `SocialProvider` (pola `next/oauth.ts` tinggal
   ditambah provider kedua).
7. **Perbaiki doc-drift** di §4 + tambahkan model baru ke README `packages/db`.
8. **CORS allowlist** di `apps/api` (env baru → ikuti prosedur di `packages.md`).

## 8. Data demo & DB

| Email | Password | Role |
| --- | --- | --- |
| `admin@jajanah.local` | `admin123` | ADMIN |
| `user@jajanah.local` | `user1234` | USER |

Migrasi (urut): `20260926112330_auth` → `20260928064048` (OAuth, `password` jadi nullable)
→ `20260928101815_email_verification` (emailVerifiedAt + EmailVerificationToken).
Jalankan `pnpm --filter @packages/db db:seed` untuk idempoten seed + backfill.
