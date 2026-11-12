import { expect, type Page } from '@playwright/test';
import { MOCK } from './fixtures';

/** Fails if the page can be scrolled sideways (a common mobile layout bug). */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'page should not scroll horizontally').toBeLessThanOrEqual(1);
}

export async function signIn(page: Page, next = '/dashboard'): Promise<void> {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Email').fill(MOCK.ownerEmail);
  await page.getByLabel(/^Password/).fill(MOCK.ownerPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => url.pathname === next);
}

/** Collects uncaught page errors and console errors for "no critical console errors" checks. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}
