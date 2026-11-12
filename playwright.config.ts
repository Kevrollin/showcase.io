import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the production build served by
 * scripts/serve.ts, which emulates vercel.json (rewrites, crawler routing,
 * headers, the share-preview function) and a mock Supabase API.
 *
 * The opt-in real-backend journey lives in playwright.real.config.ts.
 */
const PORT = 4173;
const MOCK_SUPABASE_PORT = 54329;

export default defineConfig({
  testDir: 'tests/e2e',
  testIgnore: /real-backend/,
  fullyParallel: true,
  // Each worker runs a full Chromium; capped so low-memory machines stay responsive.
  workers: process.env.CI ? 2 : 3,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'node scripts/build-e2e.ts && node scripts/serve.ts',
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    stdout: 'pipe',
    env: { DIST_DIR: 'dist-e2e', PORT: String(PORT), MOCK_SUPABASE_PORT: String(MOCK_SUPABASE_PORT) },
  },
});
