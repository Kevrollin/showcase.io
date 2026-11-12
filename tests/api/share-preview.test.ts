import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BRAND } from '../../src/config/brand';
import { buildPreviewMeta, escapeHtml, handleSharePreview, PREVIEW_BRAND, renderPreviewHtml, type PreviewConfig } from '../../api/share-preview';
import { storefrontItemJson, storefrontJson } from '../e2e/fixtures';

const cfg: PreviewConfig = { supabaseUrl: 'https://abc.supabase.co', anonKey: 'anon', siteUrl: 'https://showcase.example' };

/** Fake PostgREST: answers the two RPCs from the shared fixtures. */
function fakeFetch(calls: string[] = []): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    const body = JSON.parse(String(init?.body ?? '{}')) as { p_slug: string; p_item_slug?: string };
    const headers = new Headers(init?.headers);
    expect(headers.get('apikey')).toBe('anon');
    if (url.endsWith('/rpc/get_storefront')) return Response.json(storefrontJson(body.p_slug));
    if (url.endsWith('/rpc/get_storefront_item')) return Response.json(storefrontItemJson(body.p_slug, body.p_item_slug ?? ''));
    return new Response('nope', { status: 404 });
  }) as typeof fetch;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('share preview metadata', () => {
  it('stays in sync with the central brand config', () => {
    expect(PREVIEW_BRAND.name).toBe(BRAND.name);
    expect(PREVIEW_BRAND.promise).toBe(BRAND.promise);
    expect(PREVIEW_BRAND.description).toBe(BRAND.shortDescription);
    expect(PREVIEW_BRAND.storefrontPrefix).toBe(BRAND.storefrontPrefix);
  });

  it('describes a storefront with its name, description, share image and canonical URL', async () => {
    const meta = await buildPreviewMeta(cfg, 'Campus-Kicks', null, fakeFetch());
    expect(meta.found).toBe(true);
    expect(meta.title).toBe('Campus Kicks');
    expect(meta.description).toBe('Original sneakers and streetwear, delivered around campus.');
    expect(meta.url).toBe('https://showcase.example/s/campus-kicks');
    expect(meta.image).toMatch(/^https:\/\/abc\.supabase\.co\/storage\/v1\/object\/public\/catalog-media\/.+\/brand\/share-.+\.jpg$/);
    expect(meta.imageWidth).toBe(1200);
  });

  it('describes an item with price, item image and item URL', async () => {
    const meta = await buildPreviewMeta(cfg, 'campus-kicks', 'nike-air-max-90', fakeFetch());
    expect(meta.title).toBe('Nike Air Max 90 · Campus Kicks');
    expect(meta.description.startsWith('KES 4,500 · Classic runners')).toBe(true);
    expect(meta.url).toBe('https://showcase.example/s/campus-kicks/nike-air-max-90');
    expect(meta.image).toMatch(/-thumb\.webp$/);
  });

  it('falls back to the storefront when the item is unknown or unpublished', async () => {
    const meta = await buildPreviewMeta(cfg, 'campus-kicks', 'secret-drop', fakeFetch());
    expect(meta.title).toBe('Campus Kicks');
    expect(meta.url).toBe('https://showcase.example/s/campus-kicks');
  });

  it('returns generic brand metadata for unknown storefronts', async () => {
    const meta = await buildPreviewMeta(cfg, 'does-not-exist', null, fakeFetch());
    expect(meta.found).toBe(false);
    expect(meta.title).toContain(BRAND.name);
    expect(meta.image).toBe('https://showcase.example/og-default.png');
  });

  it('never queries the database for malformed slugs', async () => {
    const calls: string[] = [];
    for (const slug of ['../../etc', 'a b', '<script>', '']) {
      const meta = await buildPreviewMeta(cfg, slug, null, fakeFetch(calls));
      expect(meta.found).toBe(false);
    }
    expect(calls).toHaveLength(0);
  });
});

describe('share preview HTML', () => {
  it('escapes every interpolated value', () => {
    const html = renderPreviewHtml({
      title: '"><script>alert(1)</script>',
      description: "Tom & Jerry's <b>",
      url: 'https://x.example/s/a"b',
      image: 'https://x.example/i.png',
      imageAlt: '<img>',
      found: true,
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&quot;&gt;&lt;script&gt;');
    expect(html).toContain('Tom &amp; Jerry&#39;s &lt;b&gt;');
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });

  it('contains the Open Graph tags link previews need', async () => {
    const html = renderPreviewHtml(await buildPreviewMeta(cfg, 'campus-kicks', null, fakeFetch()));
    for (const tag of ['og:title', 'og:description', 'og:image', 'og:url', 'og:site_name', 'twitter:card']) {
      expect(html).toContain(`property="${tag}"`.replace('property="twitter:card"', 'name="twitter:card"'));
    }
    expect(html).toContain('<link rel="canonical" href="https://showcase.example/s/campus-kicks">');
    expect(html).not.toContain('noindex');
  });
});

describe('share preview function', () => {
  it('responds with cacheable HTML using only the public anon key', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://abc.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon');
    vi.stubEnv('SITE_URL', 'https://showcase.example');
    const response = await handleSharePreview(new Request('https://showcase.example/api/share-preview?slug=campus-kicks'), fakeFetch());
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(response.headers.get('cache-control')).toContain('s-maxage=300');
    expect(await response.text()).toContain('content="Campus Kicks"');
  });

  it('returns 404 for unknown storefronts and 503 when not configured', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://abc.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon');
    const missing = await handleSharePreview(new Request('https://h.example/api/share-preview?slug=nope-nope'), fakeFetch());
    expect(missing.status).toBe(404);
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_URL', '');
    const unconfigured = await handleSharePreview(new Request('https://h.example/api/share-preview?slug=x'), fakeFetch());
    expect(unconfigured.status).toBe(503);
  });

  it('does not reference a service-role key', () => {
    const source = readFileSync('api/share-preview.ts', 'utf8');
    expect(source).not.toMatch(/service_role|SERVICE_ROLE|SUPABASE_SECRET/);
  });
});

describe('vercel routing config', () => {
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
    rewrites: Array<{ source: string; destination: string; has?: Array<{ value?: string }> }>;
  };
  const crawler = new RegExp(vercel.rewrites[0]!.has![0]!.value!);

  it.each([
    'WhatsApp/2.23.20.0 A',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Twitterbot/1.0',
    'TelegramBot (like TwitterBot)',
    'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
    'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
    'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
  ])('sends link-preview crawlers to the function: %s', (ua) => {
    expect(crawler.test(ua)).toBe(true);
  });

  it.each([
    'Mozilla/5.0 (Linux; Android 14; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  ])('serves the React app to normal browsers: %s', (ua) => {
    expect(crawler.test(ua)).toBe(false);
  });

  it('never rewrites API routes or built assets to the SPA', () => {
    const spa = vercel.rewrites.at(-1)!;
    expect(spa.destination).toBe('/index.html');
    const re = new RegExp(`^${spa.source}$`);
    expect(re.test('/api/share-preview')).toBe(false);
    expect(re.test('/assets/index-abc.js')).toBe(false);
    expect(re.test('/s/campus-kicks')).toBe(true);
    expect(re.test('/dashboard/catalogue')).toBe(true);
  });
});
