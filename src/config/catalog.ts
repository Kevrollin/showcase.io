/**
 * Product vocabulary shared by onboarding, the dashboard and the storefront.
 *
 * Values that are also enforced by database CHECK constraints (business types,
 * item types, price modes, availability, themes, accent colours) are covered by
 * tests/db/storefront.test.ts so the two can never drift apart silently.
 */

export const BUSINESS_TYPES = ['products', 'services', 'portfolio', 'mixed'] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const ITEM_TYPES = ['product', 'service', 'portfolio'] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const PRICE_MODES = ['fixed', 'starting_from', 'quote', 'contact', 'none'] as const;
export type PriceMode = (typeof PRICE_MODES)[number];

export const AVAILABILITY_STATUSES = ['available', 'unavailable', 'preorder'] as const;
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

export const BUSINESS_STATUSES = ['draft', 'published', 'unpublished'] as const;
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];

export const DEFAULT_CURRENCY = 'KES';

/** Copy that changes with what the business showcases. */
export interface BusinessTypeCopy {
  label: string;
  description: string;
  defaultItemType: ItemType;
  /** Singular noun for one entry, e.g. "product". */
  itemNoun: string;
  itemNounPlural: string;
  /** Name of the catalogue in navigation, e.g. "My products". */
  catalogueLabel: string;
}

export const BUSINESS_TYPE_COPY: Record<BusinessType, BusinessTypeCopy> = {
  products: {
    label: 'Products',
    description: 'Clothes, shoes, food, electronics or anything else you sell.',
    defaultItemType: 'product',
    itemNoun: 'product',
    itemNounPlural: 'products',
    catalogueLabel: 'My products',
  },
  services: {
    label: 'Services',
    description: 'Design, photography, haircuts, tutoring, repairs and more.',
    defaultItemType: 'service',
    itemNoun: 'service',
    itemNounPlural: 'services',
    catalogueLabel: 'My services',
  },
  portfolio: {
    label: 'Portfolio / previous work',
    description: 'Show projects you have done so clients can see your style.',
    defaultItemType: 'portfolio',
    itemNoun: 'project',
    itemNounPlural: 'projects',
    catalogueLabel: 'My portfolio',
  },
  mixed: {
    label: 'Products and services',
    description: 'Sell products and offer services from the same storefront.',
    defaultItemType: 'product',
    itemNoun: 'item',
    itemNounPlural: 'items',
    catalogueLabel: 'My catalogue',
  },
};

export const ITEM_TYPE_LABELS: Record<ItemType, { label: string; plural: string }> = {
  product: { label: 'Product', plural: 'Products' },
  service: { label: 'Service', plural: 'Services' },
  portfolio: { label: 'Project', plural: 'Work' },
};

export const PRICE_MODE_OPTIONS: Record<PriceMode, { label: string; hint: string; needsPrice: boolean }> = {
  fixed: { label: 'Fixed price', hint: 'e.g. KES 500', needsPrice: true },
  starting_from: { label: 'Starting from', hint: 'e.g. From KES 1,500', needsPrice: true },
  quote: { label: 'Request a quote', hint: 'Customers ask you for a quotation', needsPrice: false },
  contact: { label: 'Contact for price', hint: 'Shows “Price on request”', needsPrice: false },
  none: { label: 'Don’t show a price', hint: 'Good for portfolio work', needsPrice: false },
};

/** Price modes offered per item type, first one is the default. */
export const PRICE_MODES_BY_ITEM_TYPE: Record<ItemType, PriceMode[]> = {
  product: ['fixed', 'starting_from', 'contact'],
  service: ['starting_from', 'fixed', 'quote', 'contact', 'none'],
  portfolio: ['none', 'starting_from', 'quote', 'contact'],
};

export const AVAILABILITY_LABELS: Record<ItemType, Partial<Record<AvailabilityStatus, string>>> = {
  product: { available: 'In stock', unavailable: 'Out of stock', preorder: 'Pre-order' },
  service: { available: 'Available', unavailable: 'Currently unavailable', preorder: 'Booking ahead' },
  portfolio: {},
};

export interface CategoryOption {
  id: string;
  label: string;
  group: 'Products' | 'Services' | 'Creative';
}

