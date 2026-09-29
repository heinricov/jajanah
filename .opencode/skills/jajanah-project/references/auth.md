# @packages/auth — kontrak lengkap

Sumber kebenaran: `packages/auth/src/**`. Pembaruan di sini wajib bila `package.json`
(exports map), `src/index.ts`, `action-types.ts`, `errors.ts`, atau `auth.service.ts` berubah.

## 1. `exports` map (`packages/auth/package.json`)

```json
"exports": {
  ".":                     { "types": "./dist/index.d.ts",  "default": "./dist/index.js" },
  "./next":                { "types": "./src/next/index.ts", "default": "./src/next/index.ts" },
  "./next/server":         { "types": "./src/next/server/index.ts", "default": "./src/next/server/index.ts" },
  "./next/server/actions": { "types": "./src/next/server/actions.ts", "default": "./src/next/server/actions.ts" },
  "./next/cookie":         { "types": "./src/next/cookie.ts", "default": "./src/next/cookie.ts" },
  "./next/oauth":          { "types": "./src/next/oauth.ts", "default": "./src/next/oauth.ts" }
}
```

| Subpath | Target | Kandungan |
| --- | --- | --- |
| `.` | **dist CJS** (di-build) | domain: `authService`, `AuthError`, password & JWT helpers |
| `./next` | **raw source ESM** | client: `AuthProvider`, `useAuth`, `AuthActionError`, `authErrorMessage`, `SESSION_COOKIE` |
| `./next/server` | raw source | 7 action + tipe hasil + `getSessionUser`/`requireAuth`/`requireAdmin` + cookie helpers |
| `./next/server/actions` | raw source (`'use server'`) | **hanya 7 server action** — inilah yang aman dari client component |
| `./next/cookie` | raw source | `SESSION_COOKIE` saja (zero import, edge-safe) |
| `./next/oauth` | raw source | `beginGoogleOAuth`, `completeGoogleOAuth`, `resolveGooglePicture`, `GOOGLE_OAUTH_STATE_COOKIE`, tipe error |

**Subpath `./next**` sengaja tidak masuk `dist/`** (ada di `exclude` `tsconfig.build.json`)
karena `require('next/headers')` dari CJS hasil build kehilangan binding saat di-bundle
Turbopack → `ReferenceError: server_1 is not defined`. Karena raw source, **tidak ada build
step yang menangkap import salah** — baru ketahuan di typecheck/build app.

Tidak ada subpath lain (tidak ada `./next/server/guards`, `./domain/*`, dll) — bila butuh
tipe/helper baru, re-export dari barrel yang ada atau tambahkan entry baru di exports map.

`next`/`react` adalah **peerDependencies opsional** (`peerDependenciesMeta.optional: true`)
supaya `apps/api` (NestJS, tanpa Next) bisa memakai root entry tanpa dipaksa install React.

## 2. Root barrel (`src/index.ts`)

```ts
export { authService, AuthService, type LoginContext } from './domain/auth.service';
export { AuthError, type AuthErrorCode } from './domain/errors';
export { hashPassword, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, verifyPassword } from './domain/password';
export {
  DEFAULT_RESET_TTL_HOURS, DEFAULT_SESSION_TTL_HOURS, DEFAULT_VERIFY_TTL_HOURS,
  getResetTtlHours, getSessionTtlHours, getVerifyTtlHours,
  signSessionToken, verifySessionToken,
  type SessionTokenClaims, type SignSessionTokenInput,
} from './domain/token';
```

`OAuthLoginInput` ada di `auth.service.ts` tapi **tidak** di barrel — konsumennya hanya
`src/next/oauth.ts`.

## 3. Metode domain (`src/domain/auth.service.ts`)

Semua tanggal dikirim ke client sebagai ISO string; user dihasilkan **hanya** lewat
`toAuthUser()` (allowlist field, `emailVerified: Boolean(row.emailVerifiedAt)`, `image` di-sanitize
via `sanitizeImageUrl`, hasil akhir di-`parse` dengan `authUserSchema` → **`ZodError`, bukan
`AuthError`, bila row tidak valid**).

