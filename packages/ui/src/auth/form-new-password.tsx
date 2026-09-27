'use client';

import { useState } from 'react';

import { cn } from '@packages/ui/lib/utils';
import { Button } from '@packages/ui/components/button';
import { Field, FieldLabel } from '@packages/ui/components/field';
import { Input } from '@packages/ui/components/input';
import { Check, X } from 'lucide-react';
import { AuthCard } from './auth-card';
import { FormBanner } from './form-banner';

function Rule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      {ok ? (
        <Check className="size-3.5 text-foreground" aria-hidden="true" />
      ) : (
        <X className="size-3.5 text-muted-foreground/50" aria-hidden="true" />
      )}
      <span className={ok ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </li>
  );
}

export type FormNewPasswordProps = {
  onSubmit?: (values: { password: string }) => void | Promise<void>;
  isPending?: boolean;
  /** Pesan informasi netral (mis. "fitur belum tersedia"). */
  notice?: React.ReactNode;
  /** Nonaktifkan aksi simpan (backend reset belum ada). */
  disabled?: boolean;
  continueHref?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  doneTitle?: React.ReactNode;
  doneDescription?: React.ReactNode;
};

export function FormNewPassword({
  onSubmit,
  isPending = false,
  notice,
  disabled = false,
  continueHref = '/auth/login',
  title = 'Set a new password',
  description = "Choose a strong password you don't use anywhere else.",
  doneTitle = 'Password updated',
  doneDescription = 'Your password has been changed. You can sign in with it now.',
}: FormNewPasswordProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);

  const hasLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const matches = confirm.length > 0 && password === confirm;
  const valid = hasLength && hasNumber && hasUpper && matches;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || !valid) return;
    if (onSubmit) {
      await onSubmit({ password });
      setDone(true);
    }
  }

  return (
    <AuthCard title={done ? doneTitle : title} description={done ? doneDescription : description}>
      <FormBanner notice={notice} />
      {done ? (
        <Button className="w-full" asChild>
          <a href={continueHref}>Continue to sign in</a>
        </Button>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="password">New password</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="confirm">Confirm password</FieldLabel>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              placeholder="••••••••"
              value={confirm}
              aria-invalid={confirm.length > 0 && !matches}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </Field>
          <ul className="flex flex-col gap-1.5">
            <Rule ok={hasLength} label="At least 8 characters" />
            <Rule ok={hasUpper} label="One uppercase letter" />
            <Rule ok={hasNumber} label="One number" />
            <Rule ok={matches} label="Passwords match" />
          </ul>
          <Button
            type="submit"
            className={cn('w-full', !valid && 'opacity-60')}
            disabled={disabled || !valid || isPending}
          >
            {isPending ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
