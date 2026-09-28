import Link from 'next/link';
import { redirect } from 'next/navigation';

import { authService, AuthError } from '@packages/auth';
import { AuthCard } from '@packages/ui/auth/';

import { ResendVerification } from '../../../components/resend-verification';

type SearchParams = Promise<{
  token?: string;
  sent?: string;
  email?: string;
}>;

function InvalidLinkCard() {
  return (
    <AuthCard
      title="Tautan tidak valid"
      description="Tautan konfirmasi tidak valid, sudah dipakai, atau kedaluwarsa."
      footer={
        <Link href="/auth/login" className="text-foreground underline underline-offset-4">
          Kembali ke halaman masuk
        </Link>
      }
    >
      <p className="text-center text-sm text-muted-foreground">
        Minta tautan baru dari halaman masuk — tombol kirim ulang tersedia di sana. Belum punya
        akun? Daftar ulang untuk mendapatkan tautan konfirmasi baru.
      </p>
    </AuthCard>
  );
}

function CheckEmailCard({ email }: { email?: string }) {
  return (
    <AuthCard
      title="Periksa email Anda"
      description="Kami telah mengirim tautan konfirmasi ke email berikut:"
      footer={
        <Link href="/auth/login" className="text-foreground underline underline-offset-4">
          Kembali ke halaman masuk
        </Link>
      }
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="break-all rounded-md border border-border bg-muted/50 px-3 py-2 text-sm font-medium">
          {email ?? 'email Anda'}
        </p>
        <p className="text-sm text-muted-foreground">
          Klik tautan di email untuk mengonfirmasi, lalu masuk dengan email dan password. Tautan
          hanya berlaku sekali dan kedaluwarsa dalam 24 jam.
        </p>
        <p className="text-sm text-muted-foreground">
          Tidak menerima email? Periksa folder spam, atau kirim ulang:
        </p>
        <ResendVerification email={email} />
      </div>
    </AuthCard>
  );
}

/**
 * Halaman konfirmasi email (server component — GET, tanpa route handler):
 *
 * - `?token=` valid → `authService.verifyEmail` → redirect ke login
 *   (`?verified=1`) — tanpa auto-login (user memilih masuk manual).
 * - `?token=` tidak valid/kedaluwarsa → kartu error.
 * - `?sent=1&email=` (dari register) → kartu "periksa email" + kirim ulang.
 * - Tanpa parameter → redirect ke halaman masuk.
 */
export default async function VerifyEmailPage({ searchParams }: { searchParams: SearchParams }) {
  const { token, sent, email } = await searchParams;

  if (token !== undefined && token !== '') {
    try {
      await authService.verifyEmail(token);
    } catch (cause) {
      if (!(cause instanceof AuthError) || cause.code !== 'INVALID_VERIFY_TOKEN') throw cause;
      return <InvalidLinkCard />;
    }
    redirect('/auth/login?verified=1');
  }

  if (sent !== undefined && sent !== '') {
    return <CheckEmailCard email={email} />;
  }

  redirect('/auth/login');
}
