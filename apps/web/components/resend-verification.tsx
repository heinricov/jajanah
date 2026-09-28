'use client';

import { useState } from 'react';

import { resendVerificationAction } from '@packages/auth/next/server/actions';
import { Button } from '@packages/ui/components/button';

/** Tombol kirim ulang email konfirmasi (halaman verifikasi / cek-email). */
export function ResendVerification({ email }: { email?: string }) {
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recipient = email?.trim() ?? '';
  if (recipient === '') return null;

  async function handleResend() {
    setPending(true);
    setNotice(null);
    setError(null);
    try {
      const result = await resendVerificationAction(recipient);
      if (result.ok) {
        setNotice('Tautan konfirmasi baru telah dikirim. Periksa juga folder spam Anda.');
      } else {
        setError(result.message);
      }
    } catch {
      setError('Tidak dapat mengirim email. Coba lagi nanti.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        disabled={pending}
        onClick={handleResend}
      >
        {pending ? 'Mengirim…' : 'Kirim ulang email konfirmasi'}
      </Button>
      {notice !== null ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
      {error !== null ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
