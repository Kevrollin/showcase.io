import { PackageOpen, RefreshCw, Search, SearchX, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { BRAND } from '@/config/brand';
import { BUSINESS_TYPE_COPY, getTheme, ITEM_TYPE_LABELS, ITEM_TYPES, type ItemType } from '@/config/catalog';
import { cn } from '@/lib/utils/cn';
import { storefrontEnquiry } from '@/lib/utils/whatsapp';
import type { PublicBusiness, PublicItemSummary } from '@/types/models';
import { accentStyle } from '../presentation';
import { WhatsAppButton } from './ContactActions';
import { ItemCard, ItemCardSkeleton } from './ItemCard';
import { StorefrontHero } from './StorefrontHero';

export interface StorefrontFilters {
  search: string;
  categoryId: string | null;
  itemType: ItemType | null;
}

export interface StorefrontViewProps {
  business: PublicBusiness;
  items: PublicItemSummary[];
  total: number;
  status: 'loading' | 'ready' | 'error';
  filters: StorefrontFilters;
  onFiltersChange: (filters: StorefrontFilters) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  onRetry?: () => void;
  itemHref?: (item: PublicItemSummary) => string | undefined;
  /** Rendered inside the dashboard/onboarding preview. */
  preview?: boolean;
  /** Local object URLs for not-yet-uploaded brand images (appearance preview). */
  logoSrc?: string | null;
  coverSrc?: string | null;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors',
        active ? 'border-sf-accent bg-sf-accent text-white' : 'border-border-strong bg-surface text-foreground hover:bg-surface-muted',
      )}
    >
      {children}
    </button>
  );
}

