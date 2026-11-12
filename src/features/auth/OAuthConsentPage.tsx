import { useQuery } from '@tanstack/react-query';
import { Check, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/field';
import { Spinner } from '@/components/ui/primitives';
import { BRAND } from '@/config/brand';
import { usePageMeta } from '@/hooks/usePageMeta';
import { toUserMessage } from '@/lib/utils/errors';
import { signOut } from '@/services/auth.service';
import { decideAuthorization, describeScope, getAuthorizationRequest, isValidAuthorizationId } from '@/services/oauth.service';
import { initials } from '../storefront/presentation';
import { AuthLayout } from './AuthLayout';

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

/**
 * /oauth/consent — the OAuth 2.1 consent screen (Supabase "Authorization URL").
 * Guests are sent to sign in first (RequireAuth) and come back here.
 */
export function Component() {
  usePageMeta({ title: 'Allow access?', noindex: true });
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const authorizationId = params.get('authorization_id');
  const valid = isValidAuthorizationId(authorizationId);
  const [deciding, setDeciding] = useState<'approve' | 'deny' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const request = useQuery({
    queryKey: ['oauth-authorization', authorizationId],
    queryFn: async () => {
      const result = await getAuthorizationRequest(authorizationId!);
      // Already approved before: return to the app straight away.
      if (result.kind === 'redirect') window.location.assign(result.url);
      return result;
    },
    enabled: valid,
    retry: false,
    staleTime: Infinity,
  });

  async function decide(decision: 'approve' | 'deny') {
    if (!authorizationId) return;
    setDeciding(decision);
    setError(null);
    try {
      window.location.assign(await decideAuthorization(authorizationId, decision));
    } catch (e) {
      setError(toUserMessage(e, 'Your choice could not be saved. Please try again.'));
      setDeciding(null);
    }
  }

  async function switchAccount() {
    await signOut().catch(() => undefined);
    navigate(`/login?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`, { replace: true });
  }

  if (!valid || request.isError) {
    return (
      <AuthLayout title="This request can’t be completed">
        <div className="flex flex-col items-center text-center">
          <TriangleAlert className="size-10 text-warning" aria-hidden="true" />
          <p className="mt-4 text-[0.9375rem] text-muted-foreground">
            The authorisation request is missing, has expired or was already used. Go back to the app that sent you here and try again.
          </p>
          <Button asChild variant="secondary" className="mt-6 w-full">
            <Link to="/dashboard">Go to your dashboard</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (request.isPending || request.data.kind === 'redirect') {
    return (
      <AuthLayout title="Just a moment">
        <div className="flex items-center gap-3 text-muted-foreground" role="status">
          <Spinner /> {request.data?.kind === 'redirect' ? 'Returning you to the app…' : 'Loading the request…'}
        </div>
      </AuthLayout>
    );
  }

  const r = request.data;
  const returnHost = hostOf(r.redirectUri);

  return (
    <AuthLayout title="Allow access?">
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary font-display text-base font-bold text-white" aria-hidden="true">
            {initials(r.clientName)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{r.clientName}</p>
            {r.clientUri && <p className="truncate text-sm text-muted-foreground">{hostOf(r.clientUri)}</p>}
          </div>
        </div>

        <p className="text-[0.9375rem] leading-relaxed">
          <strong>{r.clientName}</strong> wants to access your {BRAND.name} account
          <span className="text-muted-foreground"> ({r.userEmail})</span>. It will be able to:
        </p>

        <ul className="space-y-2 rounded-lg border border-border bg-surface-muted p-4">
          {(r.scopes.length > 0 ? r.scopes : ['openid']).map((scope) => (
            <li key={scope} className="flex items-start gap-2.5 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
              {describeScope(scope)}
            </li>
          ))}
        </ul>

        <p className="flex items-start gap-2 text-[0.8125rem] leading-snug text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Only allow apps you trust. {returnHost ? `You'll be sent back to ${returnHost}. ` : ''}You can remove access any time in Settings → Connected apps.
        </p>

        <FormError message={error} />

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="secondary" size="lg" className="flex-1" onClick={() => void decide('deny')} loading={deciding === 'deny'} disabled={deciding !== null}>
            Deny
          </Button>
          <Button size="lg" className="flex-1" onClick={() => void decide('approve')} loading={deciding === 'approve'} disabled={deciding !== null}>
            Allow
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Not {r.userEmail}?{' '}
          <button type="button" onClick={() => void switchAccount()} className="font-medium text-foreground underline underline-offset-4">
            Use another account
          </button>
        </p>
      </div>
    </AuthLayout>
  );
}
