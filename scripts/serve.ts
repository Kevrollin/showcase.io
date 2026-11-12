/**
 * Local production server that emulates the parts of Vercel this app relies
 * on, so they can be tested before deploying:
 *   · filesystem first, then /api functions, then vercel.json rewrites
 *     (including the crawler-only `has: user-agent` rule)
 *   · vercel.json response headers (cache + security headers, CSP)
 *   · api/share-preview.ts executed as a function
 * With MOCK_SUPABASE_PORT set it also starts a mock Supabase API backed by
 * tests/e2e/fixtures.ts (used by the Playwright suite).
 *
 * Run with Node 22.18+ (TypeScript type stripping):  node scripts/serve.ts
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { handleSharePreview } from '../api/share-preview.ts';
import * as F from '../tests/e2e/fixtures.ts';

interface Rewrite {
  source: string;
  destination: string;
  has?: Array<{ type: string; key: string; value?: string }>;
}
interface HeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

const ROOT = resolve(process.env.DIST_DIR ?? 'dist');
const PORT = Number(process.env.PORT ?? 4173);
const HOST = process.env.HOST ?? '127.0.0.1';
const MOCK_PORT = process.env.MOCK_SUPABASE_PORT ? Number(process.env.MOCK_SUPABASE_PORT) : null;
const MOCK_ORIGIN = MOCK_PORT ? `http://${HOST}:${MOCK_PORT}` : null;
const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as { rewrites: Rewrite[]; headers: HeaderRule[] };

if (MOCK_ORIGIN) {
  process.env.SUPABASE_URL = MOCK_ORIGIN;
  process.env.SUPABASE_ANON_KEY = F.MOCK.anonKey;
  process.env.SITE_URL = `http://${HOST}:${PORT}`;
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
};

/** Vercel source pattern (":name" params + regex groups) → RegExp. */
function compile(source: string): RegExp {
  return new RegExp(`^${source.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`);
}

function headersFor(pathname: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rule of config.headers) {
    if (!compile(rule.source).test(pathname)) continue;
    for (const h of rule.headers) {
      // Allow the local mock API through the production CSP.
      out[h.key] = MOCK_ORIGIN && h.key === 'Content-Security-Policy' ? h.value.replaceAll('https://*.supabase.co', MOCK_ORIGIN) : h.value;
    }
  }
  return out;
}

function staticFile(pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const file = resolve(join(ROOT, decoded));
  if (!file.startsWith(ROOT + sep) && file !== ROOT) return null;
  return existsSync(file) && statSync(file).isFile() ? file : null;
}

// In-memory cache keyed by modification time: fast under parallel test load,
// and rebuilds are still picked up without restarting the server.
const fileCache = new Map<string, { mtimeMs: number; body: Buffer }>();

function readCached(file: string): Buffer {
  const { mtimeMs } = statSync(file);
  const hit = fileCache.get(file);
  if (hit && hit.mtimeMs === mtimeMs) return hit.body;
  const body = readFileSync(file);
  fileCache.set(file, { mtimeMs, body });
  return body;
}

