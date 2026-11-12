/**
 * Captures screenshots of key screens for visual review (and marketing).
 * Requires the local server:  node scripts/build-e2e.ts && node scripts/serve.ts
 * (with MOCK_SUPABASE_PORT=54329). Output: screenshots/ (gitignored).
 *
 * Usage:  node scripts/screenshots.ts
 */
import { mkdirSync } from 'node:fs';
import { chromium, devices, type Page } from '@playwright/test';
import { MOCK } from '../tests/e2e/fixtures.ts';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4173';
const OUT = 'screenshots';
mkdirSync(OUT, { recursive: true });

async function shot(page: Page, name: string, fullPage = true) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  console.log('captured', name);
}

async function signIn(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Email').fill(MOCK.ownerEmail);
  await page.getByLabel(/^Password/).fill(MOCK.ownerPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');
}

const browser = await chromium.launch();
try {
  for (const [label, options] of [
    ['mobile', devices['Pixel 7']],
    ['desktop', { viewport: { width: 1440, height: 900 } }],
  ] as const) {
    const context = await browser.newContext(options);
    const page = await context.newPage();

    await page.goto(`${BASE}/`);
    await shot(page, `${label}-landing`);
    await page.goto(`${BASE}/s/campus-kicks`);
    await shot(page, `${label}-storefront`);
    await page.goto(`${BASE}/s/campus-kicks/nike-air-max-90`);
    await shot(page, `${label}-item`);
    await page.goto(`${BASE}/login`);
    await shot(page, `${label}-login`, false);

    await signIn(page);
    await shot(page, `${label}-dashboard`);
    await page.goto(`${BASE}/dashboard/catalogue`);
    await shot(page, `${label}-catalogue`);
    await page.goto(`${BASE}/dashboard/catalogue/new`);
    await shot(page, `${label}-item-new`);
    await page.goto(`${BASE}/dashboard/appearance`);
    await shot(page, `${label}-appearance`);
    await page.goto(`${BASE}/dashboard/share`);
    await shot(page, `${label}-share`);
    await page.goto(`${BASE}/dashboard/settings`);
    await shot(page, `${label}-settings`);

    // Onboarding for a brand-new account: pretend the user has no business yet.
    await page.route('**/rest/v1/businesses**', (route) =>
      route.request().method() === 'GET' ? route.fulfill({ json: [] }) : route.fallback(),
    );
    await page.goto(`${BASE}/onboarding`);
    await shot(page, `${label}-onboarding-1`);
    await page.getByRole('radio', { name: /products and services/i }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await shot(page, `${label}-onboarding-2`);
    await context.close();
  }
} finally {
  await browser.close();
}
