# Package — API publik & prosedur "menambah X"

Sumber: `packages/*/package.json`, `README.md` per package. Perbarui bila API publik /
dependensi berubah.

## Matriks workspace

| Package | `name` | Modul | Build | Test | Dependensi workspace |
| --- | --- | --- | --- | --- | --- |
| `packages/validators` | `@packages/validators` | CJS (`dist/`) | `tsc -p tsconfig.build.json` | — | — (zod, class-validator, class-transformer, reflect-metadata) |
| `packages/environment` | `@packages/environment` | **CJS mentah** (`index.js`, tanpa build) | — | — | dotenv, dotenv-expand |
| `packages/logger` | `@packages/logger` | CJS | tsc | ✅ 3 suite/24 test | — (`@nestjs/common` **dev-only**, `import type`) |
| `packages/db` | `@packages/db` | CJS | `prisma generate && tsc` | — | `@packages/environment` |
| `packages/email` | `@packages/email` | CJS | tsc | ✅ 1/8 | **nol dependency runtime** |
| `packages/client` | `@packages/client` | CJS (preset browser) | tsc | ✅ 1/13 | `@packages/validators` |
| `packages/auth` | `@packages/auth` | CJS + raw source `/next**` | tsc (exclude `src/next/**`) | ✅ 8/116 | db, email, environment, validators + `google-auth-library` |
| `packages/ui` | `@packages/ui` | **ESM source** (`type: module`, tanpa build) | — | — | **nol workspace dep** (radix/base-ui/tailwind/zod/dll) |
| `configs/*` | `@configs/{eslint,next,prettier,typescript}` | ESM | — | — | `@configs/next` → `@packages/environment` |
| `apps/api` | `api` | **CJS** (builder `nest build` = `tsc`) | nest build | ✅ 5/20 | auth, environment, logger, validators |
| `apps/web` | `web` | ESM (Turbopack) | `next build` | — | auth, client, ui (+ `@configs/next` dev) |
| `apps/admin` | `admin` | ESM | `next build` | — | auth, client, ui, validators |

Arah dependensi & daftar "daun" → lihat `SKILL.md §3`.

## @packages/validators — kontrak API (SSOT)

### Bentuk envelope (`src/contract.ts`)

```ts
ok<T>(data)                  → { data }
paginated<T>(rows, meta)     → { data: T[], meta: PaginationMeta }
apiError(status, code, msg, details?)   → { error: { status, code, message, details? } }
validationError(details?)    → 400 VALIDATION
notFoundError(message?)      → 404 NOT_FOUND
createPaginationMeta(params, total)     → { page, limit, total, totalPages, hasNext, hasPrevious }
httpStatus = { ok:200, created:201, badRequest:400, unauthorized:401, forbidden:403,
               notFound:404, conflict:409, internal:500 }
PAGINATION_DEFAULTS = { page: 1, limit: 20 }
```

`API_ERROR_CODES` (14, urutan berpengaruh untuk type):
`BAD_REQUEST`, `VALIDATION`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`,
`EMAIL_TAKEN`, `EMAIL_NOT_VERIFIED`, `INVALID_CREDENTIALS`, `OAUTH_ACCOUNT_LINKED`,
`OAUTH_EMAIL_UNVERIFIED`, `INVALID_VERIFY_TOKEN`, `INVALID_RESET_TOKEN`, `INTERNAL`.

**Jebakan**: konsumen memuat package ini dari **`dist/`** (CJS) — setelah menambah
export bernilai (schema/const), jalankan `pnpm --filter @packages/validators build`,
kalau tidak runtime dapat `undefined` (type-only import tidak menangkap ini).

**Foto profil**: `authUserSchema.image` adalah `string | null` (wajib ada, bedakan "tanpa
foto" dari "belum diketahui"), divalidasi `imageUrlSchema` (`z.url().max(2048)` + refine
regex `^https?://`). Regex, **bukan** `new URL()`: tsconfig package ini `types: []`
(tanpa node globals) dan `new URL()` menerima `javascript:`/`data:`.

### Prosedur menambah kontrak baru (dari README validators)

1. **Interface** kanonik di `src/types/<domain>.ts`.
2. **Zod schema** di `src/schemas/` dianotasi `z.ZodType<Interface>` (bukan infer — mengunci
   kontrak ke interface).
3. Bila masuk lewat request → **DTO class-validator** di `src/dtos/` dengan
   `implements Interface` + decorator `@Is*`/`@Type` (jangan lupa `@IsOptional()`).
