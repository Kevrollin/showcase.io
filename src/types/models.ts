import {
  ACCENT_COLORS,
  AVAILABILITY_STATUSES,
  BUSINESS_STATUSES,
  BUSINESS_TYPES,
  ITEM_TYPES,
  PRICE_MODES,
  STOREFRONT_THEMES,
  type AccentId,
  type AvailabilityStatus,
  type BusinessStatus,
  type BusinessType,
  type ItemType,
  type PriceMode,
  type ThemeId,
} from '@/config/catalog';
import type { Tables } from './database';

/** Narrows a DB text column to a known union, with a safe fallback. */
export function oneOf<T extends string>(values: readonly T[], value: unknown, fallback: T): T {
  return typeof value === 'string' && (values as readonly string[]).includes(value) ? (value as T) : fallback;
}

const THEME_IDS = STOREFRONT_THEMES.map((t) => t.id);
const ACCENT_IDS = ACCENT_COLORS.map((a) => a.id);

// ─── Owner-side models ───────────────────────────────────────────────────────

type BusinessRow = Tables<'businesses'>;

export interface Business extends Omit<BusinessRow, 'business_type' | 'status' | 'theme_id' | 'accent_color'> {
  business_type: BusinessType;
  status: BusinessStatus;
  theme_id: ThemeId;
  accent_color: AccentId;
}

export function toBusiness(row: BusinessRow): Business {
  return {
    ...row,
    business_type: oneOf(BUSINESS_TYPES, row.business_type, 'products'),
    status: oneOf(BUSINESS_STATUSES, row.status, 'draft'),
    theme_id: oneOf(THEME_IDS, row.theme_id, 'minimal'),
    accent_color: oneOf(ACCENT_IDS, row.accent_color, 'navy'),
  };
}

export type CatalogueImage = Pick<
  Tables<'catalogue_images'>,
  'id' | 'item_id' | 'storage_path' | 'thumb_path' | 'width' | 'height' | 'alt_text' | 'sort_order' | 'byte_size'
>;

type ItemRow = Tables<'catalogue_items'>;

export interface CatalogueItem extends Omit<ItemRow, 'item_type' | 'price_mode' | 'availability_status' | 'price'> {
  item_type: ItemType;
  price_mode: PriceMode;
  availability_status: AvailabilityStatus;
  price: number | null;
  images: CatalogueImage[];
}