function sendFile(res: ServerResponse, file: string, headers: Record<string, string>, status = 200) {
  res.writeHead(status, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', ...headers });
  res.end(readCached(file));
}

async function sendFunction(req: IncomingMessage, res: ServerResponse, target: URL, headers: Record<string, string>) {
  const request = new Request(target, { method: req.method, headers: req.headers as Record<string, string> });
  const response = await handleSharePreview(request);
  const out: Record<string, string> = { ...headers };
  response.headers.forEach((value, key) => {
    out[key] = value;
  });
  res.writeHead(response.status, out);
  res.end(req.method === 'HEAD' ? undefined : Buffer.from(await response.arrayBuffer()));
}

const app = createServer((req, res) => {
  void (async () => {
    const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);
    const headers = headersFor(url.pathname);

    const file = staticFile(url.pathname);
    if (file) return sendFile(res, file, headers);
    if (url.pathname === '/api/share-preview') return sendFunction(req, res, url, headers);

    for (const rule of config.rewrites) {
      const match = compile(rule.source).exec(url.pathname);
      if (!match) continue;
      const ok = (rule.has ?? []).every((cond) => {
        if (cond.type !== 'header') return false;
        const value = req.headers[cond.key.toLowerCase()];
        const text = Array.isArray(value) ? value.join(',') : (value ?? '');
        return cond.value === undefined ? text.length > 0 : new RegExp(cond.value).test(text);
      });
      if (!ok) continue;
      const destination = rule.destination.replace(/:(\w+)/g, (_, name: string) => match.groups?.[name] ?? '');
      const target = new URL(destination, url);
      if (target.pathname === '/api/share-preview') return sendFunction(req, res, target, headers);
      const rewritten = staticFile(target.pathname);
      if (rewritten) return sendFile(res, rewritten, headers);
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  })().catch((error: unknown) => {
    console.error(error);
    res.writeHead(500);
    res.end('Server error');
  });
});

app.listen(PORT, HOST, () => console.log(`Serving ${ROOT} on http://${HOST}:${PORT}`));

// ─── Mock Supabase ───────────────────────────────────────────────────────────

function cors(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'authorization, apikey, content-type, accept, accept-profile, content-profile, prefer, range, x-client-info, x-upsert, cache-control, x-supabase-api-version',
  );
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'content-range, x-supabase-api-version');
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'x-supabase-api-version': '2024-01-01' });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  try {
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function placeholderImage(path: string): string {
  let hash = 0;
  for (const ch of path) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="hsl(${hue} 35% 86%)"/><circle cx="200" cy="200" r="90" fill="hsl(${hue} 40% 55%)"/></svg>`;
}

if (MOCK_PORT) {
  const mock = createServer((req, res) => {
    void (async () => {
      cors(res);
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }
      const url = new URL(req.url ?? '/', MOCK_ORIGIN!);
      const path = url.pathname;
      const wantsObject = (req.headers.accept ?? '').includes('vnd.pgrst.object');

      if (path.startsWith('/storage/v1/object/public/')) {
        res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600' });
        res.end(placeholderImage(path));
        return;
      }
      if (req.method === 'POST' && path === '/rest/v1/rpc/get_storefront') {
        const body = await readBody(req);
        return json(res, 200, F.storefrontJson(String(body.p_slug ?? '')));
      }
      if (req.method === 'POST' && path === '/rest/v1/rpc/get_storefront_items') {
        return json(res, 200, F.storefrontItemsJson(await readBody(req)));
      }
      if (req.method === 'POST' && path === '/rest/v1/rpc/get_storefront_item') {
        const body = await readBody(req);
        return json(res, 200, F.storefrontItemJson(String(body.p_slug ?? ''), String(body.p_item_slug ?? '')));
      }

      // Auth
      if (req.method === 'GET' && path === '/auth/v1/settings') {
        return json(res, 200, { external: { email: true, google: true }, disable_signup: false, mailer_autoconfirm: true });
      }
      // "Continue with Google": skip Google itself and come straight back with a code.
      if (req.method === 'GET' && path === '/auth/v1/authorize') {
        const redirectTo = url.searchParams.get('redirect_to') ?? '';
        if (url.searchParams.get('provider') !== 'google' || !redirectTo.startsWith(`http://${HOST}:${PORT}/`)) {
          return json(res, 400, { code: 400, error_code: 'validation_failed', msg: 'Unsupported provider or redirect' });
        }
        const back = new URL(redirectTo);
        back.searchParams.set('code', 'e2e-google-code');
        res.writeHead(302, { Location: back.toString() });
        res.end();
        return;
      }
      if (req.method === 'POST' && path === '/rest/v1/rpc/secure_linked_sign_in') return json(res, 200, false);
      if (req.method === 'POST' && path === '/auth/v1/token') {
        const body = await readBody(req);
        if (url.searchParams.get('grant_type') === 'pkce') {
          return body.auth_code === 'e2e-google-code' && typeof body.code_verifier === 'string' && body.code_verifier.length > 0
            ? json(res, 200, F.sessionJson({ google: true }))
            : json(res, 400, { code: 400, error_code: 'flow_state_not_found', msg: 'invalid flow state, no valid flow state found' });
        }
        if (url.searchParams.get('grant_type') === 'refresh_token') {
          return body.refresh_token === 'e2e-refresh-token'
            ? json(res, 200, F.sessionJson())
            : json(res, 400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
        }
        if (body.email === F.MOCK.ownerEmail && body.password === F.MOCK.ownerPassword) return json(res, 200, F.sessionJson());
        return json(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      }
      if (req.method === 'POST' && path === '/auth/v1/signup') {
        const body = await readBody(req);
        const existing = body.email === 'taken@example.com';
        return json(res, 200, {
          id: '99999999-9999-4999-8999-999999999999',
          aud: 'authenticated',
          role: 'authenticated',
          email: body.email,
          confirmation_sent_at: new Date().toISOString(),
          identities: existing ? [] : [{ id: '9', provider: 'email' }],
          user_metadata: {},
          app_metadata: {},
          created_at: new Date().toISOString(),
        });
      }
      if (req.method === 'POST' && path === '/auth/v1/recover') return json(res, 200, {});
      if (req.method === 'POST' && path === '/auth/v1/logout') {
        res.writeHead(204);
        res.end();
        return;
      }
      if (req.method === 'GET' && path === '/auth/v1/user') return json(res, 200, F.sessionJson().user);

      // OAuth 2.1 server (consent screen + connected apps)
      const authorization = /^\/auth\/v1\/oauth\/authorizations\/([^/]+)(\/consent)?$/.exec(path);
      if (authorization) {
        const [, id, consent] = authorization;
        if (id !== 'e2e-authorization-1') return json(res, 404, { code: 404, error_code: 'oauth_authorization_not_found', msg: 'Authorization not found' });
        if (req.method === 'GET' && !consent) {
          return json(res, 200, {
            authorization_id: id,
            redirect_uri: `http://${HOST}:${PORT}/privacy`,
            client: { id: 'e2e-client', name: 'Campus Deals', uri: 'https://deals.example.com', logo_uri: '' },
            user: { id: F.MOCK.ownerId, email: F.MOCK.ownerEmail },
            scope: 'openid email',
          });
        }
        if (req.method === 'POST' && consent) {
          const body = await readBody(req);
          const result = body.action === 'approve' ? 'code=e2e-oauth-code' : 'error=access_denied';
          return json(res, 200, { redirect_url: `http://${HOST}:${PORT}/privacy?${result}` });
        }
      }
      if (path === '/auth/v1/user/oauth/grants') {
        if (req.method === 'GET') {
          return json(res, 200, [
            { client: { id: 'e2e-client', name: 'Campus Deals', uri: 'https://deals.example.com', logo_uri: '' }, scopes: ['openid', 'email'], granted_at: '2026-11-10T09:00:00Z' },
          ]);
        }
        if (req.method === 'DELETE') {
          res.writeHead(204);
          res.end();
          return;
        }
      }

      // Owner data (what RLS would return to the signed-in owner)
      if (req.method === 'GET' && path === '/rest/v1/businesses') return json(res, 200, [F.businessRow()]);
      if (req.method === 'GET' && path === '/rest/v1/catalogue_items') return json(res, 200, F.itemRows());
      if (req.method === 'GET' && path === '/rest/v1/categories') return json(res, 200, F.categoryRows());
      if (req.method === 'GET' && path === '/rest/v1/profiles') {
        const profile = {
          id: F.MOCK.ownerId,
          full_name: 'Wanjiru Kamau',
          plan_id: 'free',
          plans: { id: 'free', name: 'Free', max_businesses: 1, max_published_businesses: 1, max_items_per_business: 300, max_images_per_item: 8 },
        };
        return json(res, 200, wantsObject ? profile : [profile]);
      }
      if (req.method === 'PATCH' && path === '/rest/v1/catalogue_items') {
        const body = await readBody(req);
        const id = (url.searchParams.get('id') ?? '').replace(/^eq\./, '');
        const row = F.itemRows().find((r) => r.id === id);
        if (!row) return json(res, 404, { code: 'PGRST116', message: 'not found' });
        const updated = { ...row, ...body };
        return json(res, 200, wantsObject ? updated : [updated]);
      }
      return json(res, 404, { message: `Not mocked: ${req.method} ${path}` });
    })().catch((error: unknown) => {
      console.error(error);
      res.writeHead(500);
      res.end();
    });
  });
  mock.listen(MOCK_PORT, HOST, () => console.log(`Mock Supabase on ${MOCK_ORIGIN}`));
}
