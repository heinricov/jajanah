# @packages/auth

**SSOT otentikasi** — satu-satunya tempat logika register/login/logout/verifikasi token, hashing password, pembuatan sesi, dan integrasi auth ke app didefinisikan. Dua lapisan dalam satu package:

- **`.` (root)** — mesin domain Node murni (`domain/`): `apps/api` cukup memanggil `authService`; HTTP-nya tetap di api.
- **`/next`** — integrasi Next.js (`next/`): `AuthProvider`/`useAuth` (client), server actions + guards (server), dan konstanta cookie — dikonsumsi `apps/web` & `apps/admin`. **Tidak ada route handler `/api/auth/*` per-app**; semua aksi memanggil domain langsung.

```
register/login  ─┐
logout          ─┼─►  @packages/auth  ─►  @packages/db (Auth + Session)
authenticate    ─┘        │
                          ├─ domain/password.ts  — scrypt + timingSafeEqual (zero-dep)
                          ├─ domain/token.ts     — JWT HS256 (jti → kolom Session.token)
                          ├─ domain/errors.ts    — AuthError { code, status } → filter di apps/api
                          └─ next/               — AuthProvider, server actions, guards, cookie (Next.js)
```

## Model sesi: JWT + Session (hybrid)

- Login menandatangani **JWT HS256** (`JWT_SECRET`) berisi `sub` (id Auth), `jti` (id sesi), `role`, `iat`, `exp`.
- `jti` disimpan di kolom **`Session.token`** — logout menghapus row, sehingga token yang sudah terbit **bisa di-revoke** (keunggulan dibanding JWT murni tanpa DB).
- `authenticate(token)` = verifikasi signature + exp → lookup `Session` by `jti` → cek `expiresAt` + `isActive`.
- Umur sesi: `AUTH_SESSION_TTL_HOURS` (default 168 jam = 7 hari), dipakai untuk `exp` JWT **dan** `Session.expiresAt`.

## Pemakaian

```ts
import { authService, AuthError, hashPassword, verifyPassword } from '@packages/auth';

// Register — email dinormalisasi (trim+lowercase), password discrypt, role USER
const user = await authService.register({
  name: 'Budi',
  email: 'budi@example.com',
  password: 'password123',
});

// Login — balas { token, expiresAt, user }; authAgent/ipAddress untuk audit
const { token, expiresAt, user } = await authService.login(
  { email: 'budi@example.com', password: 'password123' },
  { authAgent: 'curl/8', ipAddress: '127.0.0.1' },
);

// Verifikasi (dipakai AuthGuard apps/api)
const currentUser = await authService.authenticate(token);

// Logout — hapus row Session by jti (JWT langsung mati)
await authService.logout(token);
```

## Integrasi Next.js (`/next`)

Subpath untuk `apps/web` & `apps/admin` — **source export** (`src/next/*.ts`), di-compile konsumen lewat `transpilePackages: ['@packages/auth']` (lihat `configs/next`):

| Subpath                      | Isi                                                                                                          | Dipakai di                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| `@packages/auth/next`        | `AuthProvider`, `useAuth`, `authErrorMessage`                                                                | root layout, halaman auth (client) |
| `@packages/auth/next/server` | `getSessionUser`, `requireAuth`, `requireAdmin`, `loginAction`, `registerAction`, `logoutAction`, `meAction` | `(protected)/layout`, `app/layout` |
| `@packages/auth/next/cookie` | `SESSION_COOKIE` (`tj_token`) — tanpa `next/headers`                                                         | `proxy.ts` (edge)                  |

### Server actions, bukan route handler

Auth dijalankan lewat **Server Actions** (`'use server'`) yang ada di package ini — aplikasi Next **tidak mendefinisikan API apa pun**:

| Action           | Peran                                                                   |
| ---------------- | ----------------------------------------------------------------------- |
| `loginAction`    | `authService.login` → set cookie httpOnly → `{ ok: true, user }`        |
| `registerAction` | `authService.register` + auto-login → set cookie → `{ ok: true, user }` |
| `logoutAction`   | revoke sesi (best-effort) + hapus cookie → `{ ok: true }`               |
| `meAction`       | cookie → `authService.authenticate` → `{ ok: true, user \| null }`      |

