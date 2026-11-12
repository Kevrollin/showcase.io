/**
 * Smoke test for a hosted Supabase project, run exactly as a browser would
 * (public anon/publishable key only). Safe to run against production: it only
 * reads, and every write it attempts is expected to be rejected.
 *
 * Usage:  npm run db:smoke            (reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env)
 */
import { existsSync } from 'node:fs';

for (const file of ['.env', '.env.local']) if (existsSync(file)) process.loadEnvFile(file);

const url = (process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
const key = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';
if (!url || !key) {
  console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (e.g. in .env).');
  process.exit(1);
}

const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json', Accept: 'application/json' };
if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;

interface Check {
  name: string;
  run: () => Promise<string | true>;
}

const denied = (status: number) => status === 401 || status === 403 || status === 404;

const checks: Check[] = [
  {
    name: 'Public storefront RPC is reachable and returns null for an unknown slug',
    run: async () => {
      const r = await fetch(`${url}/rest/v1/rpc/get_storefront`, { method: 'POST', headers, body: JSON.stringify({ p_slug: 'smoke-test-no-such-store' }) });
      const body = await r.text();
      return r.status === 200 && body.trim() === 'null' ? true : `HTTP ${r.status}: ${body.slice(0, 200)}`;
    },
  },
  {
    name: 'Paginated items RPC works for anonymous visitors',
    run: async () => {
      const r = await fetch(`${url}/rest/v1/rpc/get_storefront_items`, { method: 'POST', headers, body: JSON.stringify({ p_slug: 'smoke-test-no-such-store' }) });
      const body = await r.text();
      return r.status === 200 && body.trim() === '[]' ? true : `HTTP ${r.status}: ${body.slice(0, 200)}`;
    },
  },
  {
    name: 'Anonymous visitors can read public business columns',
    run: async () => {
      const r = await fetch(`${url}/rest/v1/businesses?select=name,slug&limit=1`, { headers });
      return r.status === 200 ? true : `HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`;
    },
  },
  {
    name: 'Anonymous visitors cannot read private columns (owner_id)',
    run: async () => {
      const r = await fetch(`${url}/rest/v1/businesses?select=owner_id&limit=1`, { headers });
      return denied(r.status) ? true : `expected 401/403, got HTTP ${r.status}`;
    },
  },
  {
    name: 'Anonymous visitors cannot read profiles',
    run: async () => {
      const r = await fetch(`${url}/rest/v1/profiles?select=id&limit=1`, { headers });
      return denied(r.status) ? true : `expected 401/403, got HTTP ${r.status}`;
    },
  },
  {
    name: 'Anonymous visitors cannot create businesses',
    run: async () => {
      const r = await fetch(`${url}/rest/v1/businesses`, { method: 'POST', headers, body: JSON.stringify({ name: 'Smoke', business_type: 'products' }) });
      return denied(r.status) ? true : `expected 401/403, got HTTP ${r.status}`;
    },
  },
  {
    name: 'Owner-only RPCs are not callable anonymously',
    run: async () => {
      for (const fn of ['is_slug_available', 'delete_my_account', 'reorder_items', 'rls_auto_enable', 'secure_linked_sign_in']) {
        const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify({ p_slug: 'x' }) });
        if (r.status < 400) return `${fn} answered HTTP ${r.status}`;
      }
      return true;
    },
  },
  {
    name: 'Storage bucket catalog-media exists (public read path)',
    run: async () => {
      const r = await fetch(`${url}/storage/v1/object/public/catalog-media/smoke-test/does-not-exist.webp`);
      const body = await r.text();
      // A missing object in an existing public bucket → "Object not found"; a missing bucket → "Bucket not found".
      return /bucket not found/i.test(body) ? 'bucket missing' : r.status >= 400 ? true : `unexpected HTTP ${r.status}`;
    },
  },
  {
    name: 'Anonymous uploads are rejected',
    run: async () => {
      const r = await fetch(`${url}/storage/v1/object/catalog-media/smoke-test/x.webp`, {
        method: 'POST',
        headers: { apikey: key, ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}), 'Content-Type': 'image/webp' },
        body: new Uint8Array([0]),
      });
      return r.status >= 400 ? true : `upload accepted (HTTP ${r.status})`;
    },
  },
  {
    name: 'Auth: email sign-up and Google sign-in are enabled',
    run: async () => {
      const r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
      if (r.status !== 200) return `HTTP ${r.status}`;
      const s = (await r.json()) as { disable_signup?: boolean; mailer_autoconfirm?: boolean; external?: { email?: boolean; google?: boolean } };
      if (s.disable_signup) return 'sign-ups are disabled';
      if (s.external?.email === false) return 'email provider disabled';
      if (s.external?.google !== true) return 'Google provider is not enabled (Authentication → Sign In / Providers → Google)';
      // Email confirmation is deliberately OFF for this project (owner's decision);
      // secure_linked_sign_in() protects accounts that later link Google.
      console.log(`    · email confirmation: ${s.mailer_autoconfirm ? 'off (by decision)' : 'on'}`);
      return true;
    },
  },
  {
    name: 'Auth: Google sign-in requests only basic scopes and returns to Supabase',
    run: async () => {
      const r = await fetch(`${url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent('http://localhost:5173/auth/callback')}`, {
        headers: { apikey: key },
        redirect: 'manual',
      });
      const location = r.headers.get('location') ?? '';
      if (r.status < 300 || r.status >= 400 || !location.startsWith('https://accounts.google.com/')) return `unexpected response (HTTP ${r.status})`;
      const google = new URL(location);
      const scopes = (google.searchParams.get('scope') ?? '').split(/\s+/).filter(Boolean).sort();
      if (scopes.join(' ') !== 'email profile') return `unexpected scopes: ${scopes.join(' ')}`;
      if (google.searchParams.get('redirect_uri') !== `${url}/auth/v1/callback`) return 'Google redirect URI is not the Supabase callback';
      return true;
    },
  },
];

let failed = 0;
console.log(`Supabase smoke test → ${new URL(url).host}\n`);
for (const check of checks) {
  try {
    const result = await check.run();
    if (result === true) console.log(`  ✓ ${check.name}`);
    else {
      failed++;
      console.log(`  ✗ ${check.name}\n      ${result}`);
    }
  } catch (error) {
    failed++;
    console.log(`  ✗ ${check.name}\n      ${(error as Error).message}`);
  }
}
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed === 0 ? 0 : 1);