export const BUSINESS_CATEGORIES: CategoryOption[] = [
  { id: 'fashion', label: 'Fashion & clothing', group: 'Products' },
  { id: 'shoes', label: 'Shoes', group: 'Products' },
  { id: 'accessories', label: 'Accessories & jewellery', group: 'Products' },
  { id: 'electronics', label: 'Electronics & gadgets', group: 'Products' },
  { id: 'food', label: 'Food, cakes & snacks', group: 'Products' },
  { id: 'beauty', label: 'Beauty & cosmetics', group: 'Products' },
  { id: 'books', label: 'Books & stationery', group: 'Products' },
  { id: 'handmade', label: 'Handmade & crafts', group: 'Products' },
  { id: 'retail', label: 'Other products', group: 'Products' },
  { id: 'graphic-design', label: 'Graphic design', group: 'Services' },
  { id: 'printing', label: 'Printing & cyber services', group: 'Services' },
  { id: 'photography', label: 'Photography', group: 'Services' },
  { id: 'videography', label: 'Videography', group: 'Services' },
  { id: 'barber-salon', label: 'Barber & salon', group: 'Services' },
  { id: 'makeup', label: 'Makeup & beauty services', group: 'Services' },
  { id: 'tutoring', label: 'Tutoring & lessons', group: 'Services' },
  { id: 'web-development', label: 'Web & software development', group: 'Services' },
  { id: 'events', label: 'Events & decor', group: 'Services' },
  { id: 'cleaning', label: 'Cleaning & laundry', group: 'Services' },
  { id: 'repairs', label: 'Repairs & technicians', group: 'Services' },
  { id: 'services', label: 'Other services', group: 'Services' },
  { id: 'creative-agency', label: 'Creative agency', group: 'Creative' },
  { id: 'branding', label: 'Branding', group: 'Creative' },
  { id: 'art', label: 'Art & illustration', group: 'Creative' },
];

export function categoryLabel(id: string | null | undefined): string | null {
  if (!id) return null;
  return BUSINESS_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

// ─── Storefront appearance ───────────────────────────────────────────────────

export type ThemeId = 'minimal' | 'creative' | 'shop' | 'studio';

export interface StorefrontTheme {
  id: ThemeId;
  label: string;
  description: string;
  /** Card layout used for the catalogue. */
  layout: 'grid' | 'list';
  /** CSS aspect-ratio for catalogue images. */
  imageAspect: '1 / 1' | '4 / 5' | '4 / 3';
  /** Header composition. */
  header: 'centered' | 'cover' | 'split';
}

export const STOREFRONT_THEMES: StorefrontTheme[] = [
  { id: 'minimal', label: 'Minimal', description: 'Clean and calm. Works for any business.', layout: 'grid', imageAspect: '1 / 1', header: 'centered' },
  { id: 'shop', label: 'Shop', description: 'Compact product grid with prices up front.', layout: 'grid', imageAspect: '1 / 1', header: 'split' },
  { id: 'creative', label: 'Creative', description: 'Large portrait images for photographers and designers.', layout: 'grid', imageAspect: '4 / 5', header: 'cover' },
  { id: 'studio', label: 'Studio', description: 'Readable list for service professionals.', layout: 'list', imageAspect: '4 / 3', header: 'cover' },
];

export function getTheme(id: string | null | undefined): StorefrontTheme {
  return STOREFRONT_THEMES.find((t) => t.id === id) ?? STOREFRONT_THEMES[0]!;
}

export type AccentId = 'navy' | 'forest' | 'terracotta' | 'ocean' | 'gold' | 'charcoal' | 'rose' | 'teal';

export interface AccentColor {
  id: AccentId;
  label: string;
  /** Solid colour; white text on it meets WCAG AA (≥ 4.5:1). */
  value: string;
  /** Very light tint for backgrounds. */
  tint: string;
}

export const ACCENT_COLORS: AccentColor[] = [
  { id: 'navy', label: 'Navy', value: '#1F2A44', tint: '#EEF0F5' },
  { id: 'forest', label: 'Forest', value: '#2E5E4E', tint: '#EBF2EF' },
  { id: 'teal', label: 'Teal', value: '#1F6F6B', tint: '#E8F3F2' },
  { id: 'ocean', label: 'Ocean', value: '#1D5B85', tint: '#E9F1F7' },
  { id: 'terracotta', label: 'Terracotta', value: '#A4472A', tint: '#F8EDE8' },
  { id: 'rose', label: 'Rose', value: '#A23E58', tint: '#F8ECEF' },
  { id: 'gold', label: 'Gold', value: '#8A6A1F', tint: '#F6F0E2' },
  { id: 'charcoal', label: 'Charcoal', value: '#2B2D31', tint: '#EFEFF0' },
];

export function getAccent(id: string | null | undefined): AccentColor {
  return ACCENT_COLORS.find((a) => a.id === id) ?? ACCENT_COLORS[0]!;
}

// ─── Media pipeline ──────────────────────────────────────────────────────────

export const MEDIA = {
  bucket: 'catalog-media',
  acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
  /** Largest original file we accept before compression (phone cameras). */
  maxInputBytes: 25 * 1024 * 1024,
  /** Long edge of the main image. */
  maxDimension: 1600,
  /** Long edge of the card thumbnail. */
  thumbDimension: 640,
  logoDimension: 512,
  /** Covers fill a full-width hero, so they keep more resolution. */
  coverDimension: 2000,
  /** Social preview image (Open Graph). */
  shareImage: { width: 1200, height: 630 },
  /** Aim for this size where quality permits. */
  targetBytes: 700 * 1024,
  /** Hard cap after compression (bucket limit is 2 MB). */
  maxOutputBytes: 1536 * 1024,
} as const;

export const STOREFRONT_PAGE_SIZE = 24;