export function StorefrontView({
  business,
  items,
  total,
  status,
  filters,
  onFiltersChange,
  hasMore,
  loadingMore,
  onLoadMore,
  onRetry,
  itemHref,
  preview = false,
  logoSrc,
  coverSrc,
}: StorefrontViewProps) {
  const theme = getTheme(business.theme_id);
  const copy = BUSINESS_TYPE_COPY[business.business_type];
  const categoryNames = new Map(business.categories.map((c) => [c.id, c.name]));
  const types = ITEM_TYPES.filter((t) => (business.item_types[t] ?? 0) > 0);
  const showSearch = business.item_count > 8;
  const filtered = Boolean(filters.search || filters.categoryId || filters.itemType);
  const clear = () => onFiltersChange({ search: '', categoryId: null, itemType: null });

  const grid =
    theme.layout === 'list'
      ? 'grid grid-cols-1 gap-3 @3xl:grid-cols-2'
      : theme.id === 'creative'
        ? 'grid grid-cols-2 gap-x-2.5 gap-y-5 @2xl:gap-x-4 @5xl:grid-cols-3'
        : 'grid grid-cols-2 gap-x-3 gap-y-6 @2xl:grid-cols-3 @2xl:gap-x-4 @5xl:grid-cols-4';

  return (
    <div
      className={cn('@container flex min-h-full flex-col', theme.id === 'creative' ? 'bg-surface' : 'bg-background')}
      style={accentStyle(business.accent_color)}
    >
      <StorefrontHero business={business} logoSrc={logoSrc} coverSrc={coverSrc} preview={preview} />

      <main className={cn('sf-container flex-1 py-6 @2xl:py-8', business.whatsapp_number && !preview && 'pb-28 sm:pb-8')}>
        <h2 className="sr-only">{copy.label}</h2>

        {(showSearch || business.categories.length > 0 || types.length > 1) && (
          <div className="mb-6 space-y-3">
            {showSearch && (
              <div className="relative max-w-md">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  type="search"
                  value={filters.search}
                  onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
                  placeholder={`Search ${copy.itemNounPlural}`}
                  aria-label={`Search ${copy.itemNounPlural}`}
                  className="h-11 w-full rounded-full border border-border-strong bg-surface pl-10 pr-10 text-[0.9375rem] shadow-xs placeholder:text-subtle-foreground focus-visible:border-gold-strong"
                />
                {filters.search && (
                  <button
                    type="button"
                    onClick={() => onFiltersChange({ ...filters, search: '' })}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-sunken"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
            {types.length > 1 && (
              <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 @2xl:mx-0 @2xl:flex-wrap @2xl:px-0" role="group" aria-label="Filter by type">
                <Chip active={filters.itemType === null} onClick={() => onFiltersChange({ ...filters, itemType: null })}>
                  Everything
                </Chip>
                {types.map((t) => (
                  <Chip key={t} active={filters.itemType === t} onClick={() => onFiltersChange({ ...filters, itemType: t })}>
                    {ITEM_TYPE_LABELS[t].plural}
                  </Chip>
                ))}
              </div>
            )}
            {business.categories.length > 0 && (
              <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 @2xl:mx-0 @2xl:flex-wrap @2xl:px-0" role="group" aria-label="Filter by category">
                <Chip active={filters.categoryId === null} onClick={() => onFiltersChange({ ...filters, categoryId: null })}>
                  All
                </Chip>
                {business.categories.map((c) => (
                  <Chip key={c.id} active={filters.categoryId === c.id} onClick={() => onFiltersChange({ ...filters, categoryId: c.id })}>
                    {c.name}
                    <span className={cn('text-xs', filters.categoryId === c.id ? 'text-white/75' : 'text-muted-foreground')}>{c.item_count}</span>
                  </Chip>
                ))}
              </div>
            )}
          </div>
        )}

        {status === 'ready' && items.length > 0 && (
          <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
            {filtered ? `${total} ${total === 1 ? 'result' : 'results'}` : `${total} ${total === 1 ? copy.itemNoun : copy.itemNounPlural}`}
          </p>
        )}

        {status === 'loading' && (
          <div className={grid} aria-busy="true" aria-label="Loading">
            {Array.from({ length: 6 }, (_, i) => (
              <ItemCardSkeleton key={i} theme={theme} />
            ))}
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="text-muted-foreground">We couldn&apos;t load this catalogue. Check your connection and try again.</p>
            {onRetry && (
              <Button variant="secondary" className="mt-4" onClick={onRetry}>
                <RefreshCw /> Try again
              </Button>
            )}
          </div>
        )}

        {status === 'ready' && items.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-sf-accent-tint text-sf-accent">
              {filtered ? <SearchX className="size-6" aria-hidden="true" /> : <PackageOpen className="size-6" aria-hidden="true" />}
            </div>
            <p className="font-medium">{filtered ? 'Nothing matches your search' : `No ${copy.itemNounPlural} yet`}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {filtered ? 'Try a different word or clear the filters.' : 'Check back soon, or get in touch to ask what is available.'}
            </p>
            {filtered && (
              <Button variant="secondary" className="mt-4" onClick={clear}>
                Clear filters
              </Button>
            )}
          </div>
        )}

        {status === 'ready' && items.length > 0 && (
          <>
            <ul className={grid}>
              {items.map((item, index) => (
                <li key={item.id}>
                  <ItemCard
                    item={item}
                    theme={theme}
                    categoryName={item.category_id ? categoryNames.get(item.category_id) : null}
                    href={itemHref?.(item)}
                    priority={index < 4}
                  />
                </li>
              ))}
            </ul>
            {hasMore && onLoadMore && (
              <div className="mt-8 flex justify-center">
                <Button variant="secondary" onClick={onLoadMore} loading={loadingMore}>
                  Show more
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="sf-container flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
          <p className="font-display text-base font-semibold text-foreground">{business.name}</p>
          {business.location_label && <p>{business.location_label}</p>}
          <Link to="/" className="mt-3 text-xs text-subtle-foreground hover:text-foreground" {...(preview ? { target: '_blank' } : {})}>
            {BRAND.poweredBy}
          </Link>
        </div>
      </footer>

      {business.whatsapp_number && !preview && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 pt-3 backdrop-blur safe-bottom sm:hidden">
          <WhatsAppButton number={business.whatsapp_number} message={storefrontEnquiry(business.name)} className="mb-3 w-full" />
        </div>
      )}
    </div>
  );
}
