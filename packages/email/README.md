# @packages/email

**SSOT pengiriman email** — satu-satunya tempat pengiriman email aplikasi didefinisikan (saat ini: konfirmasi registrasi & tautan reset password). Adapter HTTP API [Resend](https://resend.com) via `fetch` bawaan Node.js — **tanpa dependency runtime**.

- `RESEND_API_KEY` terisi → kirim sungguhan ke `https://api.resend.com/emails`.
- `RESEND_API_KEY` kosong (development/CI) → **fallback console**: tautan di-log ke server, sehingga alur registrasi → konfirmasi → login (dan lupa password → reset) bisa diuji penuh tanpa layanan email sungguhan.

```
@packages/auth (registerAction / resendVerificationAction / forgotPasswordAction)
        │  { to, name, link }
        ▼
@packages/email  ── RESEND_API_KEY kosong? ──► console (link di-log)
        │                │ ya
        │                ▼
        └──────► POST api.resend.com/emails
```

## Pemakaian

```ts
import { emailService } from '@packages/email';

const result = await emailService.sendConfirmation({
  to: 'budi@example.com',
  name: 'Budi',
  link: 'https://app.example.com/auth/verify-email?token=…',
});

await emailService.sendPasswordReset({
  to: 'budi@example.com',
  name: 'Budi',
  link: 'https://app.example.com/auth/forgot-password/new-password?token=…',
});

// { delivered: true }              → email terkirim
// { delivered: false, reason: 'no_api_key' } → fallback console (bukan kesalahan)
// throw                            → API Resend non-2xx (pemanggil boleh mengabaikan)
```

`sendConfirmationEmail(input, deps?)` / `sendPasswordResetEmail(input, deps?)` juga bisa dipanggil langsung dengan `deps.fetchImpl` injectable untuk test.

## Template

Dua email aktif, pola sama — versi HTML + plain-text, nama penerima di-escape (aman dari HTML injection), tombol tautan + URL fallback untuk klien yang memblokir tombol:

| Email          | Fungsi              | Subjek                               | Halaman tujuan                               |
| -------------- | ------------------- | ------------------------------------ | -------------------------------------------- |
| Konfirmasi     | `sendConfirmation`  | `Konfirmasi email Anda — <brand>`    | `/auth/verify-email?token=…`                 |
| Reset password | `sendPasswordReset` | `Atur ulang password Anda — <brand>` | `/auth/forgot-password/new-password?token=…` |

## Environment

| Variabel         | Wajib                      | Default                           | Deskripsi                                                                    |
| ---------------- | -------------------------- | --------------------------------- | ---------------------------------------------------------------------------- |
| `RESEND_API_KEY` | ya (untuk kirim sungguhan) | — (kosong = fallback console)     | API key Resend — buat di <https://resend.com/api-keys>                       |
| `MAIL_FROM`      | tidak                      | `Jajanah <onboarding@resend.dev>` | Alamat pengirim — di produksi pakai domain yang sudah diverifikasi di Resend |
| `APP_NAME`       | tidak                      | `Jajanah`                         | Nama brand di subjek/sapaan (dipakai juga oleh apps/api)                     |

Nilai dibaca via `process.env` (diisi `@packages/environment` dari root `.env*` — SSOT). Catatan: di `.env.production` isi `MAIL_FROM` dengan domain produksi.

## Struktur

```
packages/email/
├── src/
│   ├── index.ts       # emailService + sendConfirmationEmail + sendPasswordResetEmail (adapter Resend + fallback console)
│   └── email.spec.ts  # test adapter (fallback, payload Resend, error HTTP, email reset)
├── package.json       # build/lint/typecheck/test — pola sama @packages/client
├── tsconfig.json      # node.json (NodeNext, CJS)
└── tsconfig.build.json
```

## Perintah

```bash
pnpm --filter @packages/email build       # tsc → dist/
pnpm --filter @packages/email test        # jest
pnpm --filter @packages/email typecheck   # tsc --noEmit
pnpm --filter @packages/email lint        # eslint
```

## Catatan

- Konsumen saat ini hanya `@packages/auth` (server action `registerAction`, `resendVerificationAction` & `forgotPasswordAction`) — arah edge `auth → email`, tanpa siklus.
- Ganti adapter (SMTP, SendGrid, dsb.) cukup mengganti isi `src/index.ts`; kontrak `sendConfirmation` & `sendPasswordReset` tetap.
- Pengiriman email gagal saat register **tidak** menggagalkan pendaftaran — akun sudah terdaftar dan user bisa meminta kirim ulang dari halaman verifikasi/login. Sama halnya saat request reset: respons aksi selalu sukses (anti-enumerasi).
- Pengiriman lewat fungsi privat `deliver()` (satu jalur POST Resend untuk semua email) — data per-jenis email (subjek, HTML, text, pesan log fallback) disusun masing-masing fungsi publik.
