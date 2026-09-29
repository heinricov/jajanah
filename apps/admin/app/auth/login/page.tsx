'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { FormLogin } from '@packages/ui/auth/';
import { authErrorMessage, useAuth } from '@packages/auth/next';

const RESET_NOTICE = 'Password berhasil diperbarui. Silakan masuk dengan password baru.';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const resetNotice = searchParams.get('reset') === '1' ? RESET_NOTICE : null;

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard');
    }
  }, [status, router]);

  return (
    <FormLogin
      error={error}
      notice={resetNotice}
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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
