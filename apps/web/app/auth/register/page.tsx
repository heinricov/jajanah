'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { FormRegister } from '@packages/ui/auth/';
import { authErrorMessage, useAuth } from '@packages/auth/next';

export default function RegisterPage() {
  const router = useRouter();
  const { status, register } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/profile');
    }
  }, [status, router]);

  return (
    <FormRegister
      error={error}
      isPending={pending}
      showSocial
      onSocialSubmit={(provider) => {
        if (provider !== 'google') return;
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- OAuth butuh full navigation ke GET /api/auth/google (redirect ke consent screen Google)
        window.location.assign('/api/auth/google');
      }}
      onSubmit={async ({ name, email, password }) => {
        setPending(true);
        setError(null);
        try {
          await register({ name, email, password });
          // Tidak auto-login: akun menunggu konfirmasi email → halaman cek-email.
          router.replace(`/auth/verify-email?sent=1&email=${encodeURIComponent(email)}`);
        } catch (cause) {
          setError(authErrorMessage(cause));
        } finally {
          setPending(false);
        }
      }}
    />
  );
}
