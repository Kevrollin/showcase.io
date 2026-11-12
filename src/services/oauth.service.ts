/**
 * Supabase Auth as an OAuth 2.1 provider (Authentication → OAuth Server).
 * Third-party apps send the user to /oauth/consent?authorization_id=… where
 * they approve or deny access to their Showcase account.
 */
import { supabase } from '@/lib/supabase/client';
import { AppError } from '@/lib/utils/errors';

export type AuthorizationRequest =
  | {
      kind: 'consent';
      id: string;
      clientName: string;
      clientUri: string | null;
      /** Where the user returns after deciding (registered by the app, without query). */
      redirectUri: string;
      scopes: string[];
      userEmail: string;
    }
  /** Already approved earlier for these scopes: go straight back to the app. */
  | { kind: 'redirect'; url: string };

const AUTHORIZATION_ID = /^[A-Za-z0-9_-]{8,200}$/;

export function isValidAuthorizationId(value: string | null): value is string {
  return Boolean(value && AUTHORIZATION_ID.test(value));
}

/** Only follow http(s) or app-scheme redirects returned by Supabase; never javascript:/data:. */
export function safeClientRedirect(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new AppError('The app returned an invalid address.', 'invalid_redirect');
  }
  if (['javascript:', 'data:', 'vbscript:', 'blob:', 'file:'].includes(parsed.protocol)) {
    throw new AppError('The app returned an unsafe address.', 'invalid_redirect');
  }
  return parsed.toString();
}

export async function getAuthorizationRequest(authorizationId: string): Promise<AuthorizationRequest> {
  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error) throw error;
  if ('redirect_url' in data) return { kind: 'redirect', url: safeClientRedirect(data.redirect_url) };
  return {
    kind: 'consent',
    id: data.authorization_id,
    clientName: data.client.name || 'An app',
    clientUri: data.client.uri || null,
    redirectUri: data.redirect_uri,
    scopes: data.scope.split(/\s+/).filter(Boolean),
    userEmail: data.user.email,
  };
}

/** Records the decision and returns the URL to send the user back to the app. */
export async function decideAuthorization(authorizationId: string, decision: 'approve' | 'deny'): Promise<string> {
  const { data, error } =
    decision === 'approve'
      ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
      : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
  if (error) throw error;
  return safeClientRedirect(data.redirect_url);
}

export interface ConnectedApp {
  clientId: string;
  name: string;
  uri: string | null;
  scopes: string[];
  grantedAt: string;
}

/** Apps the user has authorised. Returns [] when the OAuth server is disabled. */
export async function listConnectedApps(): Promise<ConnectedApp[]> {
  const { data, error } = await supabase.auth.oauth.listGrants();
  if (error) return [];
  return data.map((grant) => ({
    clientId: grant.client.id,
    name: grant.client.name || 'Unnamed app',
    uri: grant.client.uri || null,
    scopes: grant.scopes,
    grantedAt: grant.granted_at,
  }));
}

export async function revokeConnectedApp(clientId: string): Promise<void> {
  const { error } = await supabase.auth.oauth.revokeGrant({ clientId });
  if (error) throw error;
}

/** Plain-language descriptions of OAuth scopes. */
export function describeScope(scope: string): string {
  switch (scope) {
    case 'openid':
      return 'Confirm who you are';
    case 'email':
      return 'See your email address';
    case 'profile':
      return 'See your name and profile details';
    case 'phone':
      return 'See your phone number';
    default:
      return `Access: ${scope}`;
  }
}
