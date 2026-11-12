import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { ITEM_TYPES, type ItemType } from '@/config/catalog';
import { itemPath, storefrontUrl } from '@/config/site';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePageMeta } from '@/hooks/usePageMeta';
import { publicMediaUrl } from '@/lib/supabase/publicApi';
import { StorefrontView, type StorefrontFilters } from './components/StorefrontView';
import { StorefrontSkeleton, StorefrontUnavailable } from './components/StorefrontStates';
import { useStorefront, useStorefrontItems } from './usePublicStorefront';

function parseType(value: string | null): ItemType | null {
  return value && (ITEM_TYPES as readonly string[]).includes(value) ? (value as ItemType) : null;
}

export function Component() {
  const { slug: rawSlug = '' } = useParams();
  const slug = rawSlug.toLowerCase();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const debouncedSearch = useDebouncedValue(search.trim(), 350);

  const categoryId = params.get('category');
  const itemType = parseType(params.get('type'));

  const storefront = useStorefront(slug);
  const items = useStorefrontItems(slug, { search: debouncedSearch, categoryId, itemType });
  const business = storefront.data;

  usePageMeta({
    title: business?.name ?? (storefront.isPending ? undefined : 'Storefront not found'),
    description: business ? (business.description ?? business.tagline ?? `Browse ${business.name}'s catalogue and chat on WhatsApp.`) : undefined,
    canonical: business ? storefrontUrl(business.slug) : undefined,
    image: business ? publicMediaUrl(business.share_image_path ?? business.logo_path) : undefined,
    noindex: !business,
  });

  const flatItems = useMemo(() => items.data?.pages.flatMap((p) => p.items) ?? [], [items.data]);
  const total = items.data?.pages[0]?.total ?? 0;

  if (storefront.isPending) return <StorefrontSkeleton />;
  if (storefront.isError) return <StorefrontUnavailable kind="error" onRetry={() => void storefront.refetch()} />;
  if (!business) return <StorefrontUnavailable kind="not-found" />;

  function onFiltersChange(next: StorefrontFilters) {
    setSearch(next.search);
    setParams(
      (current) => {
        const p = new URLSearchParams(current);
        if (next.categoryId) p.set('category', next.categoryId);
        else p.delete('category');
        if (next.itemType) p.set('type', next.itemType);
        else p.delete('type');
        if (next.search.trim()) p.set('q', next.search.trim());
        else p.delete('q');
        return p;
      },
      { replace: true, preventScrollReset: true },
    );
  }

  return (
    <StorefrontView
      business={business}
      items={flatItems}
      total={total}
      status={items.isPending ? 'loading' : items.isError && flatItems.length === 0 ? 'error' : 'ready'}
      filters={{ search, categoryId, itemType }}
      onFiltersChange={onFiltersChange}
      hasMore={items.hasNextPage}
      loadingMore={items.isFetchingNextPage}
      onLoadMore={() => void items.fetchNextPage()}
      onRetry={() => void items.refetch()}
      itemHref={(item) => itemPath(business.slug, item.slug)}
    />
  );
}