| Method | Signature | Behavior / error |
| --- | --- | --- |
| `register` | `(input: RegisterRequest) => Promise<AuthUser>` | trim nama, `normalizeEmail`, cek unique → `EMAIL_TAKEN` (409, dua jalur: pre-check & kode `P2002`), role hard-code `'USER'`, **`emailVerifiedAt` tetap null, tidak ada sesi** |
| `login` | `(input: LoginRequest, context: LoginContext = {}) => Promise<LoginResponse>` | scrypt **selalu jalan** (dummy hash bila email tak dikenal → anti timing-oracle) → `!user \|\| !passwordOk \|\| !isActive` = `INVALID_CREDENTIALS` (401, tak bisa dibedakan) → belum terverifikasi = `EMAIL_NOT_VERIFIED` (403) → `createSession` |
| `oauthLogin` | `(input: OAuthLoginInput, context?: LoginContext) => Promise<LoginResponse>` | tolak `emailVerified: false` → `OAUTH_EMAIL_UNVERIFIED` (400). Cabang: (1) identity sudah ter-link → langsung masuk tanpa cek email; (2) email sudah punya akun → auto-link, `P2002` = `OAUTH_ACCOUNT_LINKED` (409); (3) email baru → buat akun `password: null` + `emailVerifiedAt: now()`; `P2002` saat create → retry sekali lalu `EMAIL_TAKEN`. Nonaktif → `UNAUTHORIZED` (401). Akun lama tanpa verifikasi → **di-backfill `emailVerifiedAt`**. Sinkron foto profil → tulis `OAuthAccount.image` **dan** `Auth.image` dengan `input.image` (`string` = simpan, `null` = kosongkan, `undefined` = jangan disentuh; URL non-http(s) jadi `undefined` lewat `sanitizeImageUrl`) |
| `requestEmailVerification` | `(email: string) => Promise<{token,name,email} \| null>` | `null` bila email tak dikenal **atau** sudah terverifikasi (**anti-enumerasi — treat sebagai sukses**). `deleteMany` token lama → `randomBytes(32).toString('base64url')` (43 char) → TTL `getVerifyTtlHours()` |
| `verifyEmail` | `(token: string) => Promise<AuthUser>` | tak dikenal / kedaluwarsa (`expiresAt <= now`, inclusif) → `INVALID_VERIFY_TOKEN` (400). Hapus **semua** token user → set `emailVerifiedAt`. **Tidak membuat sesi/cookie** |
| `requestPasswordReset` | `(email: string) => Promise<{token,name,email} \| null>` | `null` bila email tak dikenal **atau** `!isActive` (**anti-enumerasi — treat sebagai sukses**). `deleteMany` token lama → `randomBytes(32)` base64url → TTL `getResetTtlHours()`. Akun OAuth-only (`password: null`) **boleh**; **tidak** menyentuh `emailVerifiedAt` |
| `resetPassword` | `(token: string, password: string) => Promise<AuthUser>` | tak dikenal / kedaluwarsa / akun hilang-nonaktif → `INVALID_RESET_TOKEN` (400). `deleteMany` semua token reset → update `password` (hash scrypt) → **`deleteMany` SEMUA sesi** (paksa login ulang). **Tidak membuat sesi/cookie** |
| `logout` | `(token: string) => Promise<void>` | **verifikasi JWT dulu** → `UNAUTHORIZED` bila invalid/kedaluwarsa (baris DB tidak dihapus), lalu `deleteMany({ token: claims.jti })` |
| `authenticate` | `(token: string) => Promise<AuthUser>` | 3 lapis: signature+exp JWT → lookup `Session` by `jti` + `expiresAt` (revocation) → `auth.isActive`. Read-only. Semua gagal = `UNAUTHORIZED` (401) dengan 3 pesan berbeda tapi **kode sama** |
| `createSession` (private) | `(auth, context) => Promise<LoginResponse>` | satu `now` untuk semua → update `lastLoginAt` → sweep sesi expired user ini → insert `Session { token: jti }`. **Tahap Next tidak pernah mengirim `context`** → `authAgent`/`ipAddress` selalu `null` (hanya `apps/api` yang mengisi) |

`LoginResponse` = `{ token: string; expiresAt: string; user: AuthUser }`.

## 4. `AuthError` (`src/domain/errors.ts`)

