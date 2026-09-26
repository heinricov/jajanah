# api (`apps/api`)

REST API **jajanah** — [NestJS](https://nestjs.com) 11 (CommonJS, builder `tsc` via Nest CLI). Berjalan di port **3002** (berdampingan dengan `apps/web` :3000 dan `apps/admin` :3001 saat `pnpm dev`).

## Perintah

| Perintah                      | Deskripsi                                     |
| ----------------------------- | --------------------------------------------- |
| `pnpm --filter api dev`       | Dev server watch di `http://localhost:3002`   |
| `pnpm --filter api build`     | Production build (`nest build` → `dist/`)     |
| `pnpm --filter api start`     | Jalankan hasil build produksi (port dari env) |
| `pnpm --filter api lint`      | ESLint dengan preset `@configs/eslint/nest`   |
| `pnpm --filter api typecheck` | `tsc --noEmit`                                |
| `pnpm --filter api test`      | Unit test (Jest + ts-jest)                    |

Dari root, `pnpm dev` / `pnpm build` / `pnpm check` / `pnpm test` otomatis mencakup app ini lewat Turbo.

## Struktur

```
apps/api/
├── package.json          # script NestJS + dependensi (@nestjs/*, @packages/environment)
├── nest-cli.json         # config Nest CLI (sourceRoot src, hapus dist saat build)
├── tsconfig.json         # extends @configs/typescript/nest.json (+ types jest)
├── tsconfig.build.json   # untuk `nest build` — exclude *.spec.ts
├── eslint.config.mjs     # re-export @configs/eslint/nest (SSOT)
└── src/
    ├── main.ts           # import reflect-metadata + @packages/environment → bootstrap (port API_PORT) + useLogger + request logger + enableCors() + ValidationPipe global + AllExceptionsFilter
    ├── logger.ts         # glue @packages/logger: level/format dari getEnv(LOG_LEVEL/LOG_FORMAT)
    ├── app.module.ts     # root module (AppController + AuthController)
    ├── app.controller.ts # GET / → envelope { data: HealthResponse } (dikontrak @packages/validators)
    ├── app.service.ts    # membaca env via `environment`/`getEnv` (@packages/environment), return type HealthResponse
    ├── auth/
    │   ├── auth.controller.ts     # POST /auth/register|login|logout + GET /auth/me
    │   ├── auth.guard.ts          # Bearer JWT → authService.authenticate → attach user + updateContext({ userId })
    │   ├── current-user.decorator.ts  # @CurrentUser() / @AuthToken()
    │   ├── auth.controller.spec.ts    # unit test envelope + konteks request
    │   └── auth.guard.spec.ts         # unit test header Bearer & alur gagal
    ├── filters/
    │   ├── all-exceptions.filter.ts   # AuthError/HttpException → envelope { error } SSOT
    │   └── all-exceptions.filter.spec.ts
    ├── app.controller.spec.ts        # unit test envelope response
    └── pagination-query.dto.spec.ts  # unit test validasi request (class-validator via ValidationPipe)
```

## Endpoint

| Method | Path             | Auth   | Deskripsi                                                                                    |
| ------ | ---------------- | ------ | -------------------------------------------------------------------------------------------- |
| `GET`  | `/`              | —      | `{ data: { service, status, mode, appName, baseUrl } }` — di-validate `healthResponseSchema` |
| `POST` | `/auth/register` | —      | `{ data: AuthUser }` — buat akun (password discrypt, email ternormalisasi); 201              |
| `POST` | `/auth/login`    | —      | `{ data: { token, expiresAt, user } }` — JWT sesi + row `Session`; 401 `INVALID_CREDENTIALS` |
| `POST` | `/auth/logout`   | Bearer | `{ data: null }` — hapus sesi (revoke `jti`); 401 bila token kedaluwarsa                     |
| `GET`  | `/auth/me`       | Bearer | `{ data: AuthUser }` — user di balik token; 401 `UNAUTHORIZED`                               |

Endpoint bertanda **Bearer** memakai `AuthGuard` (`Authorization: Bearer <JWT>`): gagal verifikasi → `AuthError` → exception filter → envelope error terkontrak. Logika auth (hash, JWT, sesi) hidup di [`@packages/auth`](../../packages/auth/README.md) — app ini hanya HTTP-nya.

> CORS aktif (`app.enableCors()` di `main.ts`) supaya browser web/admin (`:3000`/`:3001`) boleh memanggil API via `@packages/client`. Untuk produksi, pertimbangkan membatasi origin lewat env.

> Setiap respons membawa header `x-request-id` (requestId masuk dihormati, atau dibuat baru) — dipakai untuk mengorelasikan akses log dengan client.

## Logging (`@packages/logger`)

- `main.ts` memasang `createRequestLogger({ logger })` — konteks `{ requestId, method, path }` masuk `AsyncLocalStorage` sebelum request masuk handler; kode di controller/service cukup `logger.info(...)` dan konteks ikut otomatis.
- `main.ts` juga memasang `NestLoggerService` (`app.useLogger`) — log internal Nest (bootstrap, init, exception) ikut level & format yang sama.
- Level/format dari env: `LOG_LEVEL` (debug|info|warn|error), `LOG_FORMAT` (json|pretty) — dibaca `src/logger.ts` via `getEnv`; default dev debug/pretty, prod info/json (lihat root `.env*`).
- Log keluaran: `request completed` (info/warn/error sesuai status) berisi `statusCode` + `durationMs`; key sensitif otomatis `[REDACTED]`.

## Kontrak request/response (SSOT)

Semua bentuk request & response didefinisikan **hanya** di `@packages/validators` (interface kanonik + Zod schema + class-validator DTO):

- **Response** — controller parse via `healthResponseSchema.parse(...)` / `authUserSchema.parse(...)` lalu `ok(data)` → envelope `{ data }` baku.
- **Request** — `main.ts` memasang `ValidationPipe({ transform: true, whitelist: true })`; endpoint auth memakai `RegisterRequestDto`/`LoginRequestDto`, endpoint lain `PaginationQueryDto` — teruji di `pagination-query.dto.spec.ts`.
- Bentuk error baku: `{ error: { status, code, message, details? } }` via helper `apiError()` / `validationError()` — diterapkan oleh `AllExceptionsFilter` (juga menerjemahkan `AuthError` domain & error validasi Nest ke kode SSOT; error tak terduga → 500 `INTERNAL` tanpa membocorkan detail internal).

## Aturan SSOT

- Konfigurasi TypeScript/ESLint/Prettier **tidak** didefinisikan di app ini — hanya import dari `configs/` (preset `@configs/typescript/nest.json` & `@configs/eslint/nest`).
- Nilai environment hidup di file `.env*` **root**; `main.ts` meng-import `@packages/environment` sekali untuk memuatnya (mode mengikuti `NODE_ENV`, default `development`). Jangan membuat `.env` lokal di app ini.
- `dist/` dan `coverage/` adalah hasil generate — di-ignore di `.gitignore` root (jangan commit).
- Jangan deklarasikan tipe request/response di app ini — import dari `@packages/validators` (lihat section sebelumnya).
- Logging **hanya** lewat `@packages/logger` (`logger.ts` glue) — jangan `console.log` / `Logger` Nest langsung di code; request context jangan diper-coba manual (sudah otomatis via ALS).
- Menambah modul/baris resource: `pnpm --filter api exec nest g module <nama>` (schematics dari `@nestjs/cli`).