4. Export lewat `src/index.ts` (`export *`), lalu `pnpm --filter @packages/validators build`.
5. Konsumen import dari `@packages/validators` — **jangan deklarasikan ulang**.

Pembagian: **request incoming** (query/body) → DTO (jalur `ValidationPipe` Nest, native
`@Type` transform string→number); **response & data** → interface + Zod.

Browser-safety: `types: []` di tsconfig (tanpa `@types/node`), ESLint preset `base`,
extend preset `nest` hanya karena DTO pakai decorator.

## @packages/client — satu-satunya jalur web → api

```ts
apiClient.getHealth(): Promise<HealthResponse>          // GET /
apiClient.register(request: RegisterRequest): Promise<AuthUser>   // POST /auth/register
apiClient.login(request: LoginRequest): Promise<LoginResponse>    // POST /auth/login
apiClient.logout(token: string): Promise<null>                   // POST /auth/logout + Bearer
apiClient.me(token: string): Promise<AuthUser>                   // GET /auth/me + Bearer
apiClient.request<T>(path, schema, options): Promise<T>          // inti generik
createApiClient(options?: { baseUrl?, fetch? })
```

- Base URL: `options.baseUrl` → `process.env.NEXT_PUBLIC_API_URL` →
  **`http://localhost:3002`** (bukan `API_BASE_URL`; env itu untuk API memberitahu
  alamatnya sendiri).
- Pipeline: `fetch` → `response.json()` → error non-2xx di-parse `apiErrorEnvelopeSchema`
  → wajib ada `{ data }` → `schema.safeParse(data)`.
- Error: `ApiClientError` (dasar) → `ApiTransportError` (jaringan/JSON) /
  `ApiHttpError { status, code, details }` / `ApiValidationError { data }`.
- **Tanpa cookie/`credentials`** — token diteruskan per-panggilan; penyimpanan token bukan
  tanggung jawab package ini.
- `fetch` bisa diinjeksi lewat `options.fetch` (dipakai test/spec).

### Prosedur menambah endpoint

1. Kontrak di `@packages/validators` (interface + Zod; DTO bila ada request body/query).
2. Handler di `apps/api` (controller + DTO + `ok(...)`), atau lewat server action bila
   memang untuk app Next.
3. Method baru di `packages/client/src/client.ts` + mock-fetch test di `client.spec.ts`.
4. `pnpm --filter @packages/client build`.

## @packages/db — Prisma 7

- Client **lazy `Proxy`** (`src/client.ts`): `import` aman tanpa `DATABASE_URL`
  (mis. `next build` di CI); pesan `[db] Missing DATABASE_URL...` baru muncul saat query.
  **Jangan diganti instance langsung.**
- Schema `prisma/schema.prisma`: `enum Role { USER ADMIN }` + model
  `Auth` (unique `email`, `password String?`, `emailVerifiedAt DateTime?`, `isActive`),
  `Session` (`token` = jti JWT, `expiresAt`, `authAgent?`, `ipAddress?`),
  `OAuthAccount` (`@@unique([provider, providerId])`), `EmailVerificationToken`,
  `PasswordResetToken` (keduanya: `token @unique`, `expiresAt`). FK `onDelete: Cascade`.
- Tidak ada `url` di schema (Prisma 7): datasource dibaca `prisma.config.ts` dari
  `process.env.DATABASE_URL`, koneksi pakai driver adapter `@prisma/adapter-pg`.
- Client di-generate ke `packages/db/src/generated/prisma/` (**gitignored**).

### Perintah

```bash
pnpm --filter @packages/db migrate        # prisma migrate dev (buat migrasi baru)
pnpm --filter @packages/db migrate:deploy # prisma migrate deploy (DB remote)
pnpm --filter @packages/db generate       # prisma generate ulang
pnpm --filter @packages/db db:seed        # build db + auth, lalu seed (idempoten)
pnpm --filter @packages/db studio
```

- Migrasi = folder `prisma/migrations/<timestamp>_<nama>/migration.sql`, timestamp dibuat
  otomatis Prisma. Sudah ada: `20260926112330_auth`, `20260928064048`,
  `20260928101815_email_verification`, `20260929033248_password_reset`,
  `20260929062723_auth_image` (`image` di `Auth` + `OAuthAccount`).
  **Gotcha**: `prisma migrate dev` bisa hang menunggu stdin bila dijalankan non-interaktif
  — pakai `< /dev/null` dan pastikan `prisma generate` ikut jalan (client lama = model
  baru tak terlihat typecheck).