```ts
export type AuthErrorCode =
  | 'EMAIL_TAKEN' | 'EMAIL_NOT_VERIFIED' | 'INVALID_CREDENTIALS' | 'UNAUTHORIZED'
  | 'OAUTH_ACCOUNT_LINKED' | 'OAUTH_EMAIL_UNVERIFIED'
  | 'INVALID_VERIFY_TOKEN' | 'INVALID_RESET_TOKEN';
```

| Kode | Status |
| --- | --- |
| `EMAIL_TAKEN`, `OAUTH_ACCOUNT_LINKED` | 409 |
| `OAUTH_EMAIL_UNVERIFIED`, `INVALID_VERIFY_TOKEN`, `INVALID_RESET_TOKEN` | 400 |
| `EMAIL_NOT_VERIFIED` | 403 |
| `INVALID_CREDENTIALS`, `UNAUTHORIZED` (fallback) | 401 |

**Jebakan paling berbahaya**: status diturunkan dari *ternary* di konstruktor. Kode baru
tanpa cabang status = **diam-diam 401**. Kode juga wajib ada di `API_ERROR_CODES`
(`packages/validators/src/contract.ts`) supaya `AllExceptionsFilter` lolos typecheck.

## 5. Format kripto & token

- **Password**: `scrypt$16384$8$1$<salt base64url 16B>$<key base64url 64B>` (6 bagian
  `$`). `verifyPassword` **tidak percaya parameter tersimpan**: N harus kuasa-2 dalam
  `[1024, 1048576]`, R∈[1,32], P∈[1,16], panjang hash ≤256 → selain itu `false`.
  Batas panjang: `PASSWORD_MIN_LENGTH = 8`, `PASSWORD_MAX_LENGTH = 128` (ditegakkan Zod/DTO).
- **JWT sesi**: HS256 hand-rolled (`node:crypto`), header `{alg:'HS256',typ:'JWT'}`,
  claims `{sub, jti, role, iat, exp}`. Verifikasi **tidak pernah dispatch pada `alg`** —
  selalu hitung ulang HMAC + `timingSafeEqual`, baru cek `alg === 'HS256'`.
  `Session.token` menyimpan **`jti`** → logout bisa mencabut token yang sudah terbit.
- **Env**: `JWT_SECRET` dibaca **lazily** (per pemanggilan), kosong → `Error('[auth]
  JWT_SECRET is not set. Define it in the root .env (see .env.example).')`.
  `AUTH_SESSION_TTL_HOURS` default `168`, `VERIFY_TOKEN_TTL_HOURS` default `24`,
  `RESET_TOKEN_TTL_HOURS` default `1` (`getVerifyTtlHours`/`getResetTtlHours`
  memetakan `''`/tidak valid → default).

## 6. Server actions (`src/next/server/actions.ts`, `'use server'`)

Semua error dikirim balik sebagai **plain JSON** via `toFailure`:

```ts
function toFailure(error: unknown): AuthActionFailure {
  if (error instanceof AuthError)
    return { ok: false, status: error.status, code: error.code, message: error.message };
  return { ok: false, status: 500, code: 'INTERNAL', message: 'Terjadi kesalahan di server.' };
}
```

(Pesan domain **English** asli diteruskan ke client; `authErrorMessage` di
`src/next/errors.ts` menerjemahkannya ke teks friendly Indonesia berdasarkan `code`.)

| Action | Params | Return | Catatan |
| --- | --- | --- | --- |
| `loginAction` | `request: LoginRequest` | `LoginActionResult` | set cookie sesi |
| `registerAction` | `request: RegisterRequest` | `RegisterActionResult` | **tanpa auto-login**, `requiresEmailVerification: true` selalu literal; kirim email **best-effort** (kegagalan di-`console.error`, akun tetap terdaftar) |
| `resendVerificationAction` | `email: string` (**posisional, bukan object**) | `ResendVerificationActionResult` | selalu `{ok:true}` bila tidak ada error server |
| `forgotPasswordAction` | `email: string` (**posisional, bukan object**) | `ForgotPasswordActionResult` | selalu `{ok:true}` bila tidak ada error server (anti-enumerasi); email **best-effort** |
| `resetPasswordAction` | `request: ResetPasswordRequest` (object `{token, password}`) | `ResetPasswordActionResult` | **validasi zod dulu** (`resetPasswordRequestSchema`) → gagal = `{ok:false,400,'VALIDATION'}` **tanpa** menyentuh domain; sukses = `{ok:true, user}` (sesi sudah dicabut domain) |
| `logoutAction` | — | `LogoutActionResult` | selalu `{ok:true}`; kegagalan logout domain ditelan, cookie tetap dibersihkan |
| `meAction` | — | `MeActionResult` | `UNAUTHORIZED` → `{ok:true,user:null}`; **error lain diteruskan** (outage DB tidak disamarkan jadi "belum login") |

