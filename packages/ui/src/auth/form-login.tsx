'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@packages/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@packages/ui/components/card';
import { Checkbox } from '@packages/ui/components/checkbox';
import { Field, FieldError, FieldGroup, FieldLabel } from '@packages/ui/components/field';
import { Input } from '@packages/ui/components/input';
import { Separator } from '@packages/ui/components/separator';
import { Toaster } from '@packages/ui/components/sonner';
import { AppLogo } from '../apps/app-logo';

const signInSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export function FormLogin() {
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
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
    toast.promise(new Promise((resolve) => setTimeout(resolve, 1400)), {
      loading: 'Signing you in…',
      success: 'Welcome back to Acme!',
      error: 'Sign-in failed. Please try again.',
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
    <section className="flex w-full items-center justify-center bg-background px-6 py-12 text-foreground">
      <Toaster />
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <AppLogo />
          <CardTitle className="mt-4 text-xl font-bold tracking-tight">Sign In To Acme</CardTitle>
          <CardDescription className="text-sm">
            Welcome back. Enter your details to continue.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-6">
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
                <Button
                  variant="link"
                  size="xs"
                  className="h-auto p-0 text-xs"
                  render={<a href="/auth/forgot-password" />}
                  nativeButton={false}
                >
                  Forgot Password?
                </Button>
              </Field>
              <Button type="submit" className="w-full">
                Sign In
              </Button>
            </FieldGroup>
          </form>
        </CardContent>

        <CardFooter className="justify-center text-sm text-muted-foreground">
          Don&apos;t have an account?
          <Button
            variant="link"
            className="px-1"
            render={<a href="/auth/register" />}
            nativeButton={false}
          >
            Sign Up
          </Button>
        </CardFooter>
      </Card>
    </section>
  );
}
