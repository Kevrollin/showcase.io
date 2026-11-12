/**
 * Social share previews for storefront links.
 *
 * Link-preview crawlers (WhatsApp, Facebook, X, Telegram, Slack, …) do not run
 * JavaScript, so a client-rendered SPA cannot give them per-storefront Open
 * Graph tags. vercel.json rewrites crawler requests for /s/:slug and
 * /s/:slug/:item to this function, which returns a small HTML document with
 * the right title, description, image and canonical URL. Everyone else gets
 * the normal React app from the CDN.
 *
 * Only public data is used: the same SECURITY INVOKER RPCs the storefront
 * calls, with the public anon key. Responses are cached on Vercel's CDN.
 *
 * This file is intentionally self-contained (no imports from src/) so it runs
 * as-is on Vercel's Node.js runtime and under Node's type stripping in tests.
 */

/** Keep in sync with BRAND in src/config/brand.ts (asserted by a unit test). */
export const PREVIEW_BRAND = {
  name: 'Showcase',
  promise: 'Everything you sell or do, in one simple link.',
  description: 'Create a digital catalogue for your products, services or previous work and share it with one simple link.',
  storefrontPrefix: '/s',
  bucket: 'catalog-media',
} as const;

export interface PreviewConfig {
  supabaseUrl: string;
  anonKey: string;
  siteUrl: string;
}

interface StorefrontJson {
  name?: unknown;
  slug?: unknown;
  description?: unknown;
  tagline?: unknown;
  logo_path?: unknown;
  cover_path?: unknown;
  share_image_path?: unknown;
}

interface ItemJson {
  title?: unknown;
  slug?: unknown;
  description?: unknown;
  price?: unknown;
  currency?: unknown;
  price_mode?: unknown;
  images?: unknown;
}

