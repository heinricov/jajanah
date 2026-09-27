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
      router.replace('/home');
    }
  }, [status, router]);

  return (
    <FormRegister
      error={error}
      isPending={pending}
      showSocial={false}
      onSubmit={async ({ name, email, password }) => {
        setPending(true);
        setError(null);
        try {
          await register({ name, email, password });
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
