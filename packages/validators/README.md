# @packages/validators

**SSOT kontrak API**: satu-satunya tempat definisi _types_/_interface_ dan _bagaimana request & response API_ didefinisikan — dipakai `apps/api` (server), `apps/web` & `apps/admin` (client).

## Satu kebenaran, tiga lapisan

Setiap kontrak didefinisikan **sekali** sebagai interface kanonik, lalu dua representasi runtime dicek ke sana saat kompilasi sehingga tidak bisa melenceng:

| Lapisan                 | Lokasi         | Cek kompilasi               | Peran                                                    |
| ----------------------- | -------------- | --------------------------- | -------------------------------------------------------- |
| **Interface**           | `src/types/`   | — (kanonik)                 | Definisi bentuk. Satu kebenaran.                         |
| **Zod schema**          | `src/schemas/` | `const s: z.ZodType<T> = …` | Runtime validation di server **dan** client + `z.infer`. |
| **class-validator DTO** | `src/dtos/`    | `class XDto implements T`   | Validasi _request incoming_ via `ValidationPipe` Nest.   |

**Pembagian peran**:

- **Request incoming** (query/body/params) → DTO class-validator (jalur `ValidationPipe` Nest, native, ada `@Type` transformasi dari string query).
- **Response & data** → Zod schema + interface (berlaku di server untuk memastikan output valid, dan di client untuk mengetes data dari API).

```ts
// Lapisan kanonik (interface) — src/types/health.ts
export interface HealthResponse {
  service: string;
  status: 'ok';
  mode: string;
  appName: string | null;
  baseUrl: string | null;
}

// Lapisan Zod — dicek thd interface saat kompilasi
export const healthResponseSchema: z.ZodType<HealthResponse> = z.object({ … });

// Lapisan DTO — dicek thd interface saat kompilasi
export class PaginationQueryDto implements PaginationParams { … }
```

## Envelope standar (1 kebenaran respon)

Didefinisikan di `src/contract.ts` + helper-nya:

| Bentuk    | Shape                                                                           | Helper                                                 |
| --------- | ------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Sukses    | `{ data: T }`                                                                   | `ok(data)`                                             |
| Paginated | `{ data: T[], meta: { page, limit, total, totalPages, hasNext, hasPrevious } }` | `paginated(rows, createPaginationMeta(params, total))` |
| Error     | `{ error: { status, code, message, details? } }`                                | `apiError()` / `validationError()` / `notFoundError()` |

`code` union: `VALIDATION | BAD_REQUEST | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | CONFLICT | INTERNAL`; status ada di konstanta `httpStatus`.

## Pemakaian

### Server (`apps/api`)

```ts
// Response — pastikan output valid, bungkus envelope
@Get()
getStatus(): ApiEnvelope<HealthResponse> {
  return ok(healthResponseSchema.parse(this.appService.getStatus()));
}

// Request — DTO dipasang di main.ts: useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }))
@Get('posts')
list(@Query() query: PaginationQueryDto) { … }
```

### Client (`apps/web`, `apps/admin`)

```ts
import { healthResponseSchema, type HealthResponse } from '@packages/validators';

const data: HealthResponse = await res.json();
const parsed = healthResponseSchema.safeParse(data); // validasi respons API sebelum dipakai
```

Konsumen menambahkan dependency: `"@packages/validators": "workspace:*"`. Paket ini di-build ke `dist/` (CJS + `.d.ts`) seperti `@packages/db` — aman untuk Nest (CJS) maupun Next (webpack/turbopack).

## Menambah kontrak baru

1. Definisikan **interface** di `src/types/<domain>.ts` (kanonik).
2. Buat **Zod schema** di `src/schemas/` dengan anotasi `z.ZodType<Interface>`.
3. Bila dipakai sebagai request: buat **DTO class-validator** di `src/dtos/` dengan `implements Interface` + decorator `@Is*`/`@Type` (jangan lupa `@IsOptional()` untuk properti opsional).
4. Export lewat `src/index.ts`, lalu `pnpm --filter @packages/validators build`.
5. Konsumen import dari `@packages/validators` — jangan deklarasikan ulang.

## Struktur

```
packages/validators/
├── package.json          # @packages/validators; deps: zod, class-validator, class-transformer
├── tsconfig.json         # extends @configs/typescript/nest.json (butuh decorators) + types:[] (tanpa node globals)
├── tsconfig.build.json   # emit CJS → dist/ (declaration + sourceMap)
├── eslint.config.mjs     # re-export @configs/eslint/base (netral, browser-safe)
└── src/
    ├── index.ts          # re-export semua
    ├── contract.ts       # envelope + helpers + httpStatus + ErrorCode
    ├── types/            # interface kanonik (HealthResponse, PaginationParams, PaginationMeta)
    ├── schemas/          # Zod (healthResponseSchema, paginationParamsSchema, paginationMetaSchema)
    └── dtos/             # class-validator (PaginationQueryDto)
```

## Perintah

| Perintah                                       | Deskripsi                       |
| ---------------------------------------------- | ------------------------------- |
| `pnpm --filter @packages/validators lint`      | ESLint (`@configs/eslint/base`) |
| `pnpm --filter @packages/validators typecheck` | `tsc --noEmit`                  |
| `pnpm --filter @packages/validators build`     | Compile ke `dist/` (CJS + d.ts) |

> `dist/` di-ignore `.gitignore` — jalankan lewat `pnpm build` (Turbo sudah mengurutkan `^build` sebelum `typecheck`/`test`/`build` konsumen).

## Catatan

- tsconfig extends preset **nest** karena DTO memakai decorators (`experimentalDecorators` + `emitDecoratorMetadata`), namun `types: []` dan eslint preset **base** — package ini murni, tanpa asumsi runtime Node/browser tertentu.
- Zod 4 (dual ESM/CJS) → di-build ke CJS, konsumsi lintas app aman.
- Aturan nilai (min/max) hidup di schema Zod **dan** DTO secara paralel — saat mengubah batas, ubah keduanya (dicek sama oleh interface untuk bentuknya).
