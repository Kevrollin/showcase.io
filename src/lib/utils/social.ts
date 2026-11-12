/**
 * Accepts either a handle ("@kelvin.designs", "kelvin.designs") or a profile URL
 * and returns a canonical https URL that matches the database CHECK constraints.
 */
export type SocialNetwork = 'instagram' | 'tiktok' | 'facebook';

export type SocialResult = { ok: true; url: string } | { ok: false };

const HANDLE = /^[A-Za-z0-9._]{1,30}$/;

function parseUrl(value: string): URL | null {
  try {
    return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
}

function hostOf(url: URL): string {
  return url.hostname.replace(/^(www\.|m\.)/, '').toLowerCase();
}

function handleFrom(value: string, host: string): string | null {
  // "kelvin.designs" is a valid handle, so only treat input as a URL when it has
  // a scheme or a path after the host ("instagram.com/kelvin").
  const looksLikeUrl = /^https?:\/\//i.test(value) || /^([a-z0-9-]+\.)+[a-z]{2,}\//i.test(value);
  if (!looksLikeUrl) return value.replace(/^@/, '');
  const url = parseUrl(value);
  if (!url || hostOf(url) !== host) return null;
  const first = url.pathname.split('/').filter(Boolean)[0] ?? '';
  return first.replace(/^@/, '');
}

export function normalizeSocial(network: SocialNetwork, input: string | null | undefined): SocialResult | null {
  const value = (input ?? '').trim();
  if (!value) return null;

  if (network === 'instagram') {
    const handle = handleFrom(value, 'instagram.com');
    return handle && HANDLE.test(handle) ? { ok: true, url: `https://instagram.com/${handle}` } : { ok: false };
  }

  if (network === 'tiktok') {
    const handle = handleFrom(value, 'tiktok.com');
    return handle && HANDLE.test(handle) ? { ok: true, url: `https://www.tiktok.com/@${handle}` } : { ok: false };
  }

  // Facebook pages can be /name, /profile.php?id=…, /people/…; keep the path.
  const trimmed = value.replace(/^@/, '');
  if (/(^|\.|\/)(facebook|fb)\.com/i.test(trimmed)) {
    const url = parseUrl(trimmed);
    if (!url || !['facebook.com', 'fb.com'].includes(hostOf(url))) return { ok: false };
    const rest = `${url.pathname}${url.search}`.replace(/^\/+/, '').replace(/\/+$/, '');
    if (!rest || /\s/.test(rest)) return { ok: false };
    return { ok: true, url: `https://www.facebook.com/${rest}` };
  }
  return /^[A-Za-z0-9.]{3,80}$/.test(trimmed) ? { ok: true, url: `https://www.facebook.com/${trimmed}` } : { ok: false };
}

/** Optional website: adds https:// when missing. null = empty, false = invalid. */
export function normalizeWebsite(input: string | null | undefined): string | null | false {
  const value = (input ?? '').trim();
  if (!value) return null;
  if (/\s/.test(value)) return false;
  const url = parseUrl(value);
  if (!url || !/^https?:$/.test(url.protocol) || !url.hostname.includes('.')) return false;
  return url.toString().replace(/\/$/, '');
}

/** "https://instagram.com/kelvin" → "@kelvin" for display. */
export function socialHandle(url: string): string {
  const u = parseUrl(url);
  if (!u) return url;
  const first = u.pathname.split('/').filter(Boolean)[0] ?? '';
  return first.startsWith('@') ? first : `@${first}`;
}
