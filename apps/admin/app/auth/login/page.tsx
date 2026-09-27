'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { FormLogin } from '@packages/ui/auth/';
import { authErrorMessage, useAuth } from '@packages/auth/next';

export default function LoginPage() {
  const router = useRouter();
  const { status, login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard');
    }
  }, [status, router]);

  return (
    <FormLogin
      error={error}
      isPending={pending}
      footer={null}
      title="Masuk Panel Admin"
      description="Gunakan akun administrator untuk melanjutkan."
      onSubmit={async ({ email, password }) => {
        setPending(true);
        setError(null);
        try {
          await login({ email, password });
          router.replace('/dashboard');
        } catch (cause) {
          setError(authErrorMessage(cause));
        } finally {
          setPending(false);
        }
      }}
    />
  );
}
