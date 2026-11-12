import { env } from '@/lib/env';
import { BRAND } from './brand';

/**
 * Canonical origin of the app (no trailing slash). Production builds use
 * VITE_SITE_URL so shared links and QR codes are stable. The dev server always
 * uses its own origin, so links work locally even before the production
 * domain is deployed.
 */
export function siteOrigin(): string {
  if (env.siteUrl && !import.meta.env.DEV) return env.siteUrl;
  if (typeof window !== 'undefined') return window.location.origin;
  return env.siteUrl;
}

export function absoluteUrl(path: string): string {
  return `${siteOrigin()}${path.startsWith('/') ? path : `/${path}`}`;
}

export function storefrontPath(slug: string): string {
  return `${BRAND.storefrontPrefix}/${encodeURIComponent(slug)}`;
}

export function itemPath(slug: string, itemSlug: string): string {
  return `${storefrontPath(slug)}/${encodeURIComponent(itemSlug)}`;
}

export function storefrontUrl(slug: string): string {
  return absoluteUrl(storefrontPath(slug));
}

export function itemUrl(slug: string, itemSlug: string): string {
  return absoluteUrl(itemPath(slug, itemSlug));
}

/** URL without the protocol, for display: "showcase.app/s/kelvin-designs". */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

/** Public contact address for the marketing footer and legal pages (optional). */
export const CONTACT_EMAIL = env.contactEmail;

/** Only allow same-origin relative redirects (prevents open redirects). */
export function safeRedirect(value: string | null | undefined, fallback = '/dashboard'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  return value;
}
