# @packages/email

**SSOT pengiriman email** — satu-satunya tempat pengiriman email aplikasi didefinisikan (saat ini: email konfirmasi registrasi). Adapter HTTP API [Resend](https://resend.com) via `fetch` bawaan Node.js — **tanpa dependency runtime**.

- `RESEND_API_KEY` terisi → kirim sungguhan ke `https://api.resend.com/emails`.
- `RESEND_API_KEY` kosong (development/CI) → **fallback console**: tautan konfirmasi di-log ke server, sehingga alur registrasi → konfirmasi → login bisa diuji penuh tanpa layanan email sungguhan.

```
@packages/auth (registerAction / resendVerificationAction)
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

// { delivered: true }              → email terkirim
// { delivered: false, reason: 'no_api_key' } → fallback console (bukan kesalahan)
// throw                            → API Resend non-2xx (pemanggil boleh mengabaikan)
```

`sendConfirmationEmail(input, deps?)` juga bisa dipanggil langsung dengan `deps.fetchImpl` injectable untuk test.

## Template

Satu email aktif: **Konfirmasi email Anda** (subjek `Konfirmasi email Anda — <APP_NAME>`), versi HTML + plain-text, nama penerima di-escape (aman dari HTML injection), tombol tautan + URL fallback untuk klien yang memblokir tombol.

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
│   ├── index.ts       # emailService + sendConfirmationEmail (adapter Resend + fallback console)
│   └── email.spec.ts  # test adapter (fallback, payload Resend, error HTTP)
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

- Konsumen saat ini hanya `@packages/auth` (server action `registerAction` & `resendVerificationAction`) — arah edge `auth → email`, tanpa siklus.
- Ganti adapter (SMTP, SendGrid, dsb.) cukup mengganti isi `src/index.ts`; kontrak `sendConfirmation` tetap.
- Pengiriman email gagal saat register **tidak** menggagalkan pendaftaran — akun sudah terdaftar dan user bisa meminta kirim ulang dari halaman verifikasi/login.