export function toCatalogueItem(row: ItemRow & { catalogue_images?: CatalogueImage[] | null }): CatalogueItem {
  const { catalogue_images, ...rest } = row;
  return {
    ...rest,
    item_type: oneOf(ITEM_TYPES, row.item_type, 'product'),
    price_mode: oneOf(PRICE_MODES, row.price_mode, 'contact'),
    availability_status: oneOf(AVAILABILITY_STATUSES, row.availability_status, 'available'),
    price: row.price === null ? null : Number(row.price),
    images: [...(catalogue_images ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  };
}

export type Category = Pick<Tables<'categories'>, 'id' | 'business_id' | 'name' | 'sort_order'>;

export interface Plan {
  id: string;
  name: string;
  max_businesses: number;
  max_published_businesses: number;
  max_items_per_business: number;
  max_images_per_item: number;
}

// ─── Public storefront models (shape returned by the get_storefront* RPCs) ──

export interface PublicImage {
  id?: string;
  path: string;
  thumb_path: string | null;
  width: number | null;
  height: number | null;
  alt: string | null;
}

export interface PublicCategory {
  id: string;
  name: string;
  item_count: number;
}

export interface PublicBusiness {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  tagline: string | null;
  business_type: BusinessType;
  category: string | null;
  location_label: string | null;
  whatsapp_number: string | null;
  phone_number: string | null;
  contact_email: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  facebook_url: string | null;
  website_url: string | null;
  logo_path: string | null;
  cover_path: string | null;
  share_image_path: string | null;
  theme_id: ThemeId;
  accent_color: AccentId;
  item_count: number;
  item_types: Partial<Record<ItemType, number>>;
  categories: PublicCategory[];
}

export interface PublicItemSummary {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  item_type: ItemType;
  category_id: string | null;
  price: number | null;
  currency: string;
  price_mode: PriceMode;
  availability_status: AvailabilityStatus;
  is_featured: boolean;
  image: PublicImage | null;
  image_count: number;
}

export interface PublicItemDetail extends Omit<PublicItemSummary, 'summary' | 'image' | 'image_count'> {
  description: string | null;
  category_name: string | null;
  images: PublicImage[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toPublicImage(value: unknown): PublicImage | null {
  if (!isRecord(value) || typeof value.path !== 'string') return null;
  return {
    id: text(value.id) ?? undefined,
    path: value.path,
    thumb_path: text(value.thumb_path),
    width: num(value.width),
    height: num(value.height),
    alt: text(value.alt),
  };
}

/** Validates and narrows the JSON returned by get_storefront. */
export function parsePublicBusiness(value: unknown): PublicBusiness | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.slug !== 'string') {
    return null;
  }
  const itemTypes: Partial<Record<ItemType, number>> = {};
  if (isRecord(value.item_types)) {
    for (const type of ITEM_TYPES) {
      const n = num(value.item_types[type]);
      if (n) itemTypes[type] = n;
    }
  }
  const categories = Array.isArray(value.categories)
    ? value.categories.flatMap((c): PublicCategory[] =>
        isRecord(c) && typeof c.id === 'string' && typeof c.name === 'string'
          ? [{ id: c.id, name: c.name, item_count: num(c.item_count) ?? 0 }]
          : [],
      )
    : [];
  return {
    id: value.id,
    name: value.name,
    slug: value.slug,
    description: text(value.description),
    tagline: text(value.tagline),
    business_type: oneOf(BUSINESS_TYPES, value.business_type, 'products'),
    category: text(value.category),
    location_label: text(value.location_label),
    whatsapp_number: text(value.whatsapp_number),
    phone_number: text(value.phone_number),
    contact_email: text(value.contact_email),
    instagram_url: text(value.instagram_url),
    tiktok_url: text(value.tiktok_url),
    facebook_url: text(value.facebook_url),
    website_url: text(value.website_url),
    logo_path: text(value.logo_path),
    cover_path: text(value.cover_path),
    share_image_path: text(value.share_image_path),
    theme_id: oneOf(THEME_IDS, value.theme_id, 'minimal'),
    accent_color: oneOf(ACCENT_IDS, value.accent_color, 'navy'),
    item_count: num(value.item_count) ?? 0,
    item_types: itemTypes,
    categories,
  };
}

export function parsePublicItemSummary(value: unknown): PublicItemSummary | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.title !== 'string') return null;
  return {
    id: value.id,
    slug: String(value.slug ?? ''),
    title: value.title,
    summary: text(value.summary),
    item_type: oneOf(ITEM_TYPES, value.item_type, 'product'),
    category_id: text(value.category_id),
    price: num(value.price),
    currency: text(value.currency) ?? 'KES',
    price_mode: oneOf(PRICE_MODES, value.price_mode, 'contact'),
    availability_status: oneOf(AVAILABILITY_STATUSES, value.availability_status, 'available'),
    is_featured: value.is_featured === true,
    image: toPublicImage(value.image),
    image_count: num(value.image_count) ?? 0,
  };
}

export function parsePublicItemDetail(value: unknown): PublicItemDetail | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.title !== 'string') return null;
  return {
    id: value.id,
    slug: String(value.slug ?? ''),
    title: value.title,
    description: text(value.description),
    item_type: oneOf(ITEM_TYPES, value.item_type, 'product'),
    category_id: text(value.category_id),
    category_name: text(value.category_name),
    price: num(value.price),
    currency: text(value.currency) ?? 'KES',
    price_mode: oneOf(PRICE_MODES, value.price_mode, 'contact'),
    availability_status: oneOf(AVAILABILITY_STATUSES, value.availability_status, 'available'),
    is_featured: value.is_featured === true,
    images: Array.isArray(value.images) ? value.images.flatMap((im) => toPublicImage(im) ?? []) : [],
  };
}