- **Seed berada di `@packages/auth`** (`src/domain/seed.ts`) — arah `db → auth` akan
  membentuk cycle Turbo. Prisma config memanggil `node ../auth/dist/domain/seed.js`,
  maka `db:seed` mem-build auth dulu.
- `packages/db/turbo.json` menyetel `typecheck` agar `prisma generate` jalan sebelum
  typecheck — jangan dihapus.

## @packages/environment — loader .env

API: `loadEnvironment()`, `getEnv(name)`, `requireEnv(name)`, `environment` (Proxy ke
`process.env`), `findRepoRoot()` (walk-up sampai ketemu `pnpm-workspace.yaml`).
**`loadEnvironment()` otomatis jalan saat import** — cukup `import '@packages/environment';`
(`@configs/next` sudah melakukannya untuk app Next; `apps/api` di `main.ts`;
`packages/db` di `client.ts` & `prisma.config.ts`).

Urutan baca: `.env` → `.env.<mode>` → `.env.local` (dilewati bila mode `test`) →
`.env.<mode>.local`; yang terakhir menang; **`process.env` yang sudah ada tak pernah
di-override** (shell/CI menang). Mode = `NODE_ENV || 'development'`.
Tambahan: `/*turbopackIgnore: true*/` pada pembacaan file — tanpa ini Turbopack men-trace
seluruh project ke NFT.

### Prosedur menambah env var

1. Tambah kunci + placeholder ke **`.env.example`** (di-commit = dokumentasi).
2. Tambah nilai ke **`.env`**, dan ke **`.env.development`** / **`.env.test`** bila
   diperlukan mode berbeda.
   ⚠️ Kunci yang ada di `.env` tapi terlewat di file mode **bisa di-shadow** — selaraskan
   kuncinya di semua file yang dipakai (lihat `SKILL.md §9.6`).
3. Baca dengan `getEnv('NAMA_VAR')` (lazy) — **jangan** `requireEnv` untuk opsi.
4. Tidak perlu `pnpm install`; cukup **restart proses dev**.
5. Dokumentasikan di README bagian Environment.

## @packages/logger

```ts
createLogger({ level?, format?, redactKeys?, color?, write? }): Logger  // .debug/.info/.warn/.error/.child()
runWithContext(ctx, fn) / getContext() / updateContext(patch)           // AsyncLocalStorage
createRequestLogger({ logger })  → middleware Express (header x-request-id, set context)
NestLoggerService(logger)        // jembatan ke Nest
redact(value, keys)              // DEFAULT_REDACT_KEYS: authorization, password, token, cookie, x-api-key
REQUEST_ID_HEADER = 'x-request-id'
```

- Merge konteks per baris: `bindings` (child) < ALS context < `fields` per-panggilan.
- **Body/query tidak pernah di-log** (privasi); hanya method, path, status, durasi.
- `apps/api/src/logger.ts` mengeset level/format dari `LOG_LEVEL`/`LOG_FORMAT`
  (prod: `info`/`json`; selain itu `debug`/`pretty`).
- Nol dependency runtime; `@nestjs/common` hanya devDependency via `import type`.

## @packages/email — adapter pengiriman

```ts
sendConfirmationEmail(input, deps?): Promise<SendResult>       // email konfirmasi
sendPasswordResetEmail(input, deps?): Promise<SendResult>      // tautan reset password
emailService = { sendConfirmation, sendPasswordReset }         // alias konsumen
ConfirmationEmailInput = PasswordResetEmailInput = { to: string; name: string; link: string }
SendResult = { delivered: true } | { delivered: false; reason: 'no_api_key' }
SendDeps = { fetchImpl?: FetchLike }                            // injeksi untuk test
```

- Kedua fungsi lewat helper privat `deliver(payload, deps)` — satu jalur POST Resend
  (cek API key → fallback console → `fetchImpl` → `!response.ok` → throw).
- `RESEND_API_KEY` kosong → **bukan error**: `console.log` tautan + return
  `{ delivered:false, reason:'no_api_key' }` (fallback development).
