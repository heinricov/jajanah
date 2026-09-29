/**
 * Pengiriman email aplikasi (`@packages/email`) — SSOT pengiriman email.
 *
 * Dua jenis email: konfirmasi registrasi (`sendConfirmationEmail`) dan
 * tautan reset password (`sendPasswordResetEmail`).
 *
 * Adapter: HTTP API Resend (`https://api.resend.com/emails`) via `fetch`
 * bawaan Node — tanpa dependency runtime. Bila `RESEND_API_KEY` kosong
 * (development/CI), fallback ke console: link dikirim ke log server sehingga
 * alur konfirmasi/reset tetap bisa diuji tanpa layanan email sungguhan.
 *
 * Env dibaca langsung dari `process.env` (diisi `@packages/environment` dari
 * root `.env*`):
 *
 * | Variabel                 | Wajib | Default                          |
 * | ------------------------ | ----- | -------------------------------- |
 * | `RESEND_API_KEY`         | ya¹   | — (kosong = fallback console)     |
 * | `MAIL_FROM`              | tidak | `Jajanah <onboarding@resend.dev>` |
 *
 * ¹ Wajib hanya untuk pengiriman sungguhan (produksi).
 */

export type ConfirmationEmailInput = {
  /** Alamat tujuan. */
  to: string;
  /** Nama penerima (untuk sapaan — di-escape di konten HTML). */
  name: string;
  /** Tautan absolut konfirmasi email. */
  link: string;
};

/** Input email reset password — bentuk sama dengan konfirmasi (sapaan + tautan). */
export type PasswordResetEmailInput = ConfirmationEmailInput;

/** Hasil pengiriman — fallback console bukan kesalahan (`no_api_key`). */
export type SendResult = { delivered: true } | { delivered: false; reason: 'no_api_key' };

export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export type SendDeps = {
  /** Inject `fetch` untuk test (default: `fetch` global). */
  fetchImpl?: FetchLike;
};

const RESEND_API_URL = 'https://api.resend.com/emails';

function resolveFrom(): string {
  const from = process.env.MAIL_FROM?.trim();
  return from && from.length > 0 ? from : 'Jajanah <onboarding@resend.dev>';
}

function resolveBrand(): string {
  const name = process.env.APP_NAME?.trim();
  return name && name.length > 0 ? name : 'Jajanah';
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function confirmationSubject(brand: string): string {
  return `Konfirmasi email Anda — ${brand}`;
}

function confirmationHtml(name: string, link: string, brand: string): string {
  const safeName = escapeHtml(name);
  const safeLink = escapeHtml(link);
  return [
    '<!doctype html>',
    '<html><body style="margin:0;padding:24px;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">',
    `<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">`,
    `<h1 style="margin:0 0 12px;font-size:20px;color:#111827;">Konfirmasi email Anda</h1>`,
    `<p style="margin:0 0 12px;font-size:15px;color:#374151;">Halo <strong>${safeName}</strong>,</p>`,
    `<p style="margin:0 0 20px;font-size:15px;color:#374151;">Terima kasih telah mendaftar di ${escapeHtml(brand)}. ` +
      `Klik tombol di bawah untuk mengonfirmasi email Anda:</p>`,
    `<p style="text-align:center;margin:24px 0;">` +
      `<a href="${safeLink}" style="background:#111827;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-size:15px;">Konfirmasi email</a></p>`,
    `<p style="margin:0 0 8px;font-size:13px;color:#6b7280;">Tautan ini hanya berlaku sekali dan kedaluwarsa dalam beberapa jam. ` +
      `Jika Anda tidak merasa mendaftar, abaikan email ini.</p>`,
    `<p style="margin:0;font-size:13px;color:#6b7280;">Tombol tidak bisa diklik? Salin tautan ini ke browser Anda:<br/><br/>` +
      `<a href="${safeLink}">${safeLink}</a></p>`,
    '</div></body></html>',
  ].join('');
}

function confirmationText(name: string, link: string, brand: string): string {
  return [
    `Halo ${name},`,
    '',
    `Terima kasih telah mendaftar di ${brand}. Konfirmasi email Anda dengan membuka tautan berikut:`,
    '',
    link,
    '',
    'Tautan ini hanya berlaku sekali dan kedaluwarsa dalam beberapa jam.',
    'Jika Anda tidak merasa mendaftar, abaikan email ini.',
  ].join('\n');
}

function resetSubject(brand: string): string {
  return `Atur ulang password Anda — ${brand}`;
}

function resetHtml(name: string, link: string, brand: string): string {
  const safeName = escapeHtml(name);
  const safeLink = escapeHtml(link);
  return [
    '<!doctype html>',
    '<html><body style="margin:0;padding:24px;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">',
    `<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">`,
    `<h1 style="margin:0 0 12px;font-size:20px;color:#111827;">Atur ulang password Anda</h1>`,
    `<p style="margin:0 0 12px;font-size:15px;color:#374151;">Halo <strong>${safeName}</strong>,</p>`,
    `<p style="margin:0 0 20px;font-size:15px;color:#374151;">Kami menerima permintaan pengaturan ulang password untuk akun Anda di ${escapeHtml(brand)}. ` +
      `Klik tombol di bawah untuk memilih password baru:</p>`,
    `<p style="text-align:center;margin:24px 0;">` +
      `<a href="${safeLink}" style="background:#111827;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-size:15px;">Atur ulang password</a></p>`,
    `<p style="margin:0 0 8px;font-size:13px;color:#6b7280;">Tautan ini hanya berlaku sekali dan segera kedaluwarsa. ` +
      `Jika Anda tidak meminta pengaturan ulang, abaikan email ini — password Anda tidak berubah.</p>`,
    `<p style="margin:0;font-size:13px;color:#6b7280;">Tombol tidak bisa diklik? Salin tautan ini ke browser Anda:<br/><br/>` +
      `<a href="${safeLink}">${safeLink}</a></p>`,
    '</div></body></html>',
  ].join('');
}

function resetText(name: string, link: string, brand: string): string {
  return [
    `Halo ${name},`,
    '',
    `Kami menerima permintaan pengaturan ulang password untuk akun Anda di ${brand}. Atur ulang password dengan membuka tautan berikut:`,
    '',
    link,
    '',
    'Tautan ini hanya berlaku sekali dan segera kedaluwarsa.',
    'Jika Anda tidak meminta pengaturan ulang, abaikan email ini — password Anda tidak berubah.',
  ].join('\n');
}

/** Payload siap-kirim ke adapter (subject/html/text + pesan log fallback). */
type DeliverPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Pesan log bila `RESEND_API_KEY` kosong — wajib memuat link. */
  fallbackLog: string;
};

