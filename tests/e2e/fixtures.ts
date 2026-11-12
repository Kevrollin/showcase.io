/**
 * Fixture data and a small mock of the Supabase HTTP API (PostgREST RPCs,
 * Auth and Storage) used by the end-to-end tests. Shared by scripts/serve.ts
 * (the mock server) and the Playwright specs (assertions).
 *
 * The mock only returns what the real RPCs would return for anonymous users:
 * published storefronts and published items. Privacy rules themselves are
 * tested against real Postgres in tests/db.
 */

export const MOCK = {
  anonKey: 'e2e-anon-key',
  ownerId: '11111111-1111-4111-8111-111111111111',
  ownerEmail: 'owner@example.com',
  ownerPassword: 'correct-horse-9',
  businessId: '22222222-2222-4222-8222-222222222222',
} as const;

export const STORE = {
  id: MOCK.businessId,
  name: 'Campus Kicks',
  slug: 'campus-kicks',
  description: 'Original sneakers and streetwear, delivered around campus.',
  tagline: 'Fresh pairs every week',
  business_type: 'products',
  category: 'shoes',
  location_label: 'Egerton University, Njoro',
  whatsapp_number: '+254712345678',
  phone_number: '+254712345678',
  contact_email: null,
  instagram_url: 'https://instagram.com/campuskicks',
  tiktok_url: null,
  facebook_url: null,
  website_url: null,
  logo_path: null,
  cover_path: null,
  share_image_path: `${MOCK.ownerId}/${MOCK.businessId}/brand/share-33333333-3333-4333-8333-333333333333.jpg`,
  theme_id: 'shop',
  accent_color: 'terracotta',
};

export const CATEGORIES = [
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', name: 'Sneakers', sort_order: 0 },
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', name: 'Bags', sort_order: 1 },
];

interface FixtureItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  item_type: 'product' | 'service' | 'portfolio';
  category_id: string | null;
  price: number | null;
  price_mode: string;
  availability_status: string;
  is_featured: boolean;
  is_published: boolean;
  images: string[];
}

const img = (itemId: string, n: number) => `${MOCK.ownerId}/${MOCK.businessId}/${itemId}/${n}${n}${n}${n}${n}${n}${n}${n}-0000-4000-8000-000000000000.webp`;

export const ITEMS: FixtureItem[] = [
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    slug: 'nike-air-max-90',
    title: 'Nike Air Max 90',
    description: 'Classic runners in white and red. Sizes 40–45.',
    item_type: 'product',
    category_id: CATEGORIES[0]!.id,
    price: 4500,
    price_mode: 'fixed',
    availability_status: 'available',
    is_featured: true,
    is_published: true,
    images: [img('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 1), img('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 2)],
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    slug: 'canvas-tote-bag',
    title: 'Canvas Tote Bag',
    description: 'Holds all your books.',
    item_type: 'product',
    category_id: CATEGORIES[1]!.id,
    price: 1200,
    price_mode: 'fixed',
    availability_status: 'preorder',
    is_featured: false,
    is_published: true,
    images: [img('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 3)],
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
    slug: 'sneaker-cleaning',
    title: 'Sneaker Cleaning',
    description: 'Deep clean and restore your favourite pair.',
    item_type: 'product',
    category_id: CATEGORIES[0]!.id,
    price: 500,
    price_mode: 'starting_from',
    availability_status: 'available',
    is_featured: false,
    is_published: true,
    images: [],
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4',
    slug: 'secret-drop',
    title: 'Secret Drop',
    description: 'Not released yet.',
    item_type: 'product',
    category_id: null,
    price: null,
    price_mode: 'contact',
    availability_status: 'available',
    is_featured: false,
    is_published: false,
    images: [],
  },
];

export const PUBLISHED_ITEMS = ITEMS.filter((i) => i.is_published);

const imageJson = (path: string, i: number) => ({
  id: `cccccccc-cccc-4ccc-8ccc-${String(i).padStart(12, '0')}`,
  path,
  thumb_path: path.replace('.webp', '-thumb.webp'),
  width: 1200,
  height: 1200,
  alt: null,
});

export function storefrontJson(slug: string) {
  if (slug !== STORE.slug) return null;
  const published = PUBLISHED_ITEMS;
  return {
    ...STORE,
    item_count: published.length,
    item_types: { product: published.length },
    categories: CATEGORIES.map((c) => ({ id: c.id, name: c.name, item_count: published.filter((i) => i.category_id === c.id).length })).filter(
      (c) => c.item_count > 0,
    ),
  };
}

export function storefrontItemsJson(args: { p_slug?: string; p_search?: string | null; p_category_id?: string | null; p_item_type?: string | null; p_limit?: number; p_offset?: number }) {
  if (args.p_slug !== STORE.slug) return [];
  const term = (args.p_search ?? '').trim().toLowerCase();
  const rows = PUBLISHED_ITEMS.filter(
    (i) =>
      (!args.p_category_id || i.category_id === args.p_category_id) &&
      (!args.p_item_type || i.item_type === args.p_item_type) &&
      (!term || i.title.toLowerCase().includes(term) || i.description.toLowerCase().includes(term)),
  ).sort((a, b) => Number(b.is_featured) - Number(a.is_featured));
  const offset = args.p_offset ?? 0;
  const limit = args.p_limit ?? 24;
  return rows.slice(offset, offset + limit).map((i) => ({
    id: i.id,
    slug: i.slug,
    title: i.title,
    summary: i.description,
    item_type: i.item_type,
    category_id: i.category_id,
    price: i.price,
    currency: 'KES',
    price_mode: i.price_mode,
    availability_status: i.availability_status,
    is_featured: i.is_featured,
    image: i.images[0] ? imageJson(i.images[0], 0) : null,
    image_count: i.images.length,
    total_count: rows.length,
  }));
}

export function storefrontItemJson(slug: string, itemSlug: string) {
  if (slug !== STORE.slug) return null;
  const item = PUBLISHED_ITEMS.find((i) => i.slug === itemSlug);
  if (!item) return null;
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    description: item.description,
    item_type: item.item_type,
    category_id: item.category_id,
    category_name: CATEGORIES.find((c) => c.id === item.category_id)?.name ?? null,
    price: item.price,
    currency: 'KES',
    price_mode: item.price_mode,
    availability_status: item.availability_status,
    is_featured: item.is_featured,
    images: item.images.map(imageJson),
  };
}

