'use client';

import { useState } from 'react';

import { Button } from '@packages/ui/components/button';
import { Field, FieldError, FieldLabel } from '@packages/ui/components/field';
import { Input } from '@packages/ui/components/input';
import { ArrowLeft, Send } from 'lucide-react';
import { AuthCard } from './auth-card';
import { FormBanner } from './form-banner';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FormForgotPasswordProps = {
  onSubmit?: (email: string) => void | Promise<void>;
  isPending?: boolean;
  /** Pesan informasi netral (mis. "fitur belum tersedia"). */
  notice?: React.ReactNode;
  /** Nonaktifkan aksi kirim (backend belum ada) — tombol jadi disabled. */
  disabled?: boolean;
  backHref?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
};

export function FormForgotPassword({
  onSubmit,
  isPending = false,
  notice,
  disabled = false,
  backHref = '/auth/login',
  title = 'Forgot your password?',
  description = "Enter your email and we'll send you a reset link.",
  footer,
}: FormForgotPasswordProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    if (!emailPattern.test(email)) {
      setError('Enter a valid email address');
      return;
    }
    setError('');
    if (onSubmit) {
      await onSubmit(email);
      setSent(true);
    }
  }

  return (
    <AuthCard
      title={sent ? 'Check your inbox' : title}
      description={
        sent ? (
          <>
            If an account exists for <span className="font-medium text-foreground">{email}</span>,
            we&apos;ve sent a link to reset your password.
          </>
        ) : (
          description
        )
      }
      logo={
        sent ? (
          <span
            className="mx-auto flex size-11 items-center justify-center rounded-lg border border-border bg-muted/40"
            aria-hidden="true"
          >
            <Send className="size-5" />
          </span>
        ) : null
      }
      footer={
        footer ?? (
          <>
            <Button variant="link" size="sm" className="text-muted-foreground" asChild>
              <a href={backHref}>
                <ArrowLeft data-icon="inline-start" aria-hidden="true" />
                Back to sign in
              </a>
            </Button>
          </>
        )
      }
    >
      <FormBanner notice={notice} />
      {sent ? (
        <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
          Use a different email
        </Button>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              aria-invalid={!!error}
              onChange={(event) => {
                setEmail(event.target.value);
                if (error) setError('');
              }}
            />
            <FieldError>{error}</FieldError>
          </Field>
          <Button type="submit" className="mt-4 w-full" disabled={disabled || isPending}>
            {isPending ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