Helper privat: `verificationLink(token)` = `${APP_URL (trim trailing '/')}/auth/verify-email?token=...`,
`passwordResetLink(token)` = `${APP_URL}/auth/forgot-password/new-password?token=...`
(default `http://localhost:3000`), plus `sendVerificationMail`/`sendPasswordResetMail`
(try/catch, log saja — kegagalan kirim tidak membatalkan aksi).

## 7. Guards & cookie (`src/next/server/`)

- `getSessionUser(): Promise<AuthUser | null>` — cookie → `authService.authenticate`;
  `UNAUTHORIZED` → `null`, **error non-auth diteruskan** (outage terlihat).
- `requireAuth(): Promise<AuthUser>` — `redirect('/auth/login')` bila `null`.
- `requireAdmin(): Promise<AuthUser>` — `requireAuth` + cek `role === 'ADMIN'`, selain itu
  redirect ke `/auth/login` (**bukan** halaman 403).
- `SESSION_COOKIE = 'tj_token'` (`src/next/cookie.ts`, zero import → edge-safe).
  Opsi: `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`,
  `secure: NODE_ENV === 'production'`, `maxAge` dari `computeSessionMaxAge(expiresAt)`.

## 8. Client context (`src/next/auth-provider.tsx`, `'use client'`)

```ts
type AuthStatus = 'authenticated' | 'unauthenticated';
type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  login: (request: LoginRequest) => Promise<AuthUser>;
  register: (request: RegisterRequest) => Promise<AuthUser>;
  logout: () => Promise<void>;
};
```

- `AuthProvider({ initialUser })` dipasang di `app/layout.tsx` (server) dan mengisi
  `initialUser` dari `getSessionUser()`.
- **`register` tidak mengubah state jadi `authenticated`** — akun menunggu konfirmasi.
- Gagal → melempar `AuthActionError { status, code, message }` (pakai `new.target.name`).
- `authErrorMessage(error)` → teks friendly Indonesia; kode yang di-cover:
  `INVALID_CREDENTIALS`, `EMAIL_TAKEN`, `EMAIL_NOT_VERIFIED`, `INVALID_VERIFY_TOKEN`,
  `INVALID_RESET_TOKEN`, `UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION`, `BAD_REQUEST`,
  `TRANSPORT`, `INTERNAL`.
- `useAuth()` di luar provider → `throw new Error('useAuth harus dipakai di dalam <AuthProvider>.')`.

## 9. Gateway Google OAuth (`src/next/oauth.ts`)

Dipakai **hanya** oleh route handler `apps/web/app/api/auth/google{,/callback}/route.ts`
(bukan server action — OAuth2 butuh `redirect_uri` GET).

- `GOOGLE_OAUTH_STATE_COOKIE = 'tj_oauth_state'`, `maxAge` 600 detik, **sekali pakai**
  (dihapus saat callback), nilai `JSON.stringify({ state, next })`.
- `beginGoogleOAuth(request, { next? })` → redirect ke Google dengan
  `scope: ['openid','email','profile']`, `redirect_uri` = URL absolut
  `/api/auth/google/callback` dari `request.url`.
- `safeNext(next)` membatasi tujuan redirect (anti open-redirect).
- `completeGoogleOAuth(request)` → tukar kode → `verifyIdToken` (`google-auth-library`) →
  `resolveGooglePicture(access_token, payload.picture)` →
  `authService.oauthLogin({ provider:'google', providerId: sub, email, name, emailVerified, image })`.
