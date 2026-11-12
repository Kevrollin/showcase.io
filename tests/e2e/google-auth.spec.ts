import { expect, test, type Page } from '@playwright/test';
import { MOCK, STORE } from './fixtures';
import { signIn, trackErrors } from './helpers';

/**
 * "Continue with Google" against the mock Supabase in scripts/serve.ts: the mock
 * /auth/v1/authorize skips Google and returns straight to /auth/callback with a
 * code, so these tests cover our side of the flow (PKCE exchange, redirects,
 * errors, safeguards). A real Google sign-in still has to be tried by hand.
 */

const AUTHORIZE = '**/auth/v1/authorize?**';

async function continueWithGoogle(page: Page) {
  const authorize = page.waitForRequest((request) => request.url().includes('/auth/v1/authorize'));
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  return new URL((await authorize).url());
}

test.describe('Google sign-in', () => {
  test('login offers Google and asks only for basic sign-in', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/login');
    await expect(page.getByText('or use your email')).toBeVisible();

    const authorize = await continueWithGoogle(page);
    expect(authorize.searchParams.get('provider')).toBe('google');
    expect(authorize.searchParams.get('redirect_to')).toBe(new URL('/auth/callback', page.url()).toString());
    expect(authorize.searchParams.get('code_challenge_method')).toBe('s256');
    expect(authorize.searchParams.get('code_challenge')).toBeTruthy();
    expect(authorize.searchParams.get('prompt')).toBe('select_account');
    // No extra Google API scopes (Gmail, Drive, Contacts…): Supabase's default "email profile" only.
    expect(authorize.searchParams.get('scopes')).toBeNull();

    await page.waitForURL('/dashboard');
    await expect(page.getByRole('heading', { level: 1, name: STORE.name })).toBeVisible();
    // The ?code=… is cleared from the address bar after the exchange.
    expect(page.url()).not.toContain('code=');
    expect(errors).toEqual([]);
  });

  test('returns to the page the user was trying to open', async ({ page }) => {
    await page.goto('/dashboard/catalogue');
    await expect(page).toHaveURL(/\/login\?next=/);
    await continueWithGoogle(page);
    await page.waitForURL('/dashboard/catalogue');
    await expect(page.getByRole('heading', { level: 1, name: 'My products' })).toBeVisible();
  });

  test('sign up offers Google too', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await expect(page.getByText('or sign up with email')).toBeVisible();
    // Email sign-up is still available.
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
  });

  test('cancelling on Google explains what happened', async ({ page }) => {
    await page.route(AUTHORIZE, (route) =>
      route.fulfill({
        status: 302,
        headers: { Location: new URL('/auth/callback?error=access_denied&error_description=The+user+denied+the+request', page.url()).toString() },
      }),
    );
    await page.goto('/login');
    await continueWithGoogle(page);
    await expect(page.getByRole('heading', { name: 'Google sign-in was cancelled' })).toBeVisible();
    await page.getByRole('link', { name: 'Back to sign in' }).click();
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });

  test('a code from another browser is rejected safely', async ({ page }) => {
    await page.route(AUTHORIZE, (route) =>
      route.fulfill({ status: 302, headers: { Location: new URL('/auth/callback?code=stolen-code', page.url()).toString() } }),
    );
    await page.goto('/login');
    await continueWithGoogle(page);
    await expect(page.getByText(/start Google sign-in again/)).toBeVisible();
    await expect(page).not.toHaveURL(/\/dashboard/);
  });

  test('tells the owner when Google was linked to an existing email account', async ({ page }) => {
    await page.route('**/rest/v1/rpc/secure_linked_sign_in', (route) => route.fulfill({ json: true }));
    await page.goto('/login');
    await continueWithGoogle(page);
    await page.waitForURL('/dashboard');
    await expect(page.getByText('Your account is now linked to Google.')).toBeVisible();
    await expect(page.getByText(/your old password was switched off/)).toBeVisible();
  });

  test('settings show Google as the sign-in method and allow deleting with a fresh Google sign-in', async ({ page }) => {
    await page.goto('/login?next=/dashboard/settings');
    await continueWithGoogle(page);
    await page.waitForURL('/dashboard/settings');

    const main = page.getByRole('main');
    await expect(main.getByText('Sign-in methods')).toBeVisible();
    await expect(main.getByRole('listitem').filter({ hasText: 'Google' })).toBeVisible();
    await expect(main.getByText('Set or change password')).toBeVisible();

    await main.getByRole('button', { name: 'Delete account' }).click();
    const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog'));
    await expect(dialog.getByText('You confirmed it is you with Google.')).toBeVisible();
    await expect(dialog.getByLabel('Your password')).toHaveCount(0);
  });
});

test.describe('OAuth consent screen', () => {
  test('guests sign in first and come back to the request', async ({ page }) => {
    await page.goto('/oauth/consent?authorization_id=e2e-authorization-1');
    await expect(page).toHaveURL(/\/login\?next=/);
    await page.getByLabel('Email').fill(MOCK.ownerEmail);
    await page.getByLabel(/^Password/).fill(MOCK.ownerPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: 'Allow access?' })).toBeVisible();
  });

  test('shows who is asking and what they get, then approves', async ({ page }) => {
    await signIn(page, '/dashboard');
    await page.goto('/oauth/consent?authorization_id=e2e-authorization-1');
    await expect(page.getByRole('heading', { name: 'Allow access?' })).toBeVisible();
    await expect(page.getByText('Campus Deals wants to access your Showcase account', { exact: false })).toBeVisible();
    await expect(page.getByText('deals.example.com')).toBeVisible();
    await expect(page.getByText('Confirm who you are')).toBeVisible();
    await expect(page.getByText('See your email address')).toBeVisible();
    await expect(page.getByText(`(${MOCK.ownerEmail})`)).toBeVisible();

    await page.getByRole('button', { name: 'Allow' }).click();
    await page.waitForURL(/\/privacy\?code=e2e-oauth-code/);
  });

  test('deny sends the user back without access', async ({ page }) => {
    await signIn(page, '/dashboard');
    await page.goto('/oauth/consent?authorization_id=e2e-authorization-1');
    await page.getByRole('button', { name: 'Deny' }).click();
    await page.waitForURL(/\/privacy\?error=access_denied/);
  });

  for (const query of ['', '?authorization_id=bad id!', '?authorization_id=expired-request-1']) {
    test(`invalid or expired requests are explained (${query || 'missing id'})`, async ({ page }) => {
      await signIn(page, '/dashboard');
      await page.goto(`/oauth/consent${query}`);
      await expect(page.getByRole('heading', { name: 'This request can’t be completed' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Allow' })).toHaveCount(0);
    });
  }

  test('connected apps can be removed in settings', async ({ page }) => {
    await signIn(page, '/dashboard/settings');
    const section = page.locator('#connected-apps');
    await expect(section.getByText('Campus Deals')).toBeVisible();
    await section.getByRole('button', { name: 'Remove access' }).click();
    await page.getByRole('alertdialog').or(page.getByRole('dialog')).getByRole('button', { name: 'Remove access' }).click();
    await expect(page.getByText('Campus Deals can no longer access your account.')).toBeVisible();
  });
});
