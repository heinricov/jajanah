'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { FormLogin } from '@packages/ui/auth/';
import { authErrorMessage, useAuth } from '@packages/auth/next';

/** Pesan untuk `?error=` hasil redirect callback OAuth Google. */
const OAUTH_ERRORS: Record<string, string> = {
  oauth: 'Gagal masuk dengan Google. Silakan coba lagi.',
  oauth_config: 'Login Google belum dikonfigurasi di server. Hubungi admin.',
  oauth_account_linked:
    'Akun Google ini tertaut ke email lain. Silakan masuk dengan email tersebut.',
  oauth_email_unverified: 'Email Google belum terverifikasi. Coba gunakan akun lain.',
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const oauthError = OAUTH_ERRORS[searchParams.get('error') ?? ''] ?? null;

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/home');
    }
  }, [status, router]);

  return (
    <FormLogin
      error={oauthError ?? error}
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
        try {
          await login({ email, password });
          router.replace('/home');
        } catch (cause) {
          setError(authErrorMessage(cause));
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
