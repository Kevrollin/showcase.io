import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

/**
 * Opt-in end-to-end journey against a REAL Supabase project.
 *
 * Uses E2E_SUPABASE_URL / E2E_SUPABASE_ANON_KEY, falling back to the
 * VITE_SUPABASE_* values in .env. Either:
 *   · a test project with "Confirm email" OFF — the test signs up a new user, or
 *   · any project (incl. production) with a disposable confirmed user:
 *       npm run e2e:user          → prints E2E_USER_EMAIL / E2E_USER_PASSWORD
 *       E2E_USER_EMAIL=… E2E_USER_PASSWORD=… npm run test:e2e:real
 * The test deletes the account it used at the end (data and photos included).
 */
const PORT = 4173;

for (const file of ['.env', '.env.local']) if (existsSync(file)) process.loadEnvFile(file);
process.env.E2E_SUPABASE_URL ??= process.env.VITE_SUPABASE_URL;
process.env.E2E_SUPABASE_ANON_KEY ??= process.env.VITE_SUPABASE_ANON_KEY;

if (!process.env.E2E_SUPABASE_URL || !process.env.E2E_SUPABASE_ANON_KEY) {
  throw new Error('Set E2E_SUPABASE_URL and E2E_SUPABASE_ANON_KEY (or VITE_SUPABASE_* in .env).');
}

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: /real-backend\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    ...devices['Pixel 7'],
  },
  webServer: {
    command: 'node scripts/build-e2e.ts && node scripts/serve.ts',
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      E2E_SUPABASE_URL: process.env.E2E_SUPABASE_URL,
      E2E_SUPABASE_ANON_KEY: process.env.E2E_SUPABASE_ANON_KEY,
      DIST_DIR: 'dist-e2e',
      PORT: String(PORT),
      SUPABASE_URL: process.env.E2E_SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.E2E_SUPABASE_ANON_KEY,
      SITE_URL: `http://127.0.0.1:${PORT}`,
    },
  },
});
