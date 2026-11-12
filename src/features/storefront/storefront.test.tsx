import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { Business, CatalogueItem, Category, PublicBusiness, PublicItemSummary } from '@/types/models';
import { previewItems, toPreviewBusiness } from './adapters';
import { StorefrontView, type StorefrontFilters } from './components/StorefrontView';

const business: PublicBusiness = {
  id: 'b1',
  name: 'Kelvin Designs',
  slug: 'kelvin-designs',
  description: 'Creative graphic design, branding and printing services.',
  tagline: null,
  business_type: 'mixed',
  category: 'graphic-design',
  location_label: 'Egerton University / Njoro',
  whatsapp_number: '+254712345678',
  phone_number: null,
  contact_email: 'hello@kelvin.example',
  instagram_url: 'https://instagram.com/kelvin',
  tiktok_url: null,
  facebook_url: null,
  website_url: null,
  logo_path: null,
  cover_path: null,
  share_image_path: null,
  theme_id: 'minimal',
  accent_color: 'navy',
  item_count: 3,
  item_types: { service: 2, product: 1 },
  categories: [
    { id: 'c1', name: 'Logos', item_count: 1 },
    { id: 'c2', name: 'Printing', item_count: 1 },
  ],
};

function item(partial: Partial<PublicItemSummary> & Pick<PublicItemSummary, 'id' | 'title'>): PublicItemSummary {
  return {
    slug: partial.id,
    summary: null,
    item_type: 'service',
    category_id: null,
    price: null,
    currency: 'KES',
    price_mode: 'quote',
    availability_status: 'available',
    is_featured: false,
    image: null,
    image_count: 0,
    ...partial,
  };
}

const items = [
  item({ id: 'logo', title: 'Logo design', price: 1500, price_mode: 'starting_from', is_featured: true, category_id: 'c1' }),
  item({ id: 'brand', title: 'Brand identity', price_mode: 'quote' }),
  item({ id: 'cards', title: 'Business cards', item_type: 'product', price: 500, price_mode: 'fixed', availability_status: 'unavailable', category_id: 'c2' }),
];

const noFilters: StorefrontFilters = { search: '', categoryId: null, itemType: null };

function renderView(overrides: Partial<Parameters<typeof StorefrontView>[0]> = {}) {
  const onFiltersChange = vi.fn();
  render(
    <MemoryRouter>
      <StorefrontView
        business={business}
        items={items}
        total={items.length}
        status="ready"
        filters={noFilters}
        onFiltersChange={onFiltersChange}
        itemHref={(i) => `/s/kelvin-designs/${i.slug}`}
        {...overrides}
      />
    </MemoryRouter>,
  );
  return { onFiltersChange };
}

