/**
 * Public storefront reads. Uses the lightweight fetch client (no supabase-js)
 * and the SECURITY INVOKER RPCs, so anonymous visitors only ever receive
 * published data.
 */
import { STOREFRONT_PAGE_SIZE, type ItemType } from '@/config/catalog';
import { callPublicRpc } from '@/lib/supabase/publicApi';
import {
  parsePublicBusiness,
  parsePublicItemDetail,
  parsePublicItemSummary,
  type PublicBusiness,
  type PublicItemDetail,
  type PublicItemSummary,
} from '@/types/models';

export async function fetchStorefront(slug: string, signal?: AbortSignal): Promise<PublicBusiness | null> {
  const data = await callPublicRpc<unknown>('get_storefront', { p_slug: slug }, signal);
  return parsePublicBusiness(data);
}

export interface StorefrontItemsQuery {
  slug: string;
  search?: string;
  categoryId?: string | null;
  itemType?: ItemType | null;
  offset?: number;
  limit?: number;
}

export interface StorefrontItemsPage {
  items: PublicItemSummary[];
  total: number;
  nextOffset: number | null;
}

export async function fetchStorefrontItems(query: StorefrontItemsQuery, signal?: AbortSignal): Promise<StorefrontItemsPage> {
  const limit = query.limit ?? STOREFRONT_PAGE_SIZE;
  const offset = query.offset ?? 0;
  const rows = await callPublicRpc<unknown[]>(
    'get_storefront_items',
    {
      p_slug: query.slug,
      p_search: query.search?.trim() || null,
      p_category_id: query.categoryId ?? null,
      p_item_type: query.itemType ?? null,
      p_limit: limit,
      p_offset: offset,
    },
    signal,
  );
  const list = Array.isArray(rows) ? rows : [];
  const items = list.flatMap((row) => parsePublicItemSummary(row) ?? []);
  const first = list[0] as { total_count?: unknown } | undefined;
  const total = first ? Number(first.total_count ?? 0) : 0;
  const loaded = offset + items.length;
  return { items, total, nextOffset: loaded < total ? loaded : null };
}

export async function fetchStorefrontItem(slug: string, itemSlug: string, signal?: AbortSignal): Promise<PublicItemDetail | null> {
  const data = await callPublicRpc<unknown>('get_storefront_item', { p_slug: slug, p_item_slug: itemSlug }, signal);
  return parsePublicItemDetail(data);
}
