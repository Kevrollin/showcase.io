import { expect, test } from '@playwright/test';
import { ITEMS, MOCK, STORE } from './fixtures';
import { expectNoHorizontalScroll, signIn, trackErrors } from './helpers';

test.describe('authentication', () => {
  test('protected pages redirect to sign in', async ({ page }) => {
    await page.goto('/dashboard/catalogue');
    await expect(page).toHaveURL(`/login?next=${encodeURIComponent('/dashboard/catalogue')}`);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });

  test('wrong credentials show a friendly message', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(MOCK.ownerEmail);
    await page.getByLabel(/^Password/).fill('not-the-password-1');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toHaveText('The email or password is incorrect.');
  });

  test('sign in, session persists across reloads, sign out', async ({ page, isMobile }) => {
    await signIn(page, '/dashboard');
    await expect(page.getByRole('heading', { level: 1, name: STORE.name })).toBeVisible();
    await expect(page.getByText('Welcome back, Wanjiru')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: STORE.name })).toBeVisible();

    if (isMobile) {
      await page.getByRole('button', { name: 'More' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Sign out' }).click();
    } else {
      await page.getByRole('complementary').getByRole('button', { name: 'Sign out' }).click();
    }
    await expect(page).toHaveURL(/\/login/);
  });

  test('sign up asks the user to confirm their email', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Your name').fill('Brian Otieno');
    await page.getByLabel('Email').fill('new-seller@example.com');
    await page.getByLabel('Password', { exact: true }).fill('passw0rd123');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
    await expect(page.getByText('new-seller@example.com')).toBeVisible();
  });

  test('sign up explains when the email is already registered', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Your name').fill('Someone');
    await page.getByLabel('Email').fill('taken@example.com');
    await page.getByLabel('Password', { exact: true }).fill('passw0rd123');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('alert')).toContainText('already exists');
  });

  test('password recovery does not reveal whether an account exists', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.getByLabel('Email').fill('anyone@example.com');
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    await expect(page.getByText(/If an account exists for/)).toBeVisible();
  });

  test('expired email links explain what to do next', async ({ page }) => {
    await page.goto('/auth/callback?type=recovery#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
    await expect(page.getByRole('heading', { name: "This link didn't work" })).toBeVisible();
    await expect(page.getByText(/expired or has already been used/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Request a new reset link' })).toBeVisible();
  });
});

test.describe('dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, '/dashboard');
  });

  test('overview shows the live link, stats and quick actions', async ({ page }) => {
    const errors = trackErrors(page);
    await expect(page.getByRole('link', { name: /127\.0\.0\.1:4173\/s\/campus-kicks/ })).toBeVisible();
    await expect(page.getByRole('main').getByText('Published', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Add new product' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    expect(errors).toEqual([]);
  });

  test('catalogue lists every item, including hidden ones, and can be searched', async ({ page }) => {
    await page.goto('/dashboard/catalogue');
    for (const item of ITEMS) await expect(page.getByText(item.title, { exact: true })).toBeVisible();
    // The badge inside the item's link, not the "Hidden" label of the visibility switch.
    await expect(page.getByRole('link', { name: /Secret Drop/ }).getByText('Hidden', { exact: true })).toBeVisible();
    await page.getByRole('searchbox', { name: /search products/i }).fill('tote');
    await expect(page.getByText('Canvas Tote Bag', { exact: true })).toBeVisible();
    await expect(page.getByText('Nike Air Max 90', { exact: true })).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });

  test('hiding an item from the item menu confirms with a toast', async ({ page }) => {
    await page.goto('/dashboard/catalogue');
    await page.getByRole('button', { name: 'Actions for Nike Air Max 90' }).click();
    await page.getByRole('menuitem', { name: 'Hide from storefront' }).click();
    await expect(page.getByText('Hidden from your storefront.')).toBeVisible();
  });

  test('deleting asks for confirmation', async ({ page }) => {
    await page.goto('/dashboard/catalogue');
    await page.getByRole('button', { name: 'Actions for Canvas Tote Bag' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog.getByRole('heading', { name: 'Are you sure you want to delete this item?' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
  });

  test('item editor loads existing details', async ({ page }) => {
    await page.goto(`/dashboard/catalogue/${ITEMS[0]!.id}`);
    await expect(page.getByLabel('Product name')).toHaveValue('Nike Air Max 90');
    await expect(page.getByLabel('Amount')).toHaveValue('4500');
    await expect(page.getByText('2/8 · first photo is the cover')).toBeVisible();
  });

  test('new item form validates required fields', async ({ page }) => {
    await page.goto('/dashboard/catalogue/new');
    await page.getByRole('button', { name: 'Add product' }).click();
    await expect(page.getByText('Give it a name.')).toBeVisible();
    await expect(page.getByText('Enter a price, or choose “Contact for price”.')).toBeVisible();
  });

  test('share page offers the link, QR downloads and a printable card', async ({ page }) => {
    await page.goto('/dashboard/share');
    await expect(page.getByRole('img', { name: /QR code for 127\.0\.0\.1:4173\/s\/campus-kicks/ })).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download PNG' }).click();
    expect((await download).suggestedFilename()).toBe('campus-kicks-qr.png');
    const svgDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download SVG' }).click();
    expect((await svgDownload).suggestedFilename()).toBe('campus-kicks-qr.svg');
    await expect(page.getByRole('button', { name: 'Download card (PNG)' })).toBeEnabled();
    await expectNoHorizontalScroll(page);
  });
});