export interface PreviewMeta {
  title: string;
  description: string;
  url: string;
  image: string;
  imageWidth?: number;
  imageHeight?: number;
  imageAlt: string;
  found: boolean;
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function truncate(value: string, max: number): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

function mediaUrl(cfg: PreviewConfig, path: string): string {
  return `${cfg.supabaseUrl}/storage/v1/object/public/${PREVIEW_BRAND.bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

function money(amount: number, currency: string): string {
  const cents = Math.round(amount * 100);
  const whole = String(Math.trunc(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = Math.abs(cents % 100);
  return `${currency} ${fraction ? `${whole}.${String(fraction).padStart(2, '0')}` : whole}`;
}

function priceLabel(item: ItemJson): string | null {
  const mode = str(item.price_mode);
  const amount = item.price === null || item.price === undefined ? null : Number(item.price);
  const currency = str(item.currency) ?? 'KES';
  if (mode === 'fixed' && amount !== null && Number.isFinite(amount)) return money(amount, currency);
  if (mode === 'starting_from' && amount !== null && Number.isFinite(amount)) return `From ${money(amount, currency)}`;
  if (mode === 'quote') return 'Request a quote';
  if (mode === 'contact') return 'Price on request';
  return null;
}

async function rpc<T>(cfg: PreviewConfig, fn: string, args: Record<string, string>, fetchImpl: typeof fetch): Promise<T | null> {
  const response = await fetchImpl(`${cfg.supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: cfg.anonKey,
      // Legacy anon keys are JWTs; new publishable keys must only be sent as `apikey`.
      ...(cfg.anonKey.startsWith('eyJ') ? { Authorization: `Bearer ${cfg.anonKey}` } : {}),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new Error(`Supabase RPC ${fn} failed with ${response.status}`);
  return (await response.json()) as T | null;
}

export async function buildPreviewMeta(
  cfg: PreviewConfig,
  slugInput: string,
  itemInput: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<PreviewMeta> {
  const fallback: PreviewMeta = {
    title: `${PREVIEW_BRAND.name} — ${PREVIEW_BRAND.promise}`,
    description: PREVIEW_BRAND.description,
    url: `${cfg.siteUrl}/`,
    image: `${cfg.siteUrl}/og-default.png`,
    imageWidth: 1200,
    imageHeight: 630,
    imageAlt: PREVIEW_BRAND.name,
    found: false,
  };

  const slug = slugInput.trim().toLowerCase();
  const itemSlug = itemInput ? itemInput.trim().toLowerCase() : null;
  if (!SLUG_RE.test(slug) || slug.length > 48 || (itemSlug !== null && (!SLUG_RE.test(itemSlug) || itemSlug.length > 80))) {
    return fallback;
  }

  const [business, item] = await Promise.all([
    rpc<StorefrontJson>(cfg, 'get_storefront', { p_slug: slug }, fetchImpl),
    itemSlug ? rpc<ItemJson>(cfg, 'get_storefront_item', { p_slug: slug, p_item_slug: itemSlug }, fetchImpl) : Promise.resolve(null),
  ]);
  const name = business ? str(business.name) : null;
  if (!business || !name) return fallback;

  const storefrontUrl = `${cfg.siteUrl}${PREVIEW_BRAND.storefrontPrefix}/${encodeURIComponent(slug)}`;
  const businessImage = str(business.share_image_path) ?? str(business.cover_path) ?? str(business.logo_path);
  const businessMeta: PreviewMeta = {
    title: name,
    description: truncate(str(business.description) ?? str(business.tagline) ?? `Browse ${name}'s catalogue and chat on WhatsApp.`, 200),
    url: storefrontUrl,
    image: businessImage ? mediaUrl(cfg, businessImage) : fallback.image,
    ...(str(business.share_image_path) || !businessImage ? { imageWidth: 1200, imageHeight: 630 } : {}),
    imageAlt: name,
    found: true,
  };

  if (!itemSlug) return businessMeta;
  const title = item ? str(item.title) : null;
  if (!item || !title) return { ...businessMeta, found: true };

  const images = Array.isArray(item.images) ? (item.images as Array<{ path?: unknown; thumb_path?: unknown }>) : [];
  const firstImage = images[0] ? (str(images[0].thumb_path) ?? str(images[0].path)) : null;
  const parts = [priceLabel(item), str(item.description)].filter((p): p is string => Boolean(p));
  return {
    title: `${title} · ${name}`,
    description: truncate(parts.length > 0 ? parts.join(' · ') : `See ${title} from ${name} and enquire on WhatsApp.`, 200),
    url: `${storefrontUrl}/${encodeURIComponent(itemSlug)}`,
    image: firstImage ? mediaUrl(cfg, firstImage) : businessMeta.image,
    ...(firstImage ? {} : { imageWidth: businessMeta.imageWidth, imageHeight: businessMeta.imageHeight }),
    imageAlt: title,
    found: true,
  };
}

export function renderPreviewHtml(meta: PreviewMeta): string {
  const e = escapeHtml;
  const imageSize =
    meta.imageWidth && meta.imageHeight
      ? `\n<meta property="og:image:width" content="${meta.imageWidth}">\n<meta property="og:image:height" content="${meta.imageHeight}">`
      : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(meta.title)}</title>
<meta name="description" content="${e(meta.description)}">
<link rel="canonical" href="${e(meta.url)}">
${meta.found ? '' : '<meta name="robots" content="noindex">\n'}<meta property="og:type" content="website">
<meta property="og:site_name" content="${e(PREVIEW_BRAND.name)}">
<meta property="og:title" content="${e(meta.title)}">
<meta property="og:description" content="${e(meta.description)}">
<meta property="og:url" content="${e(meta.url)}">
<meta property="og:image" content="${e(meta.image)}">
<meta property="og:image:secure_url" content="${e(meta.image)}">
<meta property="og:image:alt" content="${e(meta.imageAlt)}">${imageSize}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${e(meta.title)}">
<meta name="twitter:description" content="${e(meta.description)}">
<meta name="twitter:image" content="${e(meta.image)}">
</head>
<body>
<h1>${e(meta.title)}</h1>
<p>${e(meta.description)}</p>
<p><a href="${e(meta.url)}">${e(meta.found ? 'Open the catalogue' : PREVIEW_BRAND.name)}</a></p>
</body>
</html>`;
}

function readConfig(request: Request): PreviewConfig | null {
  const env = process.env;
  const supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '';
  let siteUrl = (env.SITE_URL || env.VITE_SITE_URL || '').replace(/\/+$/, '');
  if (!siteUrl) {
    // Fall back to the host the crawler requested (behind Vercel's proxy).
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
    const proto = request.headers.get('x-forwarded-proto') ?? 'https';
    siteUrl = host ? `${proto}://${host}` : new URL(request.url).origin;
  }
  if (!supabaseUrl || !anonKey) return null;
  return { supabaseUrl, anonKey, siteUrl };
}

export async function handleSharePreview(request: Request, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug') ?? '';
  const item = url.searchParams.get('item');
  const cfg = readConfig(request);
  const headers = { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noarchive' };

  if (!cfg) {
    return new Response('Share previews are not configured.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
  try {
    const meta = await buildPreviewMeta(cfg, slug, item, fetchImpl);
    return new Response(renderPreviewHtml(meta), {
      status: meta.found ? 200 : 404,
      headers: {
        ...headers,
        // Cache on the CDN so bursts of crawler traffic never reach the database.
        'Cache-Control': meta.found ? 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400' : 'public, max-age=0, s-maxage=60',
      },
    });
  } catch {
    const fallback = await buildPreviewMeta(cfg, '', null, fetchImpl);
    return new Response(renderPreviewHtml(fallback), { status: 502, headers: { ...headers, 'Cache-Control': 'no-store' } });
  }
}

export function GET(request: Request): Promise<Response> {
  return handleSharePreview(request);
}

export function HEAD(request: Request): Promise<Response> {
  return handleSharePreview(request);
}
