'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { AuthActionError, authErrorMessage } from '@packages/auth/next';
import { resetPasswordAction } from '@packages/auth/next/server/actions';
import { FormNewPassword } from '@packages/ui/auth/';

/**
 * Form setel password baru — menukar `token` lewat `resetPasswordAction`.
 *
 * Sukses → redirect `/auth/login?reset=1` (tanpa auto-login; semua sesi lama
 * sudah dicabut server). Token tidak valid / kedaluwarsa → `notice` merah,
 * form tetap terbuka supaya user bisa minta tautan baru lalu coba lagi.
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <FormNewPassword
      isPending={pending}
      notice={notice}
      onSubmit={async ({ password }) => {
        setPending(true);
        setNotice(null);
        try {
          const result = await resetPasswordAction({ token, password });
          if (!result.ok) {
            throw new AuthActionError(result.message, {
              status: result.status,
              code: result.code,
            });
          }
        } catch (cause) {
          setNotice(authErrorMessage(cause, 'Gagal memperbarui password. Coba lagi.'));
          throw cause;
        } finally {
          setPending(false);
        }
        router.replace('/auth/login?reset=1');
      }}
    />
  );
}
