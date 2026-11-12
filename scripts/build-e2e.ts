/**
 * Production build for the end-to-end suites (output: dist-e2e/).
 *   · default: points at the local mock Supabase API started by scripts/serve.ts
 *   · with E2E_SUPABASE_URL + E2E_SUPABASE_ANON_KEY: points at a real project
 * (A script rather than inline env vars so it works on Windows too.)
 */
import { build } from 'vite';

const port = process.env.PORT ?? '4173';
const mockPort = process.env.MOCK_SUPABASE_PORT ?? '54329';
const realUrl = process.env.E2E_SUPABASE_URL;

process.env.VITE_SUPABASE_URL = realUrl ?? `http://127.0.0.1:${mockPort}`;
process.env.VITE_SUPABASE_ANON_KEY = realUrl ? (process.env.E2E_SUPABASE_ANON_KEY ?? '') : 'e2e-anon-key';
process.env.VITE_SITE_URL = `http://127.0.0.1:${port}`;
process.env.VITE_CONTACT_EMAIL = 'hello@example.com';

if (realUrl && !process.env.VITE_SUPABASE_ANON_KEY) throw new Error('E2E_SUPABASE_ANON_KEY is required with E2E_SUPABASE_URL');

await build({ mode: 'e2e', logLevel: 'warn', build: { outDir: 'dist-e2e', emptyOutDir: true } });
console.log(`Built dist-e2e against ${realUrl ? 'a real Supabase project' : 'the mock API'}`);