// ─── Owner-side rows (what PostgREST returns to the signed-in owner) ─────────

export function businessRow() {
  return {
    ...STORE,
    owner_id: MOCK.ownerId,
    status: 'published',
    published_at: '2026-11-01T10:00:00Z',
    onboarding_step: 6,
    onboarding_completed_at: '2026-11-01T10:00:00Z',
    created_at: '2026-11-01T09:00:00Z',
    updated_at: '2026-11-01T10:00:00Z',
  };
}

export function itemRows() {
  return ITEMS.map((i, index) => ({
    id: i.id,
    business_id: MOCK.businessId,
    category_id: i.category_id,
    item_type: i.item_type,
    title: i.title,
    slug: i.slug,
    description: i.description,
    price: i.price,
    currency: 'KES',
    price_mode: i.price_mode,
    availability_status: i.availability_status,
    is_featured: i.is_featured,
    is_published: i.is_published,
    sort_order: index,
    created_at: '2026-11-01T09:30:00Z',
    updated_at: '2026-11-01T09:30:00Z',
    catalogue_images: i.images.map((path, n) => ({
      id: `dddddddd-dddd-4ddd-8ddd-${String(index * 10 + n).padStart(12, '0')}`,
      item_id: i.id,
      storage_path: path,
      thumb_path: path.replace('.webp', '-thumb.webp'),
      width: 1200,
      height: 1200,
      alt_text: i.title,
      sort_order: n,
      byte_size: 180000,
    })),
  }));
}

export function categoryRows() {
  return CATEGORIES.map((c) => ({ ...c, business_id: MOCK.businessId }));
}

function base64url(value: string): string {
  return Buffer.from(value).toString('base64url');
}

/** A signed-in session; `google` mimics an account that signed in with Google. */
export function sessionJson({ google = false }: { google?: boolean } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const signedInAt = new Date().toISOString();
  const user = {
    id: MOCK.ownerId,
    aud: 'authenticated',
    role: 'authenticated',
    email: MOCK.ownerEmail,
    email_confirmed_at: '2026-11-01T09:00:00Z',
    user_metadata: { full_name: 'Wanjiru Kamau' },
    app_metadata: google ? { provider: 'google', providers: ['google'] } : { provider: 'email', providers: ['email'] },
    identities: google
      ? [{ id: 'google-identity', identity_id: 'google-identity', provider: 'google', user_id: MOCK.ownerId }]
      : [{ id: MOCK.ownerId, provider: 'email' }],
    last_sign_in_at: signedInAt,
    created_at: '2026-11-01T09:00:00Z',
  };
  const amr = [{ method: google ? 'oauth' : 'password', timestamp: now }];
  const payload = { sub: MOCK.ownerId, email: MOCK.ownerEmail, role: 'authenticated', aud: 'authenticated', exp: now + 3600, iat: now, amr };
  const accessToken = `${base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64url(JSON.stringify(payload))}.signature`;
  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: 'e2e-refresh-token',
    user,
  };
}
