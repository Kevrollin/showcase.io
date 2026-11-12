import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Field, FormError } from '@/components/ui/field';
import { PasswordInput } from '@/components/ui/password-input';
import { PageLoader } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toaster';
import { usePageMeta } from '@/hooks/usePageMeta';
import { toUserMessage } from '@/lib/utils/errors';
import { resetPasswordSchema, type ResetPasswordValues } from '@/lib/validation/schemas';
import { updatePassword } from '@/services/auth.service';
import { useAuth } from './auth-context';
import { AuthLayout } from './AuthLayout';

export function Component() {
  usePageMeta({ title: 'Choose a new password', noindex: true });
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: '', confirm: '' } });

  if (loading) return <PageLoader />;

  if (!session) {
    return (
      <AuthLayout title="Reset link expired" description="For your security, password reset links only work once and expire after a short time.">
        <Button asChild size="lg" className="w-full">
          <Link to="/forgot-password">Request a new link</Link>
        </Button>
      </AuthLayout>
    );
  }

  async function onSubmit(values: ResetPasswordValues) {
    setFormError(null);
    try {
      await updatePassword(values.password);
      toast.success('Your password has been updated.');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setFormError(toUserMessage(error));
    }
  }

  const { errors, isSubmitting } = form.formState;
  return (
    <AuthLayout title="Choose a new password" description={`For ${session.user.email ?? 'your account'}`}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormError message={formError} />
        <Field label="New password" hint="At least 8 characters, with letters and numbers." error={errors.password?.message}>
          <PasswordInput autoComplete="new-password" autoFocus {...form.register('password')} />
        </Field>
        <Field label="Confirm new password" error={errors.confirm?.message}>
          <PasswordInput autoComplete="new-password" {...form.register('confirm')} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
}
