import { Star } from 'lucide-react';
import { Link } from 'react-router';
import { MediaImage } from '@/components/shared/MediaImage';
import type { StorefrontTheme } from '@/config/catalog';
import { cn } from '@/lib/utils/cn';
import { formatPrice } from '@/lib/utils/price';
import type { PublicItemSummary } from '@/types/models';
import { availabilityLabel } from '../presentation';

export function AvailabilityChip({ item, showAvailable = false }: { item: Pick<PublicItemSummary, 'item_type' | 'availability_status'>; showAvailable?: boolean }) {
  const label = availabilityLabel(item);
  if (!label) return null;
  if (item.availability_status === 'available' && !showAvailable) return null;
  const tone =
    item.availability_status === 'available'
      ? 'bg-success-soft text-success'
      : item.availability_status === 'preorder'
        ? 'bg-gold-soft text-gold-strong'
        : 'bg-surface-sunken text-muted-foreground';
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', tone)}>{label}</span>;
}

function thumbSize(item: PublicItemSummary): { width?: number; height?: number } {
  const w = item.image?.width;
  const h = item.image?.height;
  if (!w || !h) return {};
  const scale = Math.min(1, 640 / Math.max(w, h));
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

/** Shown for items without photos: a calm tile with the item's initial instead of a "broken image" icon. */
function NoPhoto({ title, aspect, className }: { title: string; aspect: string; className?: string }) {
  return (
    <div
      aria-hidden="true"
      style={{ aspectRatio: aspect }}
      className={cn('flex items-center justify-center bg-sf-accent-tint font-display text-3xl font-bold text-sf-accent/60', className)}
    >
      {title.trim().charAt(0).toUpperCase() || '·'}
    </div>
  );
}

interface ItemCardProps {
  item: PublicItemSummary;
  theme: StorefrontTheme;
  categoryName?: string | null;
  href?: string;
  /** First row of cards: load eagerly. */
  priority?: boolean;
}

export function ItemCard({ item, theme, categoryName, href, priority }: ItemCardProps) {
  const price = formatPrice(item.price_mode, item.price, item.currency);
  const unavailable = item.availability_status === 'unavailable' && item.item_type !== 'portfolio';
  const imagePath = item.image?.thumb_path ?? item.image?.path ?? null;
  const alt = item.image?.alt || item.title;
  const list = theme.layout === 'list';

  const content = list ? (
    <div className="flex gap-3.5 p-3">
      {imagePath ? (
        <MediaImage
          path={imagePath}
          alt={alt}
          aspect={theme.imageAspect}
          priority={priority}
          {...thumbSize(item)}
          fit="smart"
          className={cn('w-28 shrink-0 rounded-md @2xl:w-36', unavailable && 'opacity-70')}
        />
      ) : (
        <NoPhoto title={item.title} aspect={theme.imageAspect} className="w-28 shrink-0 rounded-md text-2xl @2xl:w-36" />
      )}
      <div className="flex min-w-0 flex-1 flex-col py-0.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-[0.9375rem] font-semibold leading-snug text-foreground">{item.title}</h3>
          {item.is_featured && <Star className="mt-0.5 size-4 shrink-0 fill-gold text-gold" aria-label="Featured" />}
        </div>
        {item.summary && <p className="mt-1 line-clamp-2 text-sm leading-snug text-muted-foreground">{item.summary}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-2">
          {price && <span className="text-sm font-semibold text-foreground">{price}</span>}
          <AvailabilityChip item={item} />
        </div>
      </div>
    </div>
  ) : (
    <>
      <div className="relative">
        {imagePath ? (
          <MediaImage
            path={imagePath}
            alt={alt}
            aspect={theme.imageAspect}
            priority={priority}
            {...thumbSize(item)}
          fit="smart"
            className={cn('rounded-lg', unavailable && 'opacity-70')}
            imgClassName="group-hover:scale-[1.02] transition-transform duration-500"
          />
        ) : (
          <NoPhoto title={item.title} aspect={theme.imageAspect} className="rounded-lg" />
        )}
        {item.is_featured && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-surface/95 px-2 py-0.5 text-[0.6875rem] font-semibold text-foreground shadow-xs">
            <Star className="size-3 fill-gold text-gold" aria-hidden="true" /> Featured
          </span>
        )}
      </div>
      <div className={cn('px-0.5 pb-1', theme.id === 'creative' ? 'pt-2' : 'pt-2.5')}>
        <h3 className="line-clamp-2 text-[0.9375rem] font-medium leading-snug text-foreground">{item.title}</h3>
        {theme.id !== 'shop' && theme.id !== 'creative' && item.summary && (
          <p className="mt-0.5 line-clamp-1 text-[0.8125rem] text-muted-foreground">{item.summary}</p>
        )}
        {categoryName && theme.id === 'creative' && <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{categoryName}</p>}
        {(price || (unavailable || item.availability_status === 'preorder')) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            {price && <span className="text-sm font-semibold text-foreground">{price}</span>}
            <AvailabilityChip item={item} />
          </div>
        )}
      </div>
    </>
  );

  const shell = cn(
    'group block h-full rounded-lg transition-shadow',
    list ? 'border border-border bg-surface shadow-xs hover:shadow-md' : 'focus-visible:outline-offset-4',
  );

  return href ? (
    <Link to={href} className={shell} aria-label={`${item.title}${price ? `, ${price}` : ''}`}>
      {content}
    </Link>
  ) : (
    <div className={shell}>{content}</div>
  );
}

export function ItemCardSkeleton({ theme }: { theme: StorefrontTheme }) {
  if (theme.layout === 'list') {
    return (
      <div className="flex gap-3.5 rounded-lg border border-border bg-surface p-3">
        <div className="skeleton w-28 shrink-0 rounded-md @2xl:w-36" style={{ aspectRatio: theme.imageAspect }} />
        <div className="flex-1 space-y-2 py-1">
          <div className="skeleton h-4 w-3/4 rounded" />
          <div className="skeleton h-3 w-full rounded" />
          <div className="skeleton h-3 w-1/3 rounded" />
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="skeleton rounded-lg" style={{ aspectRatio: theme.imageAspect }} />
      <div className="mt-2.5 space-y-1.5">
        <div className="skeleton h-4 w-4/5 rounded" />
        <div className="skeleton h-3.5 w-1/3 rounded" />
      </div>
    </div>
  );
}
