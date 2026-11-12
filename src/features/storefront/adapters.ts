import type { ItemType } from '@/config/catalog';
import type { Business, CatalogueItem, Category, PublicBusiness, PublicItemSummary } from '@/types/models';
import type { StorefrontFilters } from './components/StorefrontView';

/**
 * Builds the same shapes the public RPCs return from the owner's own data, so
 * previews render exactly what customers will see (published items only).
 */
export function toPreviewBusiness(business: Business, items: CatalogueItem[], categories: Category[]): PublicBusiness {
  const published = items.filter((i) => i.is_published);
  const itemTypes: Partial<Record<ItemType, number>> = {};
  for (const item of published) itemTypes[item.item_type] = (itemTypes[item.item_type] ?? 0) + 1;
  const counts = new Map<string, number>();
  for (const item of published) if (item.category_id) counts.set(item.category_id, (counts.get(item.category_id) ?? 0) + 1);

  return {
    id: business.id,
    name: business.name,
    slug: business.slug,
    description: business.description,
    tagline: business.tagline,
    business_type: business.business_type,
    category: business.category,
    location_label: business.location_label,
    whatsapp_number: business.whatsapp_number,
    phone_number: business.phone_number,
    contact_email: business.contact_email,
    instagram_url: business.instagram_url,
    tiktok_url: business.tiktok_url,
    facebook_url: business.facebook_url,
    website_url: business.website_url,
    logo_path: business.logo_path,
    cover_path: business.cover_path,
    share_image_path: business.share_image_path,
    theme_id: business.theme_id,
    accent_color: business.accent_color,
    item_count: published.length,
    item_types: itemTypes,
    categories: [...categories]
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      .filter((c) => counts.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, item_count: counts.get(c.id) ?? 0 })),
  };
}

export function toPreviewItem(item: CatalogueItem): PublicItemSummary {
  const first = item.images[0];
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    summary: item.description ? item.description.slice(0, 240) : null,
    item_type: item.item_type,
    category_id: item.category_id,
    price: item.price,
    currency: item.currency,
    price_mode: item.price_mode,
    availability_status: item.availability_status,
    is_featured: item.is_featured,
    image: first
      ? { path: first.storage_path, thumb_path: first.thumb_path, width: first.width, height: first.height, alt: first.alt_text }
      : null,
    image_count: item.images.length,
  };
}

/** Same ordering and filtering rules as get_storefront_items, done in memory. */
export function previewItems(items: CatalogueItem[], filters: StorefrontFilters): PublicItemSummary[] {
  const term = filters.search.trim().toLowerCase();
  return items
    .filter((i) => i.is_published)
    .filter((i) => !filters.categoryId || i.category_id === filters.categoryId)
    .filter((i) => !filters.itemType || i.item_type === filters.itemType)
    .filter((i) => !term || i.title.toLowerCase().includes(term) || (i.description ?? '').toLowerCase().includes(term))
    .sort(
      (a, b) =>
        Number(b.is_featured) - Number(a.is_featured) ||
        a.sort_order - b.sort_order ||
        b.created_at.localeCompare(a.created_at),
    )
    .map(toPreviewItem);
}
