import { expect, test } from '@playwright/test';
import { STORE } from './fixtures';
import { expectNoHorizontalScroll, trackErrors } from './helpers';

const BASE = 'http://127.0.0.1:4173';

test.describe('public storefront', () => {
  test('shows the business, its published items and WhatsApp contact', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(`/s/${STORE.slug}`);
    await expect(page.getByRole('heading', { level: 1, name: STORE.name })).toBeVisible();
    await expect(page).toHaveTitle(`${STORE.name} · Showcase`);
    await expect(page.getByRole('link', { name: /Nike Air Max 90, KES 4,500/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Canvas Tote Bag/ })).toBeVisible();
    await expect(page.getByText('Pre-order')).toBeVisible();
    await expect(page.getByRole('link', { name: /Sneaker Cleaning, From KES 500/ })).toBeVisible();
    // Unpublished items never reach the public API.
    await expect(page.getByText('Secret Drop')).toHaveCount(0);

    const whatsapp = page.getByRole('link', { name: 'Chat on WhatsApp' }).first();
    await expect(whatsapp).toHaveAttribute('href', /^https:\/\/wa\.me\/254712345678\?text=Hi%20Campus%20Kicks/);
    await expect(page.getByRole('link', { name: 'Instagram' })).toHaveAttribute('href', STORE.instagram_url);
    await expect(page.getByRole('link', { name: 'Call' })).toHaveAttribute('href', 'tel:+254712345678');
    await expectNoHorizontalScroll(page);
    expect(errors).toEqual([]);
  });

  test('slugs are case-insensitive', async ({ page }) => {
    await page.goto('/s/Campus-Kicks');
    await expect(page.getByRole('heading', { level: 1, name: STORE.name })).toBeVisible();
  });

  test('filters by category and keeps the filter in the URL', async ({ page }) => {
    await page.goto(`/s/${STORE.slug}`);
    await page.getByRole('group', { name: 'Filter by category' }).getByRole('button', { name: /Bags/ }).click();
    await expect(page).toHaveURL(/category=/);
    await expect(page.getByRole('link', { name: /Canvas Tote Bag/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Nike Air Max 90/ })).toHaveCount(0);
    await page.getByRole('group', { name: 'Filter by category' }).getByRole('button', { name: 'All' }).click();
    await expect(page.getByRole('link', { name: /Nike Air Max 90/ })).toBeVisible();
  });

  test('opens an item with a gallery and an item-specific WhatsApp enquiry', async ({ page, isMobile }) => {
    await page.goto(`/s/${STORE.slug}`);
    await page.getByRole('link', { name: /Nike Air Max 90/ }).click();
    await expect(page).toHaveURL(`/s/${STORE.slug}/nike-air-max-90`);
    await expect(page.getByRole('heading', { level: 1, name: 'Nike Air Max 90' })).toBeVisible();
    await expect(page.getByText('KES 4,500')).toBeVisible();
    await expect(page.getByText('In stock')).toBeVisible();
    await expect(page.getByText('1 / 2')).toBeVisible();

    const enquiry = page.getByRole('link', { name: 'Ask about this on WhatsApp' }).filter({ visible: true }).first();
    const href = await enquiry.getAttribute('href');
    const text = new URL(href!).searchParams.get('text');
    expect(text).toBe(`Hi, I found your catalogue and I'm interested in the Nike Air Max 90.\n${BASE}/s/${STORE.slug}/nike-air-max-90`);
    if (isMobile) await expectNoHorizontalScroll(page);
  });

  test('item links work when opened directly (and after refresh)', async ({ page }) => {
    await page.goto(`/s/${STORE.slug}/canvas-tote-bag`);
    await expect(page.getByRole('heading', { level: 1, name: 'Canvas Tote Bag' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Canvas Tote Bag' })).toBeVisible();
  });

  test('unknown storefronts and items show helpful not-found pages', async ({ page }) => {
    await page.goto('/s/nobody-here');
    await expect(page.getByRole('heading', { name: "This storefront isn't available" })).toBeVisible();
    await page.goto(`/s/${STORE.slug}/secret-drop`);
    await expect(page.getByRole('heading', { name: 'This item is no longer available' })).toBeVisible();
  });
});

test.describe('social sharing previews', () => {
  test('crawlers receive storefront-specific Open Graph tags', async ({ request }) => {
    const response = await request.get(`/s/${STORE.slug}`, { headers: { 'User-Agent': 'WhatsApp/2.23.20.0 A' } });
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain(`<meta property="og:title" content="${STORE.name}">`);
    expect(html).toContain(`<meta property="og:description" content="${STORE.description}">`);
    expect(html).toContain(`<meta property="og:url" content="${BASE}/s/${STORE.slug}">`);
    expect(html).toMatch(/<meta property="og:image" content="http:\/\/127\.0\.0\.1:54329\/storage\/v1\/object\/public\/catalog-media\/[^"]+share-[^"]+\.jpg">/);
    expect(html).not.toContain('id="root"');
  });

  test('crawlers receive item previews', async ({ request }) => {
    const response = await request.get(`/s/${STORE.slug}/nike-air-max-90`, { headers: { 'User-Agent': 'facebookexternalhit/1.1' } });
    const html = await response.text();
    expect(html).toContain('<meta property="og:title" content="Nike Air Max 90 · Campus Kicks">');
    expect(html).toContain(`<meta property="og:url" content="${BASE}/s/${STORE.slug}/nike-air-max-90">`);
  });

  test('ordinary visitors still get the React app, with security headers', async ({ request }) => {
    const response = await request.get(`/s/${STORE.slug}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36' },
    });
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('<div id="root">');
    const headers = response.headers();
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['x-content-type-options']).toBe('nosniff');
  });

  test('built assets are served with long-lived caching', async ({ request, page }) => {
    await page.goto('/');
    const script = await page.locator('script[type="module"]').first().getAttribute('src');
    const response = await request.get(script!);
    expect(response.headers()['cache-control']).toContain('immutable');
  });
});
