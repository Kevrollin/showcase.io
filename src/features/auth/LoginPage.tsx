import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Field, FormError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { toast } from '@/components/ui/toaster';
import { usePageMeta } from '@/hooks/usePageMeta';
import { errorCode, toUserMessage } from '@/lib/utils/errors';
import { signInSchema, type SignInValues } from '@/lib/validation/schemas';
import { resendConfirmation, signIn } from '@/services/auth.service';
import { AuthLayout } from './AuthLayout';
import { GoogleSignIn } from './GoogleSignIn';

export function Component() {
  usePageMeta({ title: 'Sign in', noindex: true });
  const [params] = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: params.get('email') ?? '', password: '' },
  });

  async function onSubmit(values: SignInValues) {
    setFormError(null);
    setUnconfirmedEmail(null);
    try {
      await signIn(values.email, values.password);
      // GuestOnly redirects to ?next=… as soon as the session is stored.
    } catch (error) {
      if (errorCode(error) === 'email_not_confirmed') setUnconfirmedEmail(values.email);
      setFormError(toUserMessage(error));
    }
  }

  async function resend() {
    if (!unconfirmedEmail) return;
    setResending(true);
    try {
      await resendConfirmation(unconfirmedEmail);
      toast.success('Confirmation email sent. Check your inbox.');
    } catch (error) {
      toast.error(toUserMessage(error));
    } finally {
      setResending(false);
    }
  }

  const { errors, isSubmitting } = form.formState;
  const next = params.get('next');

  return (
    <AuthLayout
      title="Welcome back"
      description="Sign in to manage your storefront."
      footer={
        <>
          New here?{' '}
          <Link to={next ? `/signup?next=${encodeURIComponent(next)}` : '/signup'} className="font-medium text-foreground underline decoration-gold underline-offset-4">
            Create your free catalogue
          </Link>
        </>
      }
    >
      <GoogleSignIn next={params.get('next') ?? '/dashboard'} />
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormError message={formError} />
        {unconfirmedEmail && (
          <Button type="button" variant="secondary" className="w-full" loading={resending} onClick={resend}>
            Resend confirmation email
          </Button>
        )}
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" inputMode="email" autoFocus {...form.register('email')} />
        </Field>
        <Field
          label={
            <span className="flex w-full items-baseline justify-between">
              Password
              <Link to="/forgot-password" className="text-[0.8125rem] font-normal text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                Forgot password?
              </Link>
            </span>
          }
          error={errors.password?.message}
        >
          <PasswordInput autoComplete="current-password" {...form.register('password')} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