- Resend non-2xx → `throw new Error('[email] Resend gagal (HTTP <status>) <detail>')`.
- `MAIL_FROM` default `Jajanah <onboarding@resend.dev>`; `APP_NAME` default `Jajanah`.
- Nama/tautan di-`escapeHtml` di konten HTML; template teks polos tidak.
- Tanpa `import '@packages/environment'` — baca `process.env` saat dipanggil.
- **Jebakan email tidak sampai (urutan cek):** (1) `.env.<mode>` dimuat *setelah*
  `.env` dengan `Object.assign` → baris `RESEND_API_KEY=` **kosong** di
  `.env.development` **menimpa** key asli → diam-diam fallback console;
  (2) `MAIL_FROM` `onboarding@resend.dev` hanya boleh kirim ke email akun Resend;
  (3) Resend balas 2xx tapi `last_event: "suppressed"` (alamat di
  `GET /suppressions` → hapus via `DELETE /suppressions/{email}`). Status dibaca
  ulang: `GET /emails?limit=1` → `last_event` (`delivered` = sampai).

### Prosedur menambah tipe email baru

1. Type `...EmailInput` + helper `subject…()` / `…Html()` / `…Text()` (pakai ulang
   `escapeHtml`, `resolveBrand`, `resolveFrom`).
2. `export async function sendXEmail(...)` yang menyusun payload lalu memanggil
   `deliver(payload, deps)` (jalur kirim sudah disalinakan — jangan duplikasi fetch).
3. Daftarkan di objek `emailService`.
4. Tambah test di `src/email.spec.ts` (fallback, payload, error HTTP).
5. Env baru → `.env.example` + README bagian Environment.

## @packages/ui

Exports map (`package.json`) — **tidak ada root export**, semua lewat subpath:

```json
"./globals.css": "./src/styles/globals.css",
"./postcss.config.mjs": "./postcss.config.mjs",
"./components/*": "./src/components/*.tsx",
"./lib/*": "./src/lib/*.ts",
"./hooks/*": "./src/hooks/*.ts",
"./auth/*": "./src/auth/index.ts",           // ← wildcard collapse ke BARREL
"./navigations/*": "./src/navigations/index.ts", // ← wildcard collapse ke BARREL
"./profile/*": "./src/profile/index.ts",    // ← wildcard collapse ke BARREL
"./dashboard/*": "./src/dashboard/*.tsx",
"./apps/*": "./src/apps/*.tsx"
```

⚠️ `auth/*`, `navigations/*` dan `profile/*` **tidak menunjuk ke file per komponen** —
konsumen memakai bentuk barrel `import { FormLogin } from '@packages/ui/auth/';`.

- Tanpa `build`/`dist` — di-bundle Next lewat `transpilePackages`.
- Konvensi **props-driven**: komponen tidak tahu auth/routing; `onLogout`, `user`,
  `footer` (`undefined` = default, `null` = sembunyikan, node = custom) disuntik app.
- `'use client'` hanya pada komponen yang butuh state (`FormLogin`, `UserAuth`, dll);
  `AppLogo`/`Navbar`/`Footer`/`DashboardLayout` server-safe, tapi `Navbar` butuh callback
  logout dari client wrapper (`apps/web/components/site-navbar.tsx`,
  `apps/admin/components/auth-dashboard-layout.tsx`).
- Tailwind v4 via **string form** di `postcss.config.mjs`:
  `plugins: { '@tailwindcss/postcss': {} }` — bentuk ini load-bearing, jangan diubah.

### Prosedur menambah komponen

```bash
pnpm dlx shadcn@latest add <nama> -c apps/web     # -c harus app, bukan packages/ui
# sinkronkan style & tailwind.baseColor di ketiga components.json bila berbeda
```

## Menambah workspace baru (dari README)

**App (`apps/<nama>`)**: `package.json` `private: true` + script
`build`/`dev`/`lint`/`typecheck` (Turbo deteksi otomatis) → `tsconfig.json` extend
`@configs/typescript/*` → `eslint.config.mjs` import `@configs/eslint/*` → app Next:
`next.config.mts` re-export `@configs/next` → `pnpm install`.

**Package (`packages/<nama>`)**: `package.json` `"name": "@packages/<nama>"` + `exports`
→ konfigurasi di atas → konsumen memakai `"@packages/<nama>": "workspace:*"` → `pnpm install`.

⚠️ Tambahkan **dua tsconfig** (`tsconfig.json` noEmit + `tsconfig.build.json` emit) kecuali
memang tanpa build (`ui`, `environment`). Lihat `SKILL.md §9.8`.
