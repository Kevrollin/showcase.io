/**
 * Full journey against a real Supabase project (see playwright.real.config.ts):
 * sign up (or sign in as a disposable pre-confirmed user) → guided onboarding
 * with a real photo upload → publish → anonymous visitor sees the storefront →
 * owner hides an item → visitor no longer sees it → account deletion cleans
 * everything up (auth user, data and Storage objects).
 *
 * Projects with email confirmation ON (production): create a disposable user
 * with `npm run e2e:user` and pass E2E_USER_EMAIL / E2E_USER_PASSWORD.
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const run = Date.now().toString(36);
const presetUser = Boolean(process.env.E2E_USER_EMAIL && process.env.E2E_USER_PASSWORD);
const email = process.env.E2E_USER_EMAIL ?? `e2e-${run}@example.com`;
const password = process.env.E2E_USER_PASSWORD ?? `Passw0rd-${run}`;
const businessName = `E2E Shop ${run}`;

test('a new seller can create, publish and manage a storefront', async ({ page, browser }) => {
  if (presetUser) {
    // Disposable, already-confirmed user (works with email confirmation ON).
    await page.goto('/login?next=%2Fonboarding');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel(/^Password/).fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
  } else {
    // Sign up (the project must have email confirmation disabled).
    await page.goto('/signup');
    await page.getByLabel('Your name').fill('E2E Seller');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();
  }
  await page.waitForURL(/\/onboarding/);

  // 1. Type
  await page.getByRole('radio', { name: /^Products/ }).first().click();
  await page.getByRole('button', { name: 'Continue' }).click();
  // 2. Identity
  await page.getByLabel("What's your business called?").fill(businessName);
  await page.getByLabel(/Short description/).fill('Created by the end-to-end test.');
  await page.getByRole('button', { name: 'Continue' }).click();
  // 3. Contact
  await page.getByLabel('WhatsApp number').fill('0712 345 678');
  await page.getByRole('button', { name: 'Continue' }).click();
  // 4. Appearance
  await expect(page.getByRole('heading', { name: 'Make it look like you' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  // 5. First item, with a real image going through compression + Storage upload.
  await page.getByLabel('Product name').fill('Test Sneakers');
  await page.getByLabel('Amount').fill('1500');
  await page.locator('input[type="file"][multiple]').setInputFiles({
    name: 'sneakers.png',
    mimeType: 'image/png',
    buffer: readFileSync('public/favicon/icon-512.png'),
  });
  await expect(page.getByText('1/8 · first photo is the cover')).toBeVisible();
  await page.getByRole('button', { name: 'Save product' }).click();
  await expect(page.getByText('Test Sneakers')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  // 6. Publish
  await page.getByRole('button', { name: 'Publish storefront' }).click();
  await expect(page.getByRole('heading', { name: 'Your storefront is ready!' })).toBeVisible();
  const storefrontUrl = await page.getByRole('link', { name: /\/s\// }).first().getAttribute('href');
  expect(storefrontUrl).toBeTruthy();

  // An anonymous visitor sees the storefront and the product photo.
  const visitor = await browser.newPage();
  await visitor.goto(storefrontUrl!);
  await expect(visitor.getByRole('heading', { level: 1, name: businessName })).toBeVisible();
  await expect(visitor.getByRole('link', { name: /Test Sneakers, KES 1,500/ })).toBeVisible();
  await expect(visitor.locator('img[src*="/storage/v1/object/public/catalog-media/"]').first()).toBeVisible();

  // The owner hides the item; it disappears for visitors.
  await page.goto('/dashboard/catalogue');
  await page.getByRole('button', { name: 'Actions for Test Sneakers' }).click();
  await page.getByRole('menuitem', { name: 'Hide from storefront' }).click();
  await expect(page.getByText('Hidden from your storefront.')).toBeVisible();
  await visitor.reload();
  await expect(visitor.getByText('No products yet')).toBeVisible();

  // Clean up: delete the account (removes Storage objects, data and the auth user).
  await page.goto('/dashboard/settings#danger');
  await page.getByRole('button', { name: 'Delete account' }).click();
  const dialog = page.getByRole('alertdialog');
  await dialog.getByLabel('Your password').fill(password);
  await dialog.getByLabel('Type DELETE to confirm').fill('DELETE');
  await dialog.getByRole('button', { name: 'Delete my account' }).click();
  await page.waitForURL((url) => url.pathname === '/');

  await visitor.reload();
  await expect(visitor.getByRole('heading', { name: "This storefront isn't available" })).toBeVisible();
  await visitor.close();
});
