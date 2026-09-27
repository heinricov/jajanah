'use client';

import { useState } from 'react';
import { z } from 'zod';

import { Button } from '@packages/ui/components/button';
import { Checkbox } from '@packages/ui/components/checkbox';
import { Field, FieldError, FieldGroup, FieldLabel } from '@packages/ui/components/field';
import { Input } from '@packages/ui/components/input';
import { AppLogo } from '../apps/app-logo';
import { AuthCard } from './auth-card';

const signInSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type SignInValues = z.infer<typeof signInSchema>;

export type FormLoginProps = {
  onSubmit?: (values: SignInValues) => void | Promise<void>;
  isPending?: boolean;
  forgotPasswordHref?: string;
  registerHref?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  logo?: React.ReactNode;
  footer?: React.ReactNode;
};

export function FormLogin({
  onSubmit,
  isPending = false,
  forgotPasswordHref = '/auth/forgot-password',
  registerHref = '/auth/register',
  title = 'Sign In To Acme',
  description = 'Welcome back. Enter your details to continue.',
  logo = <AppLogo />,
  footer,
}: FormLoginProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const result = signInSchema.safeParse(data);
    if (!result.success) {
      const next: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string' && !next[key]) {
          next[key] = issue.message;
        }
      }
      setErrors(next);
      return;
    }
    setErrors({});
    await onSubmit?.(result.data);
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
        footer ?? (
          <>
            Don&apos;t have an account?
            <Button variant="link" className="px-1" asChild>
              <a href={registerHref}>Sign Up</a>
            </Button>
          </>
        )
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <FieldGroup>
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
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              aria-invalid={!!errors.password}
              onChange={() => clearError('password')}
            />
            <FieldError>{errors.password}</FieldError>
          </Field>
          <Field orientation="horizontal" className="justify-between">
            <FieldLabel htmlFor="remember" className="font-normal text-muted-foreground">
              <Checkbox id="remember" name="remember" />
              Remember me
            </FieldLabel>
            <Button variant="link" size="xs" className="h-auto p-0 text-xs" asChild>
              <a href={forgotPasswordHref}>Forgot Password?</a>
            </Button>
          </Field>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Signing in…' : 'Sign In'}
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
