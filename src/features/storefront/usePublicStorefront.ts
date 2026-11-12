import { infiniteQueryOptions, keepPreviousData, queryOptions, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/queryClient';
import type { ItemType } from '@/config/catalog';
import { fetchStorefront, fetchStorefrontItem, fetchStorefrontItems } from '@/services/storefront.service';

export interface ItemFilters {
  search: string;
  categoryId: string | null;
  itemType: ItemType | null;
}

// Shared option factories: the hooks and the boot-time prefetch must use
// identical keys so the prefetched data is reused.

export const storefrontQuery = (slug: string) =>
  queryOptions({
    queryKey: queryKeys.storefront(slug),
    queryFn: ({ signal }) => fetchStorefront(slug, signal),
    enabled: slug.length > 0,
  });

export const storefrontItemsQuery = (slug: string, filters: ItemFilters) =>
  infiniteQueryOptions({
    queryKey: queryKeys.storefrontItems(slug, { ...filters }),
    queryFn: ({ pageParam, signal }) =>
      fetchStorefrontItems({ slug, search: filters.search, categoryId: filters.categoryId, itemType: filters.itemType, offset: pageParam }, signal),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    enabled: slug.length > 0,
  });

export const storefrontItemQuery = (slug: string, itemSlug: string) =>
  queryOptions({
    queryKey: queryKeys.storefrontItem(slug, itemSlug),
    queryFn: ({ signal }) => fetchStorefrontItem(slug, itemSlug, signal),
    enabled: slug.length > 0 && itemSlug.length > 0,
  });

export function useStorefront(slug: string) {
  return useQuery(storefrontQuery(slug));
}

export function useStorefrontItems(slug: string, filters: ItemFilters) {
  return useInfiniteQuery({ ...storefrontItemsQuery(slug, filters), placeholderData: keepPreviousData });
}

export function useStorefrontItem(slug: string, itemSlug: string) {
  return useQuery(storefrontItemQuery(slug, itemSlug));
}
