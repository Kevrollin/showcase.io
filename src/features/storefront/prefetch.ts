import type { QueryClient } from '@tanstack/react-query';
import { storefrontItemQuery, storefrontItemsQuery, storefrontQuery } from './usePublicStorefront';

/**
 * Starts the storefront API requests at boot, in parallel with downloading
 * the route's JavaScript, instead of after it (saves a network round trip on
 * slow mobile connections). Only the common "plain link" case is prefetched.
 */
export function prefetchStorefrontRoute(queryClient: QueryClient, pathname: string, search: string): void {
  const match = /^\/s\/([^/]+)(?:\/([^/]+))?\/?$/.exec(pathname);
  if (!match) return;
  let slug: string;
  let itemSlug: string | undefined;
  try {
    slug = decodeURIComponent(match[1]!).toLowerCase();
    itemSlug = match[2] ? decodeURIComponent(match[2]).toLowerCase() : undefined;
  } catch {
    return;
  }

  void queryClient.prefetchQuery(storefrontQuery(slug));
  if (itemSlug) {
    void queryClient.prefetchQuery(storefrontItemQuery(slug, itemSlug));
    return;
  }
  const params = new URLSearchParams(search);
  if (!params.has('q') && !params.has('category') && !params.has('type')) {
    void queryClient.prefetchInfiniteQuery(storefrontItemsQuery(slug, { search: '', categoryId: null, itemType: null }));
  }
}
