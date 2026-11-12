import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Field, FormError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { usePageMeta } from '@/hooks/usePageMeta';
import { toUserMessage } from '@/lib/utils/errors';
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/lib/validation/schemas';
import { requestPasswordReset } from '@/services/auth.service';
import { AuthLayout } from './AuthLayout';

export function Component() {
  usePageMeta({ title: 'Reset your password', noindex: true });
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });

  async function onSubmit(values: ForgotPasswordValues) {
    setFormError(null);
    try {
      await requestPasswordReset(values.email);
      setSentTo(values.email);
    } catch (error) {
      setFormError(toUserMessage(error));
    }
  }

  const footer = <Link to="/login" className="underline underline-offset-4">Back to sign in</Link>;

  if (sentTo) {
    return (
      <AuthLayout title="Check your email" footer={footer}>
        <div className="flex flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-sage-soft text-sage">
            <MailCheck className="size-6" aria-hidden="true" />
          </div>
          {/* Deliberately does not reveal whether the account exists. */}
          <p className="mt-4 text-[0.9375rem] text-muted-foreground">
            If an account exists for <strong className="text-foreground">{sentTo}</strong>, you&apos;ll receive a link to
            choose a new password. The link expires after a short time.
          </p>
          <Button variant="ghost" className="mt-6" onClick={() => setSentTo(null)}>
            Send to a different email
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Forgot your password?" description="Enter your email and we'll send you a link to reset it." footer={footer}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormError message={formError} />
        <Field label="Email" error={form.formState.errors.email?.message}>
          <Input type="email" autoComplete="email" inputMode="email" autoFocus {...form.register('email')} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  );
}
