import { useEffect } from 'react';
import { BRAND } from '@/config/brand';

export interface PageMeta {
  title?: string;
  description?: string;
  canonical?: string;
  image?: string | null;
  noindex?: boolean;
}

function upsertMeta(selector: string, attrs: Record<string, string>, content: string | null) {
  let el = document.head.querySelector<HTMLMetaElement | HTMLLinkElement>(selector);
  if (content === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement(attrs.rel ? 'link' : 'meta') as HTMLMetaElement | HTMLLinkElement;
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    document.head.appendChild(el);
  }
  el.setAttribute(attrs.rel ? 'href' : 'content', content);
}

/**
 * Keeps <title>, description, canonical and Open Graph tags in sync for
 * browsers. Social crawlers get server-rendered tags from api/share-preview.
 */
export function usePageMeta({ title, description, canonical, image, noindex }: PageMeta): void {
  useEffect(() => {
    const fullTitle = title ? `${title} · ${BRAND.name}` : `${BRAND.name} — ${BRAND.promise}`;
    document.title = fullTitle;
    const desc = description ?? BRAND.shortDescription;
    upsertMeta('meta[name="description"]', { name: 'description' }, desc);
    upsertMeta('meta[property="og:title"]', { property: 'og:title' }, title ?? BRAND.name);
    upsertMeta('meta[property="og:description"]', { property: 'og:description' }, desc);
    upsertMeta('link[rel="canonical"]', { rel: 'canonical' }, canonical ?? null);
    upsertMeta('meta[property="og:url"]', { property: 'og:url' }, canonical ?? null);
    if (image !== undefined) upsertMeta('meta[property="og:image"]', { property: 'og:image' }, image);
    upsertMeta('meta[name="robots"]', { name: 'robots' }, noindex ? 'noindex, nofollow' : null);
  }, [title, description, canonical, image, noindex]);
}
