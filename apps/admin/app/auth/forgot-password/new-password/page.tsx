import Link from 'next/link';

import { AuthCard } from '@packages/ui/auth/';

import { ResetPasswordForm } from '../../../../components/reset-password-form';

type SearchParams = Promise<{
  token?: string;
}>;

function InvalidLinkCard() {
  return (
    <AuthCard
      title="Tautan tidak valid"
      description="Tautan reset password tidak ada, sudah dipakai, atau kedaluwarsa."
      footer={
        <Link href="/auth/forgot-password" className="text-foreground underline underline-offset-4">
          Minta tautan baru
        </Link>
      }
    >
      <p className="text-center text-sm text-muted-foreground">
        Minta tautan baru dari halaman lupa password, lalu buka tautan terbaru dari email Anda.
        Tautan hanya berlaku sekali.
      </p>
    </AuthCard>
  );
}

/**
 * Halaman setel password baru (server component — GET, tanpa route handler):
 *
 * - `?token=` ada → form client (`ResetPasswordForm`) menukarnya lewat
 *   `resetPasswordAction`; validitas token dicek saat submit.
 * - tanpa `?token=` → kartu "tautan tidak valid".
 * - sukses → redirect `/auth/login?reset=1` (tanpa auto-login).
 */
export default async function NewPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const { token } = await searchParams;

  if (token === undefined || token === '') return <InvalidLinkCard />;
  return <ResetPasswordForm token={token} />;
}