describe('StorefrontView', () => {
  it('shows the business header, category and location', () => {
    renderView();
    const header = within(screen.getByRole('banner'));
    expect(header.getByRole('heading', { level: 1, name: 'Kelvin Designs' })).toBeInTheDocument();
    expect(header.getByText('Creative graphic design, branding and printing services.')).toBeInTheDocument();
    expect(header.getByText('Graphic design')).toBeInTheDocument();
    expect(header.getByText('Egerton University / Njoro')).toBeInTheDocument();
  });

  it('links WhatsApp with a prefilled message and only shows configured channels', () => {
    renderView();
    const whatsapp = screen.getAllByRole('link', { name: /chat on whatsapp/i })[0]!;
    expect(whatsapp).toHaveAttribute('href', expect.stringMatching(/^https:\/\/wa\.me\/254712345678\?text=Hi%20Kelvin%20Designs/));
    expect(whatsapp).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: 'Email' })).toHaveAttribute('href', 'mailto:hello@kelvin.example');
    expect(screen.getByRole('link', { name: 'Instagram' })).toHaveAttribute('href', 'https://instagram.com/kelvin');
    expect(screen.queryByRole('link', { name: 'TikTok' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Call' })).not.toBeInTheDocument();
  });

  it('renders item cards with formatted prices, availability and links', () => {
    renderView();
    const logo = screen.getByRole('link', { name: /logo design/i });
    expect(logo).toHaveAttribute('href', '/s/kelvin-designs/logo');
    expect(within(logo).getByText('From KES 1,500')).toBeInTheDocument();
    expect(within(logo).getByText('Featured')).toBeInTheDocument();
    expect(within(screen.getByRole('link', { name: /brand identity/i })).getByText('Request a quote')).toBeInTheDocument();
    const cards = screen.getByRole('link', { name: /business cards/i });
    expect(within(cards).getByText('KES 500')).toBeInTheDocument();
    expect(within(cards).getByText('Out of stock')).toBeInTheDocument();
  });

  it('offers category and type filters', async () => {
    const user = userEvent.setup();
    const { onFiltersChange } = renderView();
    await user.click(screen.getByRole('button', { name: /printing/i }));
    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...noFilters, categoryId: 'c2' });
    await user.click(within(screen.getByRole('group', { name: 'Filter by type' })).getByRole('button', { name: 'Products' }));
    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...noFilters, itemType: 'product' });
  });

  it('only shows search for larger catalogues', () => {
    renderView();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('shows search and clearable empty results for larger catalogues', async () => {
    const user = userEvent.setup();
    const { onFiltersChange } = renderView({
      business: { ...business, item_count: 30 },
      items: [],
      total: 0,
      filters: { ...noFilters, search: 'zzz' },
    });
    expect(screen.getByRole('searchbox', { name: /search items/i })).toHaveValue('zzz');
    expect(screen.getByText('Nothing matches your search')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onFiltersChange).toHaveBeenLastCalledWith(noFilters);
  });

  it('shows a friendly empty state for a new storefront', () => {
    renderView({ items: [], total: 0, business: { ...business, item_count: 0, categories: [], item_types: {} } });
    expect(screen.getByText('No items yet')).toBeInTheDocument();
  });

  it('shows a retry option when items fail to load', async () => {
    const onRetry = vi.fn();
    renderView({ status: 'error', onRetry });
    await userEvent.setup().click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('preview adapters', () => {
  const owner = {
    id: 'b1', owner_id: 'u1', name: 'Kelvin Designs', slug: 'kelvin-designs', description: null, tagline: null,
    business_type: 'products', category: null, location_label: null, whatsapp_number: null, phone_number: null,
    contact_email: null, instagram_url: null, tiktok_url: null, facebook_url: null, website_url: null, logo_path: null,
    cover_path: null, share_image_path: null, theme_id: 'shop', accent_color: 'navy', status: 'draft', published_at: null,
    onboarding_step: 6, onboarding_completed_at: null, created_at: '2026-01-01', updated_at: '2026-01-01',
  } satisfies Business;
  const row = (id: string, extra: Partial<CatalogueItem>): CatalogueItem => ({
    id, business_id: 'b1', category_id: null, item_type: 'product', title: id, slug: id, description: null, price: 100,
    currency: 'KES', price_mode: 'fixed', availability_status: 'available', is_featured: false, is_published: true,
    sort_order: 0, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01', images: [], ...extra,
  });
  const categories: Category[] = [{ id: 'c1', business_id: 'b1', name: 'Shoes', sort_order: 0 }];
  const rows = [
    row('second', { sort_order: 2, category_id: 'c1' }),
    row('hidden', { is_published: false, category_id: 'c1' }),
    row('first', { sort_order: 1 }),
    row('star', { sort_order: 5, is_featured: true }),
  ];

  it('shows customers exactly the published items, featured first', () => {
    expect(previewItems(rows, noFilters).map((i) => i.id)).toEqual(['star', 'first', 'second']);
    expect(previewItems(rows, { ...noFilters, categoryId: 'c1' }).map((i) => i.id)).toEqual(['second']);
    expect(previewItems(rows, { ...noFilters, search: 'fir' }).map((i) => i.id)).toEqual(['first']);
  });

  it('counts only published items in categories', () => {
    const preview = toPreviewBusiness(owner, rows, categories);
    expect(preview.item_count).toBe(3);
    expect(preview.categories).toEqual([{ id: 'c1', name: 'Shoes', item_count: 1 }]);
  });
});
