# Apps — peta route, boundary, dan bootstrap

Sumber: `apps/web`, `apps/admin`, `apps/api`. Perbarui bila route/struktur berubah.

## apps/web (Next.js 16, port 3000)

`name: web` · deps: `@packages/auth`, `@packages/client`, `@packages/ui` (+ `@configs/next` dev)

### Route map (`app/`)

| URL | File | Perilaku |
| --- | --- | --- |
| `/` | `app/page.tsx` | Landing publik + `HealthStatus` (contoh pemakaian `apiClient.getHealth()`) |
| `/auth/login` | `app/auth/login/page.tsx` | `'use client'`, `<Suspense>` untuk `useSearchParams`; baca `?verified=1` (banner), `?reset=1` (banner `RESET_NOTICE`), `?error=` (`OAUTH_ERRORS`), tawarkan `resendVerificationAction` bila `EMAIL_NOT_VERIFIED` |
| `/auth/register` | `app/auth/register/page.tsx` | Tanpa auto-login → redirect `/auth/verify-email?sent=1&email=...` |
| `/auth/verify-email` | `app/auth/verify-email/page.tsx` | **Server component**: `?token` valid → `authService.verifyEmail` → `redirect('/auth/login?verified=1')`; token invalid/kedaluwarsa → kartu "Tautan tidak valid"; `?sent=1` → kartu cek-email + tombol kirim ulang |
| `/auth/forgot-password` | `app/auth/forgot-password/page.tsx` | **Client component**: `FormForgotPassword` → `forgotPasswordAction` (selalu `{ok:true}` — kartu "Check your inbox" entah email dikenal; error server → `notice`) |
| `/auth/forgot-password/new-password` | `app/auth/forgot-password/new-password/page.tsx` | **Server component**: tanpa `?token` → kartu "Tautan tidak valid"; ada token → `components/reset-password-form.tsx` (client) → `resetPasswordAction` → `redirect('/auth/login?reset=1')`; gagal (`INVALID_RESET_TOKEN`/`VALIDATION`) → `notice`, form tetap terbuka |
| `/home` | `app/(protected)/home/page.tsx` | Terproteksi `requireAuth()` |
| `/api/auth/google` | `app/api/auth/google/route.ts` | `GET` → `beginGoogleOAuth()` (satu-satunya route handler auth) |
| `/api/auth/google/callback` | `app/api/auth/google/callback/route.ts` | `GET` → `completeGoogleOAuth()` → redirect ke `/home` atau `/auth/login?error=...` |

Catatan: `(protected)` **tidak** muncul di URL — nama route group.

**Belum ada**: `not-found.tsx`, `loading.tsx`, `error.tsx`, `global-error.tsx`
(boundaries masih default Next).

### Layout & provider (`app/layout.tsx`, server component)

```
<html> → <body> → <AuthProvider initialUser={user}>  ← user dari getSessionUser()
                   <SiteNavbar />                    ← client wrapper: components/site-navbar.tsx
                   {children}
                   <Footer />
                 </AuthProvider>
```

Stack import: `@packages/ui/globals.css` · `@packages/auth/next` (`AuthProvider`) ·
`@packages/auth/next/server` (`getSessionUser`) · `@packages/ui/navigations/` ·
`../components/site-navbar` · `@packages/ui/lib/utils` (`cn`) · font `Oxanium`.

### `proxy.ts` (bukan `middleware.ts`)

```ts
export function proxy(request: NextRequest) { /* cek keberadaan cookie tj_token saja */ }
export const config = { matcher: ['/home/:path*'] };
```

Dua lapis keamanan: `proxy.ts` hanya cek **cookie ada** (murah) → verifikasi otoritatif
(token valid/role) oleh `requireAuth()` / `requireAdmin()` di layout server. **Jangan
melakukan verifikasi token di proxy** — biarkan layout yang melakukannya.

### Komponen `components/`

- `site-navbar.tsx` (`'use client'`) — membungkus `SiteNavbar` server-safe, menyuntikkan
  `onLogout` dari `useAuth()`.
- `resend-verification.tsx` (`'use client'`) — tombol kirim ulang memanggil
  `resendVerificationAction`.
- `health-status.tsx` (`'use client'`) — state `loading/ok/error` + `useEffect` dengan
  guard `active` anti setState-after-unmount.

## apps/admin (Next.js 16, port 3001)

`name: admin` · deps: `@packages/auth`, `@packages/client`, `@packages/ui`,
`@packages/validators`

| URL | File | Perilaku |
| --- | --- | --- |
| `/` | `app/page.tsx` | `redirect('/dashboard')` |
| `/auth/login` | `app/auth/login/page.tsx` | `FormLogin` **`showSocial` tidak dipakai** (admin tanpa login Google) dan `footer={null}` (tanpa link Sign Up); kini dibungkus `<Suspense>` untuk `useSearchParams` → banner `?reset=1` |
| `/auth/forgot-password` (+ `/new-password`) | dua halaman | **Aktif**, sama dengan web (server action domain bersama; tautan email selalu berbasis `APP_URL` → halaman web) |
| `/dashboard` | `app/(protected)/dashboard/page.tsx` | `requireAdmin()` + `AuthDashboardLayout`; **isi masih placeholder** (teks demo) |

