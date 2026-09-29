'use client';

import { useState } from 'react';

import { AuthActionError, authErrorMessage } from '@packages/auth/next';
import { forgotPasswordAction } from '@packages/auth/next/server/actions';
import { FormForgotPassword } from '@packages/ui/auth/';

/**
 * Lupa password — memanggil `forgotPasswordAction` (server action).
 *
 * Respons selalu sukses (anti-enumerasi): kartu "Check your inbox" tampil
 * entah email dikenal atau tidak; hanya error server yang jadi `notice`.
 */
export default function ForgotPasswordPage() {
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <FormForgotPassword
      isPending={pending}
      notice={notice}
      onSubmit={async (email) => {
        setPending(true);
        setNotice(null);
        try {
          const result = await forgotPasswordAction(email);
          if (!result.ok) {
            throw new AuthActionError(result.message, {
              status: result.status,
              code: result.code,
            });
          }
        } catch (cause) {
          setNotice(authErrorMessage(cause, 'Tidak dapat mengirim tautan reset. Coba lagi nanti.'));
          throw cause;
        } finally {
          setPending(false);
        }
      }}
    />
  );
}
