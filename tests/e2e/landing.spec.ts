import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, trackErrors } from './helpers';

test.describe('marketing site', () => {
  test('presents the product and leads to sign up', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Your business deserves more than scattered WhatsApp photos.' })).toBeVisible();
    await expect(page).toHaveTitle(/Showcase/);
    for (const heading of ['Everything you sell or do, in one simple link.', 'What your customers see']) {
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    }
    await expectNoHorizontalScroll(page);
    await page.getByRole('link', { name: /create your free catalogue/i }).first().click();
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByRole('heading', { name: 'Create your free catalogue' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('"See how it works" jumps to the steps', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'See how it works' }).click();
    await expect(page.locator('#how-it-works')).toBeInViewport();
  });

  test('has accessible mobile navigation', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile menu only');
    await page.goto('/');
    const toggle = page.getByRole('button', { name: 'Open menu' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    // Full-page menu: covers the whole screen, focus moves inside, page scroll is locked.
    const menu = page.getByRole('dialog', { name: 'Menu' });
    await expect(menu).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const box = await menu.boundingBox();
    const viewport = page.viewportSize();
    expect(box?.width).toBe(viewport?.width);
    expect(box?.height).toBe(viewport?.height);
    await expect(menu.getByRole('button', { name: 'Close menu' })).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
    await expect(menu.getByRole('link', { name: /Who it's for/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(toggle).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');

    // Section links close the menu and scroll to the section.
    await toggle.click();
    await page.getByRole('dialog', { name: 'Menu' }).getByRole('link', { name: /How it works/ }).click();
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeHidden();
    await expect(page.locator('#how-it-works')).toBeInViewport();
  });

  test('legal pages are reachable from the footer', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('contentinfo').getByRole('link', { name: 'Privacy Policy' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();
    await page.goto('/terms');
    await expect(page.getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeVisible();
  });

  test('unknown pages show a proper not-found screen', async ({ page }) => {
    await page.goto('/this/does/not/exist');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });
});
