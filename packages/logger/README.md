# @packages/logger

Structured logger untuk backend Node dengan **request context otomatis** via [`AsyncLocalStorage`](https://nodejs.org/api/async_context.html#class-asynclocalstorage) — setiap log keluaran selalu membawa `requestId`, `method`, `path` (dan `userId` nanti saat auth ada) tanpa perlu mengoper konteks lewat parameter.

Zero runtime dependencies (hanya Node built-in). Dipakai saat ini oleh `apps/api` (NestJS).

## Pemakaian

```ts
import { createLogger, runWithContext, updateContext } from '@packages/logger';

const logger = createLogger({ level: 'info', format: 'json' });

logger.info('halo'); // → { time, level, info, msg: 'halo' }

// Konteks otomatis terbawa oleh semua log di dalam fn:
runWithContext({ requestId: 'req-1', method: 'GET', path: '/status' }, () => {
  logger.info('melayani'); // → ... requestId=req-1 method=GET path=/status
  updateContext({ userId: 'user-9' }); // patch konteks aktif (mis. dari auth)
});
```

Di luar `runWithContext` logger tetap bebas-`throw` — hanya field context yang tidak ada.

### Request context (HTTP)

```ts
import { createRequestLogger } from '@packages/logger';

app.use(createRequestLogger({ logger }));
```

Middleware Express (dipasang via `app.use(...)` NestJS):

1. `requestId` diambil dari header `x-request-id` masuk, atau dibuat baru (`crypto.randomUUID()`).
2. `requestId` dikirim balik di response header `x-request-id` (korerasi client → api).
3. `next()` dibungkus `runWithContext({ requestId, method, path })` — **semua** kode di dalam handler/service yang memanggil `logger.*()` otomatis terbawa konteksnya.
4. Saat response selesai, log `request completed` dengan `statusCode` + `durationMs`; level otomatis: `<400` → info, `4xx` → warn, `≥500` → error.

Body/query tidak pernah di-log (privasi) — hanya method, path, status, durasi.

### Jembatan NestJS

```ts
import { NestLoggerService } from '@packages/logger';

app.useLogger(new NestLoggerService(logger));
```

Semua log internal Nest (bootstrap, module init, exception) ikut level & format yang sama. Mapping: `log`→info, `debug`/`verbose`→debug, `error`/`fatal`→error, param terakhir berupa string dibaca sebagai `context`.

### Format & level

| Opsi         | Nilai                                  | Default                                           |
| ------------ | -------------------------------------- | ------------------------------------------------- |
| `level`      | `debug` \| `info` \| `warn` \| `error` | `info`                                            |
| `format`     | `json` \| `pretty`                     | `json`                                            |
| `color`      | boolean (pretty)                       | `process.stdout.isTTY`                            |
| `redactKeys` | `string[]`                             | authorization, password, token, cookie, x-api-key |

Level & format di prod diatur lewat env `LOG_LEVEL` / `LOG_FORMAT` (lihat `.env.example`) — `apps/api/src/logger.ts` membacanya via `getEnv` + `normalizeLogLevel` / `normalizeLogFormat`.

Field dengan key yang cocok (case-insensitive, termasuk bersarang) otomatis jadi `[REDACTED]` sebelum ditulis.

## Alur context (ALS)

```
HTTP masuk
  └─ createRequestLogger        → runWithContext({ requestId, method, path })
       └─ route handler          → logger.info(...)        ✅ konteks ikut
            └─ service / db call  → logger.debug(...)       ✅ konteks ikut (cross-async)
```

`runWithContext` bersarang meng-**merge** dengan induk (requestId tetap ada saat menambah `userId`), dan konteks bertahan melewati `await`/timeout.

## Struktur

```
packages/logger/
├── package.json          # @packages/logger; zero runtime deps; test: jest
├── tsconfig.json         # extends @configs/typescript/node.json (+ jest types)
├── tsconfig.build.json   # emit CJS → dist/ (spec di-exclude)
├── eslint.config.mjs     # re-export @configs/eslint/base
└── src/
    ├── index.ts          # export publik
    ├── types.ts          # LogLevel, LogFormat, LogContext, LogFields, LoggerOptions
    ├── als.ts            # runWithContext / getContext / updateContext (AsyncLocalStorage)
    ├── logger.ts         # createLogger, level filter, normalize helpers
    ├── redact.ts         # redact() + DEFAULT_REDACT_KEYS
    ├── render.ts         # renderer json / pretty
    ├── request.ts        # createRequestLogger (middleware Express)
    ├── nestjs.ts         # NestLoggerService (LoggerService)
    └── *.spec.ts         # unit test
```

## Perintah

| Perintah                                   | Deskripsi                              |
| ------------------------------------------ | -------------------------------------- |
| `pnpm --filter @packages/logger lint`      | ESLint (`@configs/eslint/base`)        |
| `pnpm --filter @packages/logger typecheck` | `tsc --noEmit`                         |
| `pnpm --filter @packages/logger test`      | Unit test (Jest, testEnvironment node) |
| `pnpm --filter @packages/logger build`     | Compile ke `dist/` (CJS + d.ts)        |

## Catatan

- **Node-only** (memakai `node:async_hooks`) — paket ini tidak untuk browser; Next.js server components/route handler boleh memakai paket yang sama nanti.
- `@nestjs/common` hanya devDependency (dipakai untuk tipe `LoggerService` saja; `import type` — tidak ada dependency runtime).
- Di konsumen: pastikan `import '@packages/environment'` (atau `@configs/next`) sudah jalan sebelum `createLogger` membaca env.