- `resolveGooglePicture(accessToken, idTokenPicture, { fetchImpl? })` → claim `picture` ID token;
  bila kosong GET `https://openidconnect.googleapis.com/v1/userinfo` dengan
  `Authorization: Bearer <access_token>`. Hasil `string` \| `null` \| `undefined`
  (**tidak pernah melempar** — foto bukan alasan login gagal). Bisa diuji lewat `fetchImpl`.
- Hasil `GoogleOAuthError`: `oauth`, `oauth_config`, `oauth_account_linked`,
  `oauth_email_unverified` — dikonversi route handler jadi redirect
  `/auth/login?error=<kode>` dan dipetakan di `apps/web/app/auth/login/page.tsx` (`OAUTH_ERRORS`).
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` kosong → kode `oauth_config`.
- **`apps/admin` sengaja tidak punya login Google** dan tidak punya self-register.

## 10. Peta alur verifikasi email

| Langkah | File |
| --- | --- |
| Form register → `registerAction` | `apps/web/app/auth/register/page.tsx` + `packages/ui/src/auth/form-register.tsx` |
| Buat akun + token + kirim email | `auth.service.register` → `requestEmailVerification` → `sendVerificationMail` → `packages/email/src/index.ts` |
| Redirect halaman cek-email | `/auth/verify-email?sent=1&email=...` |
| Halaman server (token valid → verifikasi → redirect login) | `apps/web/app/auth/verify-email/page.tsx` |
| Klik token → `authService.verifyEmail` | domain, lalu `redirect('/auth/login?verified=1')` |
| Banner sukses + tombol kirim ulang | `apps/web/app/auth/login/page.tsx` (`VERIFIED_NOTICE`, `resendVerificationAction`) |
| Tombol kirim ulang client | `apps/web/components/resend-verification.tsx` → `resendVerificationAction` |
| Login ditolak 403 → tombol kirim ulang | `loginAction` gagal `EMAIL_NOT_VERIFIED` → `FormLogin resend={...}` |
| Sisa token | tabel `EmailVerificationToken` (FK `authId`, cascade) |

## 10b. Peta alur reset password

| Langkah | File |
| --- | --- |
| Form lupa password → `forgotPasswordAction` | `apps/web/app/auth/forgot-password/page.tsx` (atau `apps/admin/...` sama) + `packages/ui/src/auth/form-forgot-password.tsx` |
| Buat token + kirim email | `auth.service.requestPasswordReset` → `sendPasswordResetMail` → `packages/email` (`sendPasswordReset`) |
| Halaman server (tanpa token → kartu tidak valid) | `apps/{web,admin}/app/auth/forgot-password/new-password/page.tsx` |
| Form client → `resetPasswordAction` | `apps/{web,admin}/components/reset-password-form.tsx` (`FormNewPassword`) |
| Tukar token → password baru + cabut sesi | `auth.service.resetPassword` → `redirect('/auth/login?reset=1')` |
| Banner sukses | `apps/web/app/auth/login/page.tsx` + `apps/admin/app/auth/login/page.tsx` (`RESET_NOTICE`) |
| Sisa token | tabel `PasswordResetToken` (FK `authId`, cascade) |

## 11. Test domain

- `src/domain/*.spec.ts` + `src/next/*.spec.ts` + `src/next/server/*.spec.ts` = **116 test /
  8 suite** — terbanyak di repo.
- `jest.mock('@packages/db')` (tanpa DB nyata), `jest.mock('next/headers')` untuk server;
  mock Prisma di spec domain wajib ikut menambah model baru (mis. `passwordResetToken:
  { findUnique, create, deleteMany }`, `oAuthAccount: { findUnique, create, update }`).
  `src/next/oauth.spec.ts` memakai `jest.mock('../domain/auth.service')` agar tidak
  memuat `@packages/db` sama sekali.
- Konvensi: fixture user memuat `emailVerifiedAt`; beforeEach selalu
  `delete process.env.VERIFY_TOKEN_TTL_HOURS` / `RESET_TOKEN_TTL_HOURS` /
  `AUTH_SESSION_TTL_HOURS` / `JWT_SECRET` agar default TTL tidak bocor antar-test.
