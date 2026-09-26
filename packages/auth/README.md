# @packages/auth

**SSOT domain otentikasi** — satu-satunya tempat logika register/login/logout/verifikasi token, hashing password, dan pembuatan sesi didefinisikan. `apps/api` cukup memanggil `authService` dari package ini (HTTP-nya tetap di api), sehingga tidak ada logika auth yang terpecah antar app.

```
register/login  ─┐
logout          ─┼─►  @packages/auth  ─►  @packages/db (Auth + Session)
authenticate    ─┘        │
                          ├─ password.ts  — scrypt + timingSafeEqual (zero-dep)
                          ├─ token.ts     — JWT HS256 (jti → kolom Session.token)
                          └─ errors.ts    — AuthError { code, status } → filter di apps/api
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
├── package.json          # @packages/auth; deps: @packages/db, @packages/environment, @packages/validators
├── tsconfig.json         # extends @configs/typescript/node.json (+ types jest)
├── tsconfig.build.json   # emit CJS → dist/ (spec di-exclude)
├── eslint.config.mjs     # re-export @configs/eslint/node
└── src/
    ├── index.ts          # export authService, AuthError, hash/verifyPassword, token helpers
    ├── password.ts       # hashPassword / verifyPassword (scrypt, guard parameter)
    ├── token.ts          # signSessionToken / verifySessionToken (JWT HS256) + TTL
    ├── errors.ts         # AuthError { code, status }
    ├── auth.service.ts   # register / login / logout / authenticate (pakai prisma)
    ├── seed.ts           # seed idempotent admin + user demo (dijalankan dari @packages/db)
    ├── password.spec.ts  # roundtrip, salt unik, stored hash rusak
    ├── token.spec.ts     # roundtrip, tamper, expired, alg pinning, secret salah
    └── auth.service.spec.ts  # skenario DB via jest.mock('@packages/db')
```

## Perintah

| Perintah                                 | Deskripsi                       |
| ---------------------------------------- | ------------------------------- |
| `pnpm --filter @packages/auth lint`      | ESLint (`@configs/eslint/node`) |
| `pnpm --filter @packages/auth typecheck` | `tsc --noEmit`                  |
| `pnpm --filter @packages/auth test`      | Unit test (Jest + ts-jest)      |
| `pnpm --filter @packages/auth build`     | Compile ke `dist/` (CJS + d.ts) |

## Catatan

- **Node-only** (pakai `node:crypto`), resolusi `NodeNext`, emit CJS — sama seperti `@packages/db`/`@packages/logger`.
- Konsumen menambahkan `"@packages/auth": "workspace:*"`; `dist/` di-ignore — jalankan `pnpm build` (Turbo mengurutkan `^build` dulu).
- Unit test **mem-mock `@packages/db`** (`jest.mock`) supaya tidak butuh koneksi DB & aman di CI (tanpa `.env`).
- Batas panjang password (8..128) didefinisikan di `@packages/validators` (schema + DTO) — `password.ts` hanya mengekspor konstanta pendampingnya.
- **Seed data** ada di `src/seed.ts` (akun admin + user demo, idempotent) dan dijalankan lewat `pnpm --filter @packages/db db:seed` (`prisma db seed` → `node ../auth/dist/seed.js`). Ada di package ini — bukan `@packages/db` — karena `db → auth` akan membuat siklus task Turbo.
- Menambah field sesi baru: ubah `schema.prisma` (`Session`) → `pnpm --filter @packages/db migrate` → sesuaikan `auth.service.ts`.
