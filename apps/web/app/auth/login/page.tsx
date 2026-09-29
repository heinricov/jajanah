'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { FormLogin } from '@packages/ui/auth/';
import { AuthActionError, authErrorMessage, useAuth } from '@packages/auth/next';
import { resendVerificationAction } from '@packages/auth/next/server/actions';

/** Pesan untuk `?error=` hasil redirect callback OAuth Google. */
const OAUTH_ERRORS: Record<string, string> = {
  oauth: 'Gagal masuk dengan Google. Silakan coba lagi.',
  oauth_config: 'Login Google belum dikonfigurasi di server. Hubungi admin.',
  oauth_account_linked:
    'Akun Google ini tertaut ke email lain. Silakan masuk dengan email tersebut.',
  oauth_email_unverified: 'Email Google belum terverifikasi. Coba gunakan akun lain.',
};

const VERIFIED_NOTICE = 'Email berhasil diverifikasi. Silakan masuk dengan email dan password.';

const RESET_NOTICE = 'Password berhasil diperbarui. Silakan masuk dengan password baru.';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showResend, setShowResend] = useState(false);
  const [pending, setPending] = useState(false);

  const oauthError = OAUTH_ERRORS[searchParams.get('error') ?? ''] ?? null;
  const verifiedNotice = searchParams.get('verified') === '1' ? VERIFIED_NOTICE : null;
  const resetNotice = searchParams.get('reset') === '1' ? RESET_NOTICE : null;

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/profile');
    }
  }, [status, router]);

  async function handleResend(email: string) {
    const result = await resendVerificationAction(email);
    if (result.ok) {
      setError(null);
      setShowResend(false);
      setNotice('Tautan konfirmasi baru telah dikirim. Periksa juga folder spam Anda.');
    } else {
      setError(result.message);
    }
  }

  return (
    <FormLogin
      error={oauthError ?? error}
      notice={notice ?? verifiedNotice ?? resetNotice}
      resend={!oauthError && showResend ? { onResend: handleResend } : undefined}
      isPending={pending}
      showSocial
      onSocialSubmit={(provider) => {
        if (provider !== 'google') return;
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- OAuth butuh full navigation ke GET /api/auth/google (redirect ke consent screen Google)
        window.location.assign('/api/auth/google');
      }}
      onSubmit={async ({ email, password }) => {
        setPending(true);
        setError(null);
        setNotice(null);
        try {
          await login({ email, password });
          router.replace('/profile');
        } catch (cause) {
          setError(authErrorMessage(cause));
          setShowResend(cause instanceof AuthActionError && cause.code === 'EMAIL_NOT_VERIFIED');
        } finally {
          setPending(false);
        }
      }}
    />
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
