import type { EmailOtpType, Session, User } from '@supabase/supabase-js';
import { absoluteUrl, safeRedirect } from '@/config/site';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase/client';
import { AppError } from '@/lib/utils/errors';

export interface SignUpInput {
  fullName: string;
  email: string;
  password: string;
}

export type SignUpResult =
  | { status: 'signed_in'; session: Session }
  | { status: 'confirm_email'; email: string };

const CONFIRM_REDIRECT = '/auth/callback?type=signup&next=%2Fonboarding';
const RECOVERY_REDIRECT = '/auth/callback?type=recovery&next=%2Freset-password';

export async function signUp({ fullName, email, password }: SignUpInput): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { full_name: fullName.trim() },
      emailRedirectTo: absoluteUrl(CONFIRM_REDIRECT),
    },
  });
  if (error) throw error;
  // With email confirmation enabled, Supabase does not reveal existing accounts
  // as an error; it returns a user with no identities instead.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new AppError('An account with this email already exists. Try signing in instead.', 'user_already_exists');
  }
  if (data.session) return { status: 'signed_in', session: data.session };
  return { status: 'confirm_email', email: email.trim() };
}

export async function signIn(email: string, password: string): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  return data.session;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  // A missing/expired session still means the user is signed out locally.
  if (error && error.status !== 403 && error.code !== 'session_not_found') throw error;
}

export async function resendConfirmation(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
    options: { emailRedirectTo: absoluteUrl(CONFIRM_REDIRECT) },
  });
  if (error) throw error;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: absoluteUrl(RECOVERY_REDIRECT),
  });
  if (error) throw error;
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

/** Re-checks the password before destructive actions (account deletion). */
export async function verifyPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new AppError('That password is incorrect.', 'invalid_credentials', { cause: error });
}

const OTP_TYPES: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'];

export function parseOtpType(value: string | null): EmailOtpType | null {
  return value && (OTP_TYPES as string[]).includes(value) ? (value as EmailOtpType) : null;
}

/** token_hash links (recommended email templates — see DEPLOYMENT.md). */
export async function verifyEmailLink(tokenHash: string, type: EmailOtpType): Promise<Session | null> {
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) throw error;
  return data.session;
}

/** PKCE links (default Supabase templates): ?code=… */
export async function exchangeAuthCode(code: string): Promise<Session> {
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
  return data.session;
}

/** Implicit-flow links: #access_token=…&refresh_token=… */
export async function setSessionFromTokens(accessToken: string, refreshToken: string): Promise<Session> {
  const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  if (error) throw error;
  if (!data.session) throw new AppError('This link is no longer valid. Please request a new one.', 'otp_expired');
  return data.session;
}

// ─── Google sign-in (Supabase Auth OAuth, PKCE) ─────────────────────────────

const OAUTH_STATE_KEY = 'showcase:oauth';
/** A sign-in that takes longer than this is treated as abandoned. */
const OAUTH_STATE_MAX_AGE_MS = 15 * 60 * 1000;

export interface OAuthState {
  provider: 'google';
  /** Same-site path to open after signing in. */
  next: string;
  startedAt: number;
}

/**
 * Remembers where to go after the Google round trip. Kept in this tab's
 * sessionStorage rather than in the redirect URL, so the redirect URL stays an
 * exact match for the project's allow-list.
 */
function rememberOAuthState(state: OAuthState): void {
  try {
    window.sessionStorage.setItem(OAUTH_STATE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable: the user simply lands on the dashboard.
  }
}

/** Reads and clears the pending OAuth sign-in for this tab (null if none or stale). */
export function takeOAuthState(): OAuthState | null {
  try {
    const raw = window.sessionStorage.getItem(OAUTH_STATE_KEY);
    window.sessionStorage.removeItem(OAUTH_STATE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<OAuthState>;
    if (value.provider !== 'google' || typeof value.startedAt !== 'number') return null;
    if (Date.now() - value.startedAt > OAUTH_STATE_MAX_AGE_MS) return null;
    return { provider: 'google', next: safeRedirect(value.next, '/dashboard'), startedAt: value.startedAt };
  } catch {
    return null;
  }
}

/** Which optional sign-in providers the project has enabled (public settings endpoint). */
export async function fetchEnabledProviders(): Promise<{ google: boolean }> {
  if (!env.supabaseUrl || !env.supabaseAnonKey) return { google: false };
  const response = await fetch(`${env.supabaseUrl}/auth/v1/settings`, { headers: { apikey: env.supabaseAnonKey } });
  if (!response.ok) throw new AppError('Sign-in options could not be loaded.', 'settings_unavailable');
  const settings = (await response.json()) as { external?: Record<string, unknown> };
  return { google: settings.external?.google === true };
}

/**
 * Starts "Continue with Google". Requests only Supabase's default Google scopes
 * (email + profile). The browser leaves for Google and comes back to
 * /auth/callback on the SAME origin, where the PKCE code verifier is stored.
 */
export async function signInWithGoogle(next: string): Promise<void> {
  rememberOAuthState({ provider: 'google', next: safeRedirect(next, '/dashboard'), startedAt: Date.now() });
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      // Let people pick which Google account to use instead of silently reusing one.
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) {
    takeOAuthState();
    throw error;
  }
}

/**
 * Called right after an OAuth sign-in. If Google was just linked to an account
 * whose password was set before (and never verified, as email confirmation is
 * off), the database removes that password and ends other sessions.
 * Returns true when that happened. See migration 20261112100000.
 */
export async function secureLinkedSignIn(): Promise<boolean> {
  const { data, error } = await supabase.rpc('secure_linked_sign_in');
  if (error) throw error;
  return data === true;
}

export interface SignInMethods {
  email: boolean;
  google: boolean;
}

export function signInMethods(user: User | null): SignInMethods {
  const providers = new Set<string>([
    ...(user?.identities ?? []).map((identity) => identity.provider),
    ...(Array.isArray(user?.app_metadata.providers) ? (user.app_metadata.providers as string[]) : []),
  ]);
  return { email: providers.has('email'), google: providers.has('google') };
}

/** True when the user signed in within the last `minutes` (for sensitive actions). */
export function signedInRecently(user: User | null, minutes = 10): boolean {
  const last = user?.last_sign_in_at ? Date.parse(user.last_sign_in_at) : NaN;
  return Number.isFinite(last) && Date.now() - last < minutes * 60 * 1000;
}