Hasil gagal adalah objek polos `{ ok: false, status, code, message }` (class error tidak bisa melewati batas RPC) — `AuthProvider` menaikkannya kembali ke `AuthActionError`, sehingga kontrak error UI (`authErrorMessage`) tidak berubah. Server action juga membawa proteksi Origin/CSRF bawaan Next.

```tsx
// app/layout.tsx (server) — bootstrap user sekali render, tanpa fetch duplikat
<AuthProvider initialUser={await getSessionUser()}>{children}</AuthProvider>;

// app/(protected)/layout.tsx
export default async function Layout({ children }) {
  const user = await requireAuth(); // 401/invalid → redirect('/auth/login')
  return <AuthShell>{children}</AuthShell>;
}

// Halaman login (client) — tetap lewat useAuth(), tanpa fetch('/api/auth/...')
const { login } = useAuth();
await login({ email, password });
```

Desain: token hanya hidup di **cookie httpOnly** (tak pernah menyentuh JS) — `proxy.ts` melakukan cek keberadaan cookie (tanpa secret), verifikasi otoritatif ada di `requireAuth()`/`requireAdmin()` & `meAction` (langsung ke domain `authService`, tanpa HTTP ke `apps/api`; admin hanya role `ADMIN`). `/next/cookie` sengaja entry terpisah agar `proxy.ts` tidak menarik React/`next/headers` ke bundel edge.

Error domain memakai `AuthError` dengan `code` dari `API_ERROR_CODES` (`@packages/validators`):

| Code                  | Status | Kapan                                    |
| --------------------- | ------ | ---------------------------------------- |
| `EMAIL_TAKEN`         | 409    | email sudah terdaftar (+race P2002)      |
| `INVALID_CREDENTIALS` | 401    | email salah / password salah / non-aktif |
| `UNAUTHORIZED`        | 401    | token rusak/kedaluwarsa/sesi hilang      |

`AuthError` diterjemahkan exception filter `apps/api` (`AllExceptionsFilter`) ke envelope `{ error: { status, code, message } }` — kode error SSOT sampai ke `ApiHttpError` di `@packages/client`.

## Desain & alasan

- **Password: `crypto.scrypt`** (Node built-in, zero dependency) — format tersimpan `scrypt$N$r$p$salt$hash` (base64url), diverifikasi dengan `timingSafeEqual`. Verifikasi login dengan email yang tidak ada tetap menjalankan scrypt (hash dummy) agar **timing-nya setara** (anti timing-oracle).
- **JWT HS256 diimplementasikan sendiri** dengan `node:crypto` (bukan `jose` — lib itu ESM-only, bentrok dengan build CJS + jest repo ini). Verifikasi **tidak pernah mendispatch berdasar header `alg`** (selalu hitung ulang HMAC) → bebas algorithm-confusion; signature dibanding `timingSafeEqual`.
- **`JWT_SECRET` dibaca lazily** dari env (bukan di module-load) — unit test bisa mengaturnya & aplikasi gagal jelas saat secret kosong.
- **Password tidak pernah ikut response**: mapping Prisma → `AuthUser` hanya memilih field aman, lalu di-`parse` `authUserSchema` (SSOT).
- Logging sengaja **tidak** di package ini — log HTTP (request completed + error dari filter) sudah membawa `requestId`/`userId` via ALS `@packages/logger`.

## Environment

| Variabel                 | Default   | Deskripsi                                                                              |
| ------------------------ | --------- | -------------------------------------------------------------------------------------- |
| `JWT_SECRET`             | — (wajib) | Tanda tangan JWT HS256. Buat: `openssl rand -base64 48`. Hanya di `.env` (gitignored). |
| `AUTH_SESSION_TTL_HOURS` | `168`     | Umur sesi (jam). Tidak valid → fallback default.                                       |

Nilai env dibaca via `@packages/environment` (root `.env*`, SSOT).

## Struktur