- `app/layout.tsx` sama pola dengan web **tanpa** `SiteNavbar`/`Footer`.
- `(protected)/layout.tsx` → `await requireAdmin()` lalu
  `<AuthDashboardLayout>` (`components/auth-dashboard-layout.tsx`, `'use client'`).
- `proxy.ts` matcher `['/dashboard/:path*']`.
- Tidak ada self-register dan tidak ada route `app/api/`.

## apps/api (NestJS 11, port 3002)

`name: api` · deps: `@packages/auth`, `@packages/environment`, `@packages/logger`,
`@packages/validators` · output **CommonJS** · builder `nest build` = **`tsc`**
(jangan diganti SWC/esbuild tanpa plugin decorator-metadata).

### Bootstrap (`src/main.ts`) — urutan penting

```ts
import 'reflect-metadata';
import '@packages/environment';
// ...
app.useLogger(nestLogger);
app.use(createRequestLogger({ logger }));   // set x-request-id sebelum handler mana pun
app.enableCors();                            // tanpa opsi = origin terbuka (TODO produksi)
app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
app.useGlobalFilters(new AllExceptionsFilter());
await app.listen(Number(process.env.API_PORT ?? 3002));
```

### Route

| Method | Path | Auth | Sukses | Gagal |
| --- | --- | --- | --- | --- |
| `GET` | `/` | — | `200 { data: HealthResponse }` | 500 |
| `POST` | `/auth/register` | — | `201 { data: AuthUser }` | 400 `VALIDATION`, 409 `EMAIL_TAKEN` |
| `POST` | `/auth/login` | — | `200 { data: LoginResponse }` (`@HttpCode(200)`) | 400, 401 `INVALID_CREDENTIALS`, 403 `EMAIL_NOT_VERIFIED` |
| `POST` | `/auth/logout` | `AuthGuard` | `200 { data: null }` | 401 |
| `GET` | `/auth/me` | `AuthGuard` | `200 { data: AuthUser }` | 401 |

Semua response di-`parse` schema dulu (`authUserSchema`, `loginResponseSchema`) baru
`ok(...)` — kontrak pecah = error runtime di API, bukan diam di browser.

**Penting**: app Next **tidak** memakai endpoint ini — web/admin memanggil domain
`@packages/auth` langsung via server action (tanpa HTTP). Endpoint di atas hanya untuk
konsumen eksternal. Konsekuensi: **registrasi via API tidak mengirim email konfirmasi**
(path email hanya ada di server action).

### Guard & filter

- `AuthGuard`: `Authorization: Bearer <token>` → `authService.authenticate(token)` →
  set `request.user` + `updateContext({ userId })`. Header kosong →
  `UnauthorizedException({ code:'UNAUTHORIZED', message:'Missing bearer token' })`.
- Decorator: `@CurrentUser()`, `@AuthToken()` (`src/auth/current-user.decorator.ts`).
- `AllExceptionsFilter` (`src/filters/all-exceptions.filter.ts`) → envelope
  `{ error: { status, code, message, details? } }`:
  `AuthError` → status+code dari domain; `HttpException` array/message[] → `VALIDATION`;
  sisanya `fallbackCode(status)` (400/401/403/404/409) ; tak terduga → log stack + bare
  `500 INTERNAL` ("Internal server error") tanpa detail internal.
- Logger Express (`createRequestLogger`) menutup `res.on('finish')` → log
  `request completed` dengan `statusCode` + `durationMs`.

## Aturan boundary client/server (berlaku untuk kedua app Next)

1. File `page.tsx`/`layout.tsx` **server** → boleh `import { requireAuth, getSessionUser,
   requireAdmin } from '@packages/auth/next/server'`.
2. File `'use client'` → **hanya** `@packages/auth/next` (context/error) atau
   `@packages/auth/next/server/actions` (memanggil action).
   Import barrel `.../next/server` dari client = **bundle error saat build**.
3. Halaman yang memakai `useSearchParams` **wajib** dibungkus `<Suspense>` (lihat
   `app/auth/login/page.tsx`).
4. Route handler hanya untuk OAuth (`app/api/auth/*`); sisanya pakai server action.
5. `@packages/ui` hanya boleh dikonsumsi lewat subpath-nya (`auth/`, `navigations/`,
   `components/*`, `lib/*`, `lib/utils`) — lihat `packages.md`.
6. Jangan import `@packages/db` / `@packages/client` dari server component web untuk data
   auth — data sesi lewat `getSessionUser()`; data API lewat `@packages/client`.

## Menambah halaman terproteksi baru

1. Buat folder di `app/(protected)/<nama>/page.tsx`.
2. Tambahkan route ke `config.matcher` di `proxy.ts` (cek cookie saja).
3. Di page/layout: `const user = await requireAuth();` (atau `requireAdmin()`).
4. Untuk dashboard admin: letakkan di dalam `AuthDashboardLayout`.
5. Verifikasi dengan `pnpm check && pnpm build`.
