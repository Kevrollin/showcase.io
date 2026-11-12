import { CircleCheck, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toaster';
import { safeRedirect } from '@/config/site';
import { usePageMeta } from '@/hooks/usePageMeta';
import { supabase } from '@/lib/supabase/client';
import { errorCode, toUserMessage } from '@/lib/utils/errors';
import {
  exchangeAuthCode,
  parseOtpType,
  secureLinkedSignIn,
  setSessionFromTokens,
  takeOAuthState,
  verifyEmailLink,
} from '@/services/auth.service';
import { AuthLayout } from './AuthLayout';
import { describeOAuthError } from './oauthErrors';

type Status =
  | { kind: 'working' }
  | { kind: 'error'; title: string; message: string; action: 'login' | 'recovery' }
  /** Email was confirmed on another device/browser: ask the user to sign in. */
  | { kind: 'confirmed-elsewhere' };

/**
 * Landing page for sign-in redirects. Handles, in order:
 *   · Google sign-in (OAuth + PKCE): ?code=… or ?error=… with a pending OAuth state
 *   · ?token_hash=…&type=…   (recommended email templates, works across devices)
 *   · ?code=…                (PKCE redirect from the default email templates)
 *   · #access_token=…        (implicit-flow redirect)
 *   · ?error_code=… / #error_code=…  (expired or invalid email links)
 */
export function Component() {
  usePageMeta({ title: 'Signing you in', noindex: true });
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>({ kind: 'working' });
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return; // React StrictMode runs effects twice in dev.
    handled.current = true;

    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const get = (key: string) => query.get(key) ?? hash.get(key);

    const oauth = takeOAuthState();
    const type = parseOtpType(get('type'));
    const isRecovery = type === 'recovery';
    const next = oauth?.next ?? (isRecovery ? '/reset-password' : safeRedirect(query.get('next'), '/onboarding'));
    const clearAddressBar = () => window.history.replaceState(null, '', window.location.pathname);

    async function run() {
      const linkError = get('error_code') ?? get('error');
      if (linkError) {
        clearAddressBar();
        // Only a Google sign-in started in this tab gets Google wording; expired
        // email links also arrive with error=access_denied.
        if (oauth) {
          setStatus({ kind: 'error', ...describeOAuthError(get('error'), get('error_description')), action: 'login' });
        } else {
          setStatus({
            kind: 'error',
            title: "This link didn't work",
            message: toUserMessage({ code: get('error_code') ?? 'otp_expired' }),
            action: isRecovery ? 'recovery' : 'login',
          });
        }
        return;
      }
      try {
        const tokenHash = query.get('token_hash');
        const code = query.get('code');
        const accessToken = hash.get('access_token');
        const refreshToken = hash.get('refresh_token');

        if (tokenHash && type) {
          await verifyEmailLink(tokenHash, type);
        } else if (code) {
          await exchangeAuthCode(code);
        } else if (accessToken && refreshToken) {
          await setSessionFromTokens(accessToken, refreshToken);
        } else {
          const { data } = await supabase.auth.getSession();
          if (!data.session) throw Object.assign(new Error('missing token'), { code: 'flow_state_not_found' });
        }
        clearAddressBar();

        if (oauth) {
          // If Google was just linked to an existing email/password account,
          // the database removes that (unverified) password and other sessions.
          try {
            if (await secureLinkedSignIn()) {
              toast.info('Your account is now linked to Google.', {
                description: 'For your security, your old password was switched off. Sign in with Google, or set a new password in Settings.',
                duration: 10_000,
              });
            }
          } catch {
            // Never block sign-in on this check; it is re-run on the next Google sign-in.
          }
        }
        navigate(next, { replace: true });
      } catch (error) {
        clearAddressBar();
        const code = errorCode(error);
        const verifierProblem = code === 'bad_code_verifier' || code === 'flow_state_not_found' || /code verifier/i.test(String(error));
        if (oauth) {
          setStatus({
            kind: 'error',
            title: "Google sign-in didn't finish",
            message: verifierProblem
              ? 'Please start Google sign-in again from this browser tab.'
              : toUserMessage(error, 'Something went wrong while signing in with Google. Please try again.'),
            action: 'login',
          });
          return;
        }
        // PKCE email links opened in another browser: Supabase has already
        // confirmed the email, only the session hand-off failed.
        if (!isRecovery && verifierProblem) {
          setStatus({ kind: 'confirmed-elsewhere' });
          return;
        }
        setStatus({ kind: 'error', title: "This link didn't work", message: toUserMessage(error), action: isRecovery ? 'recovery' : 'login' });
      }
    }

    void run();
  }, [navigate]);

  if (status.kind === 'working') {
    return (
      <AuthLayout title="Just a moment">
        <div className="flex items-center gap-3 text-muted-foreground" role="status">
          <Spinner /> Signing you in…
        </div>
      </AuthLayout>
    );
  }

  if (status.kind === 'confirmed-elsewhere') {
    return (
      <AuthLayout title="Email confirmed">
        <div className="flex flex-col items-center text-center">
          <CircleCheck className="size-10 text-success" aria-hidden="true" />
          <p className="mt-4 text-[0.9375rem] text-muted-foreground">Your email address is confirmed. Sign in to continue setting up your storefront.</p>
          <Button asChild size="lg" className="mt-6 w-full">
            <Link to="/login?next=%2Fonboarding">Sign in</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={status.title}>
      <div className="flex flex-col items-center text-center">
        <TriangleAlert className="size-10 text-warning" aria-hidden="true" />
        <p className="mt-4 text-[0.9375rem] text-muted-foreground">{status.message}</p>
        <div className="mt-6 flex w-full flex-col gap-2">
          {status.action === 'recovery' ? (
            <Button asChild size="lg">
              <Link to="/forgot-password">Request a new reset link</Link>
            </Button>
          ) : (
            <Button asChild size="lg">
              <Link to="/login">Back to sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </AuthLayout>
  );
}
