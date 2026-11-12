import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Field, FormError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { toast } from '@/components/ui/toaster';
import { usePageMeta } from '@/hooks/usePageMeta';
import { toUserMessage } from '@/lib/utils/errors';
import { signUpSchema, type SignUpValues } from '@/lib/validation/schemas';
import { resendConfirmation, signUp } from '@/services/auth.service';
import { AuthLayout } from './AuthLayout';
import { GoogleSignIn } from './GoogleSignIn';

const RESEND_COOLDOWN_SECONDS = 60;

function CheckInbox({ email, onRestart }: { email: string; onRestart: () => void }) {
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function resend() {
    setSending(true);
    try {
      await resendConfirmation(email);
      toast.success('We sent you a new confirmation email.');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      toast.error(toUserMessage(error));
    } finally {
      setSending(false);
    }
  }

  return (
    <AuthLayout title="Check your inbox" footer={<Link to="/login" className="underline underline-offset-4">Back to sign in</Link>}>
      <div className="flex flex-col items-center text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-sage-soft text-sage">
          <MailCheck className="size-6" aria-hidden="true" />
        </div>
        <p className="mt-4 text-[0.9375rem] text-muted-foreground">
          We sent a confirmation link to <strong className="text-foreground">{email}</strong>. Open it on this device to
          activate your account and set up your storefront.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">Can&apos;t find it? Check your spam or promotions folder.</p>
        <div className="mt-6 flex w-full flex-col gap-2">
          <Button variant="secondary" onClick={resend} loading={sending} disabled={cooldown > 0}>
            {cooldown > 0 ? `Resend email in ${cooldown}s` : 'Resend email'}
          </Button>
          <Button variant="ghost" onClick={onRestart}>
            Use a different email
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}

export function Component() {
  usePageMeta({ title: 'Create your free catalogue', noindex: true });
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: '', email: '', password: '' },
  });

  async function onSubmit(values: SignUpValues) {
    setFormError(null);
    try {
      const result = await signUp(values);
      if (result.status === 'confirm_email') setSentTo(result.email);
      else navigate('/onboarding', { replace: true });
    } catch (error) {
      setFormError(toUserMessage(error));
    }
  }

  if (sentTo) return <CheckInbox email={sentTo} onRestart={() => setSentTo(null)} />;

  const { errors, isSubmitting } = form.formState;

  return (
    <AuthLayout
      title="Create your free catalogue"
      description="Set up your storefront in a few minutes. No website skills needed."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-foreground underline decoration-gold underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <GoogleSignIn next="/dashboard" dividerLabel="or sign up with email" />
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormError message={formError} />
        <Field label="Your name" error={errors.fullName?.message}>
          <Input autoComplete="name" autoFocus {...form.register('fullName')} />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" inputMode="email" {...form.register('email')} />
        </Field>
        <Field label="Password" hint="At least 8 characters, with letters and numbers." error={errors.password?.message}>
          <PasswordInput autoComplete="new-password" {...form.register('password')} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Create account
        </Button>
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          By creating an account you agree to our{' '}
          <Link to="/terms" className="underline underline-offset-2">Terms</Link> and{' '}
          <Link to="/privacy" className="underline underline-offset-2">Privacy Policy</Link>.
        </p>
      </form>
    </AuthLayout>
  );
}
