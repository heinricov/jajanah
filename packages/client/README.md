# @packages/client

**Typed API client** — satu-satunya cara resmi aplikasi web (Next.js) berkomunikasi dengan `apps/api`. Type-safe: setiap request/response di-unwrap dari envelope `{ data }` dan **divalidasi otomatis** oleh schema Zod dari [`@packages/validators`](../validators/README.md).

> Package ini **tidak** mendefinisikan tipe/schema sendiri — semuanya berasal dari `@packages/validators` (SSOT). Di sini hanya ada transport, envelope handling, dan error terketik.

## Pemakaian

```ts
import { apiClient, ApiHttpError, ApiTransportError, ApiValidationError } from '@packages/client';

// Response ter-unwrap + tervalidasi (Promise<HealthResponse>)
const health = await apiClient.getHealth();

try {
  await apiClient.getHealth();
} catch (error) {
  if (error instanceof ApiTransportError) {
    // jaringan gagal / API tidak terjangkau
  } else if (error instanceof ApiHttpError) {
    // non-2xx — error terkontrak: error.status / error.code / error.message / error.details
  } else if (error instanceof ApiValidationError) {
    // respons tidak sesuai schema/envelope — error.data berisi payload mentah
  }
}
```

Custom client (tes / base URL lain):

```ts
import { createApiClient } from '@packages/client';

const client = createApiClient({ baseUrl: 'http://localhost:3002', fetch: mockFetch });
```

### Endpoint auth

```ts
// Register → AuthUser (login terpisah); Login → { token, expiresAt, user }
const user = await apiClient.register({ name, email, password });
const { token, expiresAt, user: me } = await apiClient.login({ email, password });

// Endpoint yang butuh token → kirim per-panggilan (stateless; penyimpanan token = urusan app)
const profile = await apiClient.me(token); // GET /auth/me
await apiClient.logout(token); // POST /auth/logout → null (revoke sesi server)

try {
  await apiClient.login({ email, password });
} catch (error) {
  if (error instanceof ApiHttpError && error.code === 'INVALID_CREDENTIALS') {
    // 401 — email/password salah (kode dari @packages/validators, SSOT)
  }
}
```

> Penyimpanan token (cookie/httpOnly, dsb.) **bukan** tanggung jawab package ini — client hanya menerima/mengirim token per-panggilan.

### Base URL

Diurutkan dari: `options.baseUrl` → `NEXT_PUBLIC_API_URL` (root `.env*`, di-inline oleh Next saat build) → fallback `http://localhost:3002`.

| Mode (root `.env*`) | `NEXT_PUBLIC_API_URL`        |
| ------------------- | ---------------------------- |
| development         | `http://localhost:3002`      |
| dasar/produksi      | URL publik API (`https://…`) |

> `NEXT_PUBLIC_API_URL` = alamat yang dipanggil **client**. Berbeda dari `API_BASE_URL` = alamat yang dilaporkan API tentang dirinya sendiri (field `baseUrl` di `GET /`).

## Alur request

1. **Query** divalidasi dulu (`paginationParamsSchema`) — parameter tidak valid → `ApiValidationError` sebelum fetch.
2. **Fetch** gagal / network error → `ApiTransportError`.
3. **Non-2xx** → body dicoba parse dengan `apiErrorEnvelopeSchema` → `ApiHttpError` (status/code/message/details terketik); body tidak terkontrak → `ApiHttpError` generik (`code: 'INTERNAL'`).
4. **2xx** → wajib envelope `{ data }` lalu `schema.parse(data)` → data ter-`type` & tervalidasi; gagal → `ApiValidationError`.

## Menambah endpoint

1. Definisikan request/response di [`@packages/validators`](../validators/README.md) (interface + Zod schema).
2. Tambah method di `src/client.ts`:

```ts
getList(query: PaginationParams): Promise<Thing[]> {
  return this.request('/things', thingListSchema, { query });
}
```

3. Test dengan mock fetch (lihat `src/client.spec.ts`), lalu `pnpm --filter @packages/client build`.

## Struktur

```
packages/client/
├── package.json          # @packages/client; deps: @packages/validators, zod; test: jest
├── tsconfig.json         # extends @configs/typescript/browser.json (+ NodeNext untuk emit CJS)
├── tsconfig.build.json   # emit CJS → dist/ (spec di-exclude)
├── eslint.config.mjs     # re-export @configs/eslint/base
└── src/
    ├── index.ts          # export apiClient, createApiClient, ApiClient, errors
    ├── client.ts         # class ApiClient: buildUrl, fetch, envelope unwrap, validasi + getHealth/register/login/logout/me
    ├── errors.ts         # ApiClientError → ApiTransportError / ApiHttpError / ApiValidationError
    ├── env.d.ts          # deklarasi process.env.NEXT_PUBLIC_API_URL (tanpa @types/node)
    └── client.spec.ts    # unit test (mock fetch: success/error/validation/network/query)
```

## Perintah

| Perintah                                   | Deskripsi                              |
| ------------------------------------------ | -------------------------------------- |
| `pnpm --filter @packages/client lint`      | ESLint (`@configs/eslint/base`)        |
| `pnpm --filter @packages/client typecheck` | `tsc --noEmit`                         |
| `pnpm --filter @packages/client test`      | Unit test (Jest + ts-jest, mock fetch) |
| `pnpm --filter @packages/client build`     | Compile ke `dist/` (CJS + d.ts)        |

## Catatan

- Konsumen menambahkan `"@packages/client": "workspace:*"`; `dist/` di-ignore — jalankan `pnpm build` (Turbo sudah `^build` sebelum typecheck/test konsumen).
- Browser memanggil API lintas-origin → `apps/api` menyalakan `app.enableCors()`.
- Di luar Next (mis. smoke test Node), `NEXT_PUBLIC_API_URL` dibaca dari `process.env` runtime (bukan di-inline).
