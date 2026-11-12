import type { User } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { signedInRecently, signInMethods, takeOAuthState } from '@/services/auth.service';
import { describeScope, isValidAuthorizationId, safeClientRedirect } from '@/services/oauth.service';
import { describeOAuthError } from './oauthErrors';

const KEY = 'showcase:oauth';

function user(partial: Partial<User>): User {
  return { id: 'u1', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-11-01T00:00:00Z', ...partial } as User;
}

describe('takeOAuthState', () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.useRealTimers();
  });

  it('returns the pending Google sign-in once, then clears it', () => {
    sessionStorage.setItem(KEY, JSON.stringify({ provider: 'google', next: '/dashboard/catalogue', startedAt: Date.now() }));
    expect(takeOAuthState()).toMatchObject({ provider: 'google', next: '/dashboard/catalogue' });
    expect(takeOAuthState()).toBeNull();
  });

  it('never redirects off-site', () => {
    for (const next of ['https://evil.example/', '//evil.example', '/\\evil.example', 'javascript:alert(1)']) {
      sessionStorage.setItem(KEY, JSON.stringify({ provider: 'google', next, startedAt: Date.now() }));
      expect(takeOAuthState()?.next).toBe('/dashboard');
    }
  });

  it('ignores stale, unknown or corrupt state', () => {
    sessionStorage.setItem(KEY, JSON.stringify({ provider: 'google', next: '/dashboard', startedAt: Date.now() - 16 * 60_000 }));
    expect(takeOAuthState()).toBeNull();
    sessionStorage.setItem(KEY, JSON.stringify({ provider: 'github', next: '/dashboard', startedAt: Date.now() }));
    expect(takeOAuthState()).toBeNull();
    sessionStorage.setItem(KEY, '{not json');
    expect(takeOAuthState()).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });
});

describe('describeOAuthError', () => {
  it('explains a cancelled Google sign-in', () => {
    expect(describeOAuthError('access_denied', 'The user denied the request').title).toBe('Google sign-in was cancelled');
  });

  it('explains a missing email and a disabled provider', () => {
    expect(describeOAuthError('server_error', 'Error getting user email from external provider').message).toMatch(/email/i);
    expect(describeOAuthError('validation_failed', 'Unsupported provider: provider is not enabled').title).toBe('Google sign-in is unavailable');
  });

  it('falls back to a generic message without echoing raw provider text', () => {
    const result = describeOAuthError('server_error', '<script>alert(1)</script>');
    expect(result.title).toBe("Google sign-in didn't work");
    expect(result.message).not.toContain('<script>');
  });
});

describe('signInMethods', () => {
  it('reads identities and provider metadata', () => {
    expect(signInMethods(user({ identities: [{ provider: 'google' } as never] }))).toEqual({ email: false, google: true });
    expect(signInMethods(user({ app_metadata: { providers: ['email', 'google'] } }))).toEqual({ email: true, google: true });
    expect(signInMethods(null)).toEqual({ email: false, google: false });
  });
});

describe('signedInRecently', () => {
  it('is true only within the window', () => {
    const now = Date.now();
    expect(signedInRecently(user({ last_sign_in_at: new Date(now - 60_000).toISOString() }), 10)).toBe(true);
    expect(signedInRecently(user({ last_sign_in_at: new Date(now - 11 * 60_000).toISOString() }), 10)).toBe(false);
    expect(signedInRecently(user({}), 10)).toBe(false);
  });
});

describe('OAuth consent helpers', () => {
  it('accepts only well-formed authorization ids', () => {
    expect(isValidAuthorizationId('e2e-authorization-1')).toBe(true);
    expect(isValidAuthorizationId('3f1c2a8e_9b7d')).toBe(true);
    for (const bad of [null, '', 'short', 'has space here', '../../etc/passwd', 'a'.repeat(201)]) {
      expect(isValidAuthorizationId(bad)).toBe(false);
    }
  });

  it('follows only safe redirects', () => {
    expect(safeClientRedirect('https://app.example.com/callback?code=abc&state=x')).toBe('https://app.example.com/callback?code=abc&state=x');
    expect(safeClientRedirect('com.example.app://callback?code=abc')).toBe('com.example.app://callback?code=abc');
    for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'not a url', 'vbscript:x']) {
      expect(() => safeClientRedirect(bad)).toThrow();
    }
  });

  it('describes scopes in plain language', () => {
    expect(describeScope('openid')).toBe('Confirm who you are');
    expect(describeScope('email')).toBe('See your email address');
    expect(describeScope('custom:read')).toBe('Access: custom:read');
  });
});
