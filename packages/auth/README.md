# @packages/auth

**SSOT otentikasi** — satu-satunya tempat logika register/login/logout/verifikasi token, hashing password, pembuatan sesi, dan integrasi auth ke app didefinisikan. Dua lapisan dalam satu package:

- **`.` (root)** — mesin domain Node murni (`domain/`): `apps/api` cukup memanggil `authService`; HTTP-nya tetap di api.
- **`/next`** — integrasi Next.js (`next/`): `AuthProvider`/`useAuth` (client), server actions + guards (server), gateway OAuth Google (`next/oauth`), dan konstanta cookie — dikonsumsi `apps/web` & `apps/admin`. **Tidak ada route handler `/api/auth/*` per-app**; semua aksi memanggil domain langsung — _kecuali_ `/api/auth/google/*` di `apps/web` (lihat "Login dengan Google").

```
register/login   ─┐
verify email     ─┼─►  @packages/auth  ─►  @packages/db (Auth + Session + token verifikasi)
logout           ─┤        │
authenticate     ─┘        ├─ domain/password.ts  — scrypt + timingSafeEqual (zero-dep)
                           ├─ domain/token.ts     — JWT HS256 (jti → kolom Session.token)
                           ├─ domain/errors.ts    — AuthError { code, status } → filter di apps/api
                           ├─ next/               — AuthProvider, server actions, guards, cookie (Next.js)
                           └─ @packages/email     — kirim email konfirmasi (Resend / fallback console)
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

| Subpath                              | Isi                                                                                                                                                        | Dipakai di                           |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `@packages/auth/next`                | `AuthProvider`, `useAuth`, `authErrorMessage`                                                                                                              | root layout, halaman auth (client)   |
| `@packages/auth/next/server`         | `getSessionUser`, `requireAuth`, `requireAdmin`, `loginAction`, `registerAction`, `logoutAction`, `meAction`                                               | `(protected)/layout`, `app/layout`   |
| `@packages/auth/next/server/actions` | server actions langsung (`'use server'`) — **dipakai komponen client**: barrel `/next/server` menarik `next/headers`/domain ke bundle client → error build | halaman login + `ResendVerification` |
| `@packages/auth/next/cookie`         | `SESSION_COOKIE` (`tj_token`) — tanpa `next/headers`                                                                                                       | `proxy.ts` (edge)                    |
| `@packages/auth/next/oauth`          | `beginGoogleOAuth`, `completeGoogleOAuth` (gateway OAuth Google)                                                                                           | route handler `/api/auth/google*`    |

### Server actions, bukan route handler

Auth dijalankan lewat **Server Actions** (`'use server'`) yang ada di package ini — aplikasi Next **tidak mendefinisikan API apa pun** (satu pengecualian: `/api/auth/google/*`, lihat "Login dengan Google"):

| Action                     | Peran                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `loginAction`              | `authService.login` → set cookie httpOnly → `{ ok: true, user }`                                                               |
| `registerAction`           | `authService.register` (**tanpa auto-login**) + kirim email konfirmasi → `{ ok: true, user, requiresEmailVerification: true }` |
| `resendVerificationAction` | `requestEmailVerification` + kirim ulang email → `{ ok: true }` selalu (respons identis — anti-enumerasi)                      |
| `forgotPasswordAction`     | `requestPasswordReset` + kirim tautan reset → `{ ok: true }` selalu (respons identis — anti-enumerasi)                         |
| `resetPasswordAction`      | validasi zod → `resetPassword` (password baru + cabut semua sesi) → `{ ok: true, user }`                                       |
| `logoutAction`             | revoke sesi (best-effort) + hapus cookie → `{ ok: true }`                                                                      |
| `meAction`                 | cookie → `authService.authenticate` → `{ ok: true, user \| null }`                                                             |

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

| Code                     | Status | Kapan                                                  |
| ------------------------ | ------ | ------------------------------------------------------ |
| `EMAIL_TAKEN`            | 409    | email sudah terdaftar (+race P2002)                    |
| `EMAIL_NOT_VERIFIED`     | 403    | login password sebelum konfirmasi email pertama        |
| `INVALID_CREDENTIALS`    | 401    | email salah / password salah / non-aktif               |
| `UNAUTHORIZED`           | 401    | token rusak/kedaluwarsa/sesi hilang                    |
| `OAUTH_ACCOUNT_LINKED`   | 409    | `(provider, providerId)` sudah tertaut ke akun lain    |
| `OAUTH_EMAIL_UNVERIFIED` | 400    | `email_verified` di ID token Google false              |
| `INVALID_VERIFY_TOKEN`   | 400    | tautan konfirmasi hilang/kedaluwarsa/sudah dipakai     |
| `INVALID_RESET_TOKEN`    | 400    | tautan reset password hilang/kedaluwarsa/sudah dipakai |

`AuthError` diterjemahkan exception filter `apps/api` (`AllExceptionsFilter`) ke envelope `{ error: { status, code, message } }` — kode error SSOT sampai ke `ApiHttpError` di `@packages/client`.

## Konfirmasi email registrasi

Registrasi **email + password** wajib dikonfirmasi dulu lewat email — sampai saat itu `login` menolak dengan `EMAIL_NOT_VERIFIED` (403). Akun OAuth Google tidak terpengaruh (Google sudah memverifikasi emailnya → `emailVerifiedAt` langsung terisi).

```
registerAction (apps/web)
  → authService.register                — buat akun, emailVerifiedAt = null
  → authService.requestEmailVerification — token acak 32 byte, TTL VERIFY_TOKEN_TTL_HOURS (default 24 jam),
                                           token lama dinonaktifkan (hanya tautan terbaru berlaku)
  → @packages/email sendConfirmation     — link ${APP_URL}/auth/verify-email?token=…
                                           (gagal kirim TIDAK membatalkan pendaftaran → tombol kirim ulang)
  → { ok: true, requiresEmailVerification: true } — TANPA auto-login → redirect /auth/verify-email?sent=1

GET /auth/verify-email?token=… (server component — tanpa route handler)
  → authService.verifyEmail              — token valid: tandai emailVerifiedAt + hapus semua token (sekali pakai)
                                           → redirect /auth/login?verified=1 (tanpa auto-login)
  → token hilang/kedaluwarsa            — INVALID_VERIFY_TOKEN (400) → kartu "tautan tidak valid"

loginAction
  → password ok + isActive tapi emailVerifiedAt null → EMAIL_NOT_VERIFIED (403)
  → UI menampilkan pesan ramah + tombol "Kirim ulang email konfirmasi" (resendVerificationAction)
```

- Token disimpan di tabel `EmailVerificationToken` (unik, one-time — dihapus saat dipakai/diganti), bukan JWT — supaya bisa di-revoke lewat kirim ulang.
- `requestEmailVerification` mengembalikan `null` untuk email tak dikenal/sudah terverifikasi; `resendVerificationAction` tetap membalas `{ ok: true }` (respons identis — anti-enumerasi).
- Pengiriman email ada di [`@packages/email`](../email/README.md) (adapter Resend, fallback console saat `RESEND_API_KEY` kosong).
- Seed admin/user demo ditandai terverifikasi otomatis (`db:seed` melakukan backfill `emailVerifiedAt` untuk akun lama).

## Reset password (lupa password)

User lupa password → minta tautan reset via email → buka tautan → set password baru. Tautan **one-time** dengan TTL pendek (`RESET_TOKEN_TTL_HOURS`, default 1 jam), dan sukses reset **mencabut semua sesi** akun (perangkat lain dipaksa masuk ulang).

```
GET /auth/forgot-password (client component)
  → forgotPasswordAction(email)
  → authService.requestPasswordReset — token acak 32 byte, TTL RESET_TOKEN_TTL_HOURS (default 1 jam),
                                       token lama dinonaktifkan (hanya tautan terbaru berlaku)
  → @packages/email sendPasswordReset — link ${APP_URL}/auth/forgot-password/new-password?token=…
                                        (gagal kirim TIDAK membatalkan permintaan)
  → { ok: true } selalu — kartu "Check your inbox" tampil entah email dikenal (anti-enumerasi)

GET /auth/forgot-password/new-password?token=… (server component — tanpa route handler)
  → tanpa token → kartu "tautan tidak valid"
  → ada token → form client ResetPasswordForm
       → resetPasswordAction({ token, password }) — validasi zod (token 1..256, password 8..128)
       → authService.resetPassword — token valid: ganti hash password, hapus semua token reset,
                                     cabut SEMUA sesi → { ok: true, user }
                                     → redirect /auth/login?reset=1 (tanpa auto-login)
       → token hilang/kedaluwarsa → INVALID_RESET_TOKEN (400) → notice merah, form tetap terbuka
```

- Token disimpan di tabel `PasswordResetToken` (unik, one-time) — pola sama dengan `EmailVerificationToken`.
- `requestPasswordReset` mengembalikan `null` untuk email tak dikenal/akun nonaktif; `forgotPasswordAction` tetap membalas `{ ok: true }` (respons identis — anti-enumerasi).
- Akun **OAuth-only** (`password: null`) **boleh** reset — bukti kontrol email cukup untuk menyetel password pertama.
- Reset **tidak** menandai `emailVerifiedAt`: akun yang belum konfirmasi registrasi tetap harus membuka tautan konfirmasi setelahnya (login masih ditolak `EMAIL_NOT_VERIFIED` sampai saat itu).
- Tautan selalu mengarah ke halaman `apps/web` (basis `APP_URL`) — alur konfirmasi email juga begitu; akun admin cukup ganti password di sana lalu login kembali di panel admin.

## Login dengan Google (OAuth)

Login/register lewat akun Gmail (hanya **`apps/web`** — admin sengaja tidak, karena akun Google selalu `role: USER` dan panel admin butuh `role: ADMIN`). Logika ada di `next/oauth.ts` + `authService.oauthLogin` (find-or-create + **link otomatis**); aplikasi hanya punya 2 route handler tipis:

```
Tombol "Continue with Google"
  → GET /api/auth/google            (beginGoogleOAuth: set cookie state, redirect ke consent screen Google)
  → Google consent screen
  → GET /api/auth/google/callback   (completeGoogleOAuth: validasi state, tukar kode, verifikasi ID token,
                                      resolveGooglePicture → foto profil, authService.oauthLogin → set cookie sesi tj_token)
  → redirect /home (atau ?error=… bila gagal)
```

Kenapa route handler? OAuth2 butuh `redirect_uri` GET yang terdaftar di Google Console — server action tidak punya endpoint GET. Ini **satu-satunya pengecualian** aturan "tanpa route `/api/auth/*`"; semua logika tetap di package ini.

Perilaku akun:

- Email **baru** → akun dibuat (`password: null`, `role: USER`) + baris `OAuthAccount(provider, providerId)` unik.
- Email **sudah ada** (akun password) → otomatis **di-link**; kedua cara login (password & Google) tetap bisa dipakai paralel.
- `(provider, providerId)` sudah tertaut ke akun lain → `OAUTH_ACCOUNT_LINKED`.
- `email_verified: false` di ID token → `OAUTH_EMAIL_UNVERIFIED`.
- **Foto profil** diambil dari claim `picture` ID token; bila kosong, GET ke endpoint userinfo memakai `access_token` yang sudah dipegang (`resolveGooglePicture`). Hasilnya disimpan ke `OAuthAccount.image` **dan** `Auth.image` — `Auth.image` inilah yang dirender `UserAuth` (navbar) & `NavUser` (sidebar admin).

### Setup: dapatkan `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`

Kedua variabel dibaca dari **root `.env`** (SSOT `@packages/environment`; jangan commit — `.env` sudah gitignored). Langkah lengkap di [Google Cloud Console](https://console.cloud.google.com/):

1. **Buat project** — di console, klik project picker (header) → **NEW PROJECT** → nama bebas (mis. `jajanah`) → **CREATE** → tunggu jadi project aktif.
2. **OAuth consent screen** — menu **APIs & Services → OAuth consent screen**:
   - User Type: **External** → **CREATE**.
   - _App information_: App name (mis. `jajanah`), _User support email_: pilih email Anda → **SAVE AND CONTINUE**.
   - _Scopes_: **ADD OR REMOVE SCOPES** → cari & pilih `openid`, `email`, `profile` (cukup 3 ini) → **UPDATE** → **SAVE AND CONTINUE**.
   - _Test users_: **ADD USERS** → masukkan **email Gmail Anda** (selama status _Testing_, hanya email di daftar ini yang boleh login) → **SAVE AND CONTINUE**.
   - _Summary_ → **BACK TO DASHBOARD**.
3. **OAuth client ID** — menu **APIs & Services → Credentials → CREATE CREDENTIALS → OAuth client ID**:
   - _Application type_: **Web application**.
   - _Name_: bebas (mis. `jajanah-web`).
   - _Authorized redirect URIs_ → **ADD URI**, isi **persis** (skema/host/port/path):
     - dev: `http://localhost:3000/api/auth/google/callback`
     - prod (bila deploy): `https://<domain-anda>/api/auth/google/callback`
   - **CREATE** → dialog menampilkan **Client ID** dan **Client Secret** → salin.
4. **Isi `.env`** di root repo:

   ```bash
   GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx
   ```

   (baris komentar sudah tersedia di `.env.example` — salin ke `.env` lalu isi nilainya)

5. **Restart dev server** (buka ulang folder → auto-task, atau `pnpm dev`) → buka `http://localhost:3000/auth/login` → klik **Continue with Google**.

Troubleshooting & catatan:

- **`redirect_uri_mismatch`** di Google → URI yang dibaca Google tidak persis sama dengan di langkah 3 (harus sama termasuk `http`/`https`, port, tanpa trailing slash).
- **`access_blocked` / "app belum diverifikasi"** → user bukan _test user_. Tambahkan di langkah 2, atau klik **Publish app** di OAuth consent screen (scope `email`/`profile` biasanya lolos verifikasi otomatis).
- **Tambah user lain tanpa publish** → tambahkan emailnya ke _Test users_.
- Kredensial kosong → halaman login menampilkan pesan `oauth_config` ("Login Google belum dikonfigurasi di server").
- Callback gagal (state kedaluwarsa, kode ditolak Google, dsb) → redirect ke `/auth/login?error=oauth` (+ pesan sesuai kode error).

## Desain & alasan

- **Password: `crypto.scrypt`** (Node built-in, zero dependency) — format tersimpan `scrypt$N$r$p$salt$hash` (base64url), diverifikasi dengan `timingSafeEqual`. Verifikasi login dengan email yang tidak ada tetap menjalankan scrypt (hash dummy) agar **timing-nya setara** (anti timing-oracle).
- **JWT HS256 diimplementasikan sendiri** dengan `node:crypto` (bukan `jose` — lib itu ESM-only, bentrok dengan build CJS + jest repo ini). Verifikasi **tidak pernah mendispatch berdasar header `alg`** (selalu hitung ulang HMAC) → bebas algorithm-confusion; signature dibanding `timingSafeEqual`.
- **`JWT_SECRET` dibaca lazily** dari env (bukan di module-load) — unit test bisa mengaturnya & aplikasi gagal jelas saat secret kosong.
- **Password tidak pernah ikut response**: mapping Prisma → `AuthUser` hanya memilih field aman, lalu di-`parse` `authUserSchema` (SSOT).
- **Avatar disimpan di dua kolom**: `OAuthAccount.image` (foto menurut penyedia itu — sumber kebenaran per penyedia) dan `Auth.image` (foto yang dipakai aplikasi). `oauthLogin` selalu menimpa `Auth.image` dengan foto terbaru. Tiga nilai berbeda: `string` = simpan, `null` = "penyedia memastikan tanpa foto" → kosongkan, `undefined` = gagal dipastikan (foto gagal diambil, URL tidak valid) → **nilai lama dibiarkan**. Alasan kegagalan jaringan tidak boleh menghapus avatar, dan login tidak pernah gagal hanya karena foto.
- Logging sengaja **tidak** di package ini — log HTTP (request completed + error dari filter) sudah membawa `requestId`/`userId` via ALS `@packages/logger`.

## Environment

| Variabel                 | Default                 | Deskripsi                                                                                            |
| ------------------------ | ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `JWT_SECRET`             | — (wajib)               | Tanda tangan JWT HS256. Buat: `openssl rand -base64 48`. Hanya di `.env` (gitignored).               |
| `AUTH_SESSION_TTL_HOURS` | `168`                   | Umur sesi (jam). Tidak valid → fallback default.                                                     |
| `VERIFY_TOKEN_TTL_HOURS` | `24`                    | Umur tautan konfirmasi email (jam). Tidak valid → fallback default.                                  |
| `RESET_TOKEN_TTL_HOURS`  | `1`                     | Umur tautan reset password (jam). Tidak valid → fallback default.                                    |
| `APP_URL`                | `http://localhost:3000` | Basis URL tautan email (`/auth/verify-email?token=…`, `/auth/forgot-password/new-password?token=…`). |
| `GOOGLE_CLIENT_ID`       | —                       | OAuth client ID Google (Web application). Kosong → `oauth_config` (hanya apps/web).                  |
| `GOOGLE_CLIENT_SECRET`   | —                       | OAuth client secret Google. Isi di root `.env` — panduan: "Login dengan Google (OAuth)".             |

Nilai env dibaca via `@packages/environment` (root `.env*`, SSOT). Pengiriman email memakai `RESEND_API_KEY` & `MAIL_FROM` — lihat [`@packages/email`](../email/README.md).

## Struktur

```
packages/auth/
├── package.json          # exports: ".", "./next", "./next/server", "./next/server/actions", "./next/cookie", "./next/oauth"
├── tsconfig.json         # extends node.json; + jsx react-jsx, lib DOM, include .tsx
├── tsconfig.build.json   # emit CJS + d.ts → dist/ (spec & src/next/** di-exclude)
├── eslint.config.mjs     # re-export @configs/eslint/react
└── src/
    ├── index.ts              # aggregator publik root: re-export dari domain/
    ├── domain/               # mesin auth (Node + Prisma)
    │   ├── auth.service.ts   # register / login / logout / authenticate / oauthLogin / requestEmailVerification / verifyEmail / requestPasswordReset / resetPassword
    │   ├── password.ts       # hashPassword / verifyPassword (scrypt)
    │   ├── token.ts          # signSessionToken / verifySessionToken (JWT HS256) + getVerifyTtlHours / getResetTtlHours
    │   ├── errors.ts         # AuthError { code, status }
    │   ├── seed.ts           # seed idempotent admin + user demo (backfill emailVerifiedAt)
    │   └── *.spec.ts         # unit test domain
    └── next/                 # integrasi Next.js
        ├── index.ts          # AuthProvider, useAuth, authErrorMessage, SESSION_COOKIE
        ├── auth-provider.tsx # 'use client' — context + panggil server actions
        ├── cookie.ts         # SESSION_COOKIE (entry edge-safe)
        ├── errors.ts         # AuthActionError + authErrorMessage
        ├── oauth.ts          # beginGoogleOAuth / completeGoogleOAuth (state + Google OAuth2)
        └── server/           # guards, server actions, opsi kuki (+ spec)
            ├── actions.ts    # 'use server' — login/register/resend/forgot/reset/logout/me (ke domain langsung)
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
