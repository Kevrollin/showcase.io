import { useQuery } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { GoogleIcon } from '@/components/shared/BrandIcons';
import { toast } from '@/components/ui/toaster';
import { toUserMessage } from '@/lib/utils/errors';
import { fetchEnabledProviders, signInWithGoogle } from '@/services/auth.service';

/**
 * "Continue with Google" + an "or" divider, shown only when Google is enabled
 * on the Supabase project (never a button that leads to an error page).
 * Styled after Google's sign-in branding guidelines (light theme).
 */
export function GoogleSignIn({ next, dividerLabel = 'or use your email' }: { next: string; dividerLabel?: string }) {
  const providers = useQuery({ queryKey: ['auth-providers'], queryFn: fetchEnabledProviders, staleTime: 10 * 60_000, retry: false });
  const [redirecting, setRedirecting] = useState(false);

  if (providers.isPending) {
    return <div className="skeleton mb-5 h-12 w-full rounded-md" aria-hidden="true" />;
  }
  if (!providers.data?.google) return null;

  async function start() {
    setRedirecting(true);
    try {
      await signInWithGoogle(next);
      // The browser is now navigating to Google; keep the loading state.
    } catch (error) {
      setRedirecting(false);
      toast.error(toUserMessage(error, 'Google sign-in could not be started. Please try again.'));
    }
  }

  return (
    <div className="mb-5 space-y-5">
      <button
        type="button"
        onClick={() => void start()}
        disabled={redirecting}
        aria-busy={redirecting || undefined}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-md border border-[#747775] bg-white px-4 text-[0.9375rem] font-medium text-[#1f1f1f] shadow-xs transition-colors hover:bg-[#f8f9fa] disabled:cursor-wait disabled:opacity-70"
      >
        {redirecting ? <LoaderCircle className="size-5 animate-spin text-[#5f6368]" aria-hidden="true" /> : <GoogleIcon className="size-5" />}
        {redirecting ? 'Opening Google…' : 'Continue with Google'}
      </button>
      <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-subtle-foreground">
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
        <span>{dividerLabel}</span>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>
    </div>
  );
}
