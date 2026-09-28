'use client';

import { useState } from 'react';

import { Button } from '@packages/ui/components/button';
import { Checkbox } from '@packages/ui/components/checkbox';
import { Field, FieldError, FieldGroup, FieldLabel } from '@packages/ui/components/field';
import { Input } from '@packages/ui/components/input';
import { AuthCard } from './auth-card';
import { FormBanner } from './form-banner';
import { PasswordInput } from './password-input';
import { SocialAuth, type SocialProvider } from './social-buttons';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RegisterValues = {
  name: string;
  email: string;
  password: string;
  terms: boolean;
};

export type FormRegisterProps = {
  onSubmit?: (values: RegisterValues) => void | Promise<void>;
  onSocialSubmit?: (provider: SocialProvider) => void;
  isPending?: boolean;
  /** Pesan gagal dari API (dinormalisasi oleh `authErrorMessage`). */
  error?: React.ReactNode;
  /** Sembunyikan blok sosial (tombol Google). */
  showSocial?: boolean;
  loginHref?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Logo di atas judul — default `AppLogo` (dari `AuthCard`). */
  logo?: React.ReactNode;
  /** `undefined` = footer default (link Sign in); `null` = sembunyikan footer. */
  footer?: React.ReactNode;
};

export function FormRegister({
  onSubmit,
  onSocialSubmit,
  isPending = false,
  error,
  showSocial = true,
  loginHref = '/auth/login',
  title = 'Create your account',
  description = 'Start building with Acme. No credit card required.',
  logo,
  footer,
}: FormRegisterProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    const next: Record<string, string> = {};
    if (!data.name?.trim()) next.name = 'Enter your name';
    if (!emailPattern.test(data.email ?? '')) next.email = 'Enter a valid email address';
    if ((data.password ?? '').length < 8) next.password = 'Use at least 8 characters';
    if (!data.terms) next.terms = 'Please accept the terms to continue';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    await onSubmit?.({
      name: data.name!.trim(),
      email: data.email!,
      password: data.password!,
      terms: true,
    });
  }

  function clearError(name: string) {
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  return (
    <AuthCard
      title={title}
      description={description}
      logo={logo}
      footer={
        footer === undefined ? (
          <>
            Already have an account?
            <Button variant="link" className="px-1" asChild>
              <a href={loginHref}>Sign in</a>
            </Button>
          </>
        ) : (
          footer
        )
      }
    >
      <FormBanner error={error} />
      <form onSubmit={handleSubmit} noValidate>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="name">Full name</FieldLabel>
            <Input
              id="name"
              name="name"
              placeholder="Ada Lovelace"
              aria-invalid={!!errors.name}
              onChange={() => clearError('name')}
            />
            <FieldError>{errors.name}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              aria-invalid={!!errors.email}
              onChange={() => clearError('email')}
            />
            <FieldError>{errors.email}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <PasswordInput
              id="password"
              name="password"
              placeholder="••••••••"
              aria-invalid={!!errors.password}
              onChange={() => clearError('password')}
            />
            <FieldError>{errors.password}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="terms" className="font-normal text-muted-foreground">
              <Checkbox
                id="terms"
                name="terms"
                aria-invalid={!!errors.terms}
                onCheckedChange={() => clearError('terms')}
              />
              I agree to the Terms and Privacy Policy
            </FieldLabel>
            <FieldError>{errors.terms}</FieldError>
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={isPending}>
            {isPending ? 'Creating your account…' : 'Create account'}
          </Button>
        </FieldGroup>
      </form>

      {showSocial ? <SocialAuth onSocialSubmit={onSocialSubmit} label="Or sign up with" /> : null}
    </AuthCard>
  );
}