/**
 * Kirim satu email via Resend — `RESEND_API_KEY` kosong → log ke console
 * (`delivered: false`); terisi → POST, respons non-2xx → throw.
 */
async function deliver(payload: DeliverPayload, deps: SendDeps = {}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || apiKey.length === 0) {
    // eslint-disable-next-line no-console -- fallback development: tautan dibaca dari log server
    console.log(payload.fallbackLog);
    return { delivered: false, reason: 'no_api_key' };
  }

  const fetchImpl: FetchLike = deps.fetchImpl ?? (globalThis.fetch as FetchLike);
  const response = await fetchImpl(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: resolveFrom(),
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`[email] Resend gagal (HTTP ${response.status}) ${detail}`.trim());
  }

  return { delivered: true };
}

/**
 * Kirim email konfirmasi registrasi.
 *
 * - `RESEND_API_KEY` kosong → log link ke console, `delivered: false`.
 * - Terisi → POST ke API Resend; respons non-2xx → throw (pemanggil boleh
 *   mengabaikan: akun sudah terdaftar, user bisa meminta kirim ulang).
 */
export async function sendConfirmationEmail(
  input: ConfirmationEmailInput,
  deps: SendDeps = {},
): Promise<SendResult> {
  const brand = resolveBrand();
  return deliver(
    {
      to: input.to,
      subject: confirmationSubject(brand),
      html: confirmationHtml(input.name, input.link, brand),
      text: confirmationText(input.name, input.link, brand),
      fallbackLog: `[email] konfirmasi email untuk ${input.to}\n  ${input.link}`,
    },
    deps,
  );
}

/**
 * Kirim tautan reset password.
 *
 * - `RESEND_API_KEY` kosong → log link ke console, `delivered: false`.
 * - Terisi → POST ke API Resend; respons non-2xx → throw (pemanggil boleh
 *   mengabaikan: respons aksi selalu sukses anti-enumerasi).
 */
export async function sendPasswordResetEmail(
  input: PasswordResetEmailInput,
  deps: SendDeps = {},
): Promise<SendResult> {
  const brand = resolveBrand();
  return deliver(
    {
      to: input.to,
      subject: resetSubject(brand),
      html: resetHtml(input.name, input.link, brand),
      text: resetText(input.name, input.link, brand),
      fallbackLog: `[email] tautan reset password untuk ${input.to}\n  ${input.link}`,
    },
    deps,
  );
}

/** Alias pemanggilan untuk konsumen (`emailService.sendConfirmation(...)`). */
export const emailService = {
  sendConfirmation: sendConfirmationEmail,
  sendPasswordReset: sendPasswordResetEmail,
};