```
packages/auth/
├── package.json          # exports: ".", "./next", "./next/server", "./next/cookie"
├── tsconfig.json         # extends node.json; + jsx react-jsx, lib DOM, include .tsx
├── tsconfig.build.json   # emit CJS + d.ts → dist/ (spec & src/next/** di-exclude)
├── eslint.config.mjs     # re-export @configs/eslint/react
└── src/
    ├── index.ts              # aggregator publik root: re-export dari domain/
    ├── domain/               # mesin auth (Node + Prisma)
    │   ├── auth.service.ts   # register / login / logout / authenticate
    │   ├── password.ts       # hashPassword / verifyPassword (scrypt)
    │   ├── token.ts          # signSessionToken / verifySessionToken (JWT HS256)
    │   ├── errors.ts         # AuthError { code, status }
    │   ├── seed.ts           # seed idempotent admin + user demo (dipanggil @packages/db)
    │   └── *.spec.ts         # unit test domain
    └── next/                 # integrasi Next.js
        ├── index.ts          # AuthProvider, useAuth, authErrorMessage, SESSION_COOKIE
        ├── auth-provider.tsx # 'use client' — context + panggil server actions
        ├── cookie.ts         # SESSION_COOKIE (entry edge-safe)
        ├── errors.ts         # AuthActionError + authErrorMessage
        └── server/           # guards, server actions, opsi kuki (+ spec)
            ├── actions.ts    # 'use server' — login/register/logout/me (ke domain langsung)
            ├── action-types.ts # tipe hasil JSON { ok, ... }
            ├── guards.ts     # getSessionUser / requireAuth / requireAdmin
            └── cookie-options.ts
```

## Perintah

| Perintah                                 | Deskripsi                        |
| ---------------------------------------- | -------------------------------- |
| `pnpm --filter @packages/auth lint`      | ESLint (`@configs/eslint/react`) |
| `pnpm --filter @packages/auth typecheck` | `tsc --noEmit`                   |
| `pnpm --filter @packages/auth test`      | Unit test (Jest + ts-jest)       |
| `pnpm --filter @packages/auth build`     | Compile ke `dist/` (CJS + d.ts)  |

## Catatan

- **Domain `.` = Node-only** (`node:crypto`, `NodeNext`, emit CJS ke `dist/`). **`/next` = source export** (`src/next/**`) yang di-compile Next/Turbopack di app konsumen — karena `require('next/headers'|'next/navigation'|'next/server')` dari **dist CJS kehilangan binding-nya** saat dibundel Turbopack (memicu `ReferenceError: server_1 is not defined`), sedangkan jalur source ESM aman. Build `dist/` sengaja mengecualikan `src/next/**` (termasuk server actions).
- Karena `guards.ts`/`actions.ts` menarik domain (→ `@packages/environment`), kedua app Next kini membaca root `.env` (DB/JWT) langsung; `fs.existsSync` dinamis di loader env diberi `/*turbopackIgnore: true*/` agar Turbopack tidak men-trace seluruh project ke NFT.
- `next`/`react` dideklarasikan sebagai **peerDependencies _optional_** — `apps/api` (Nest) yang hanya memakai root tidak ikut menarik react/next, sementara web/admin sudah memilikinya sendiri.
- Konsumen menambahkan `"@packages/auth": "workspace:*"`; `dist/` di-ignore — jalankan `pnpm build` (Turbo mengurutkan `^build` dulu).
- Unit test domain **mem-mock `@packages/db`** (`jest.mock`) supaya tidak butuh koneksi DB & aman di CI (tanpa `.env`); unit test `next/server` mem-mock `next/headers`.
- Batas panjang password (8..128) didefinisikan di `@packages/validators` (schema + DTO) — `password.ts` hanya mengekspor konstanta pendampingnya.
- **Seed data** ada di `src/domain/seed.ts` (akun admin + user demo, idempotent) dan dijalankan lewat `pnpm --filter @packages/db db:seed` (`prisma db seed` → `node ../auth/dist/domain/seed.js`). Ada di package ini — bukan `@packages/db` — karena `db → auth` akan membuat siklus task Turbo.
- Menambah field sesi baru: ubah `schema.prisma` (`Session`) → `pnpm --filter @packages/db migrate` → sesuaikan `domain/auth.service.ts`.
