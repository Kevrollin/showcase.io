import { ArrowLeft, Check, Link2, Share2, Tag } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { BRAND } from '@/config/brand';
import { itemUrl, storefrontPath } from '@/config/site';
import { usePageMeta } from '@/hooks/usePageMeta';
import { publicMediaUrl } from '@/lib/supabase/publicApi';
import { formatPrice } from '@/lib/utils/price';
import { canNativeShare, shareOrCopy } from '@/lib/utils/share';
import { itemEnquiry } from '@/lib/utils/whatsapp';
import { BusinessAvatar } from './components/BusinessAvatar';
import { WhatsAppButton } from './components/ContactActions';
import { Gallery } from './components/Gallery';
import { AvailabilityChip } from './components/ItemCard';
import { StorefrontSkeleton, StorefrontUnavailable } from './components/StorefrontStates';
import { accentStyle, secondaryContactLinks } from './presentation';
import { useStorefront, useStorefrontItem } from './usePublicStorefront';

export function Component() {
  const { slug: rawSlug = '', itemSlug: rawItem = '' } = useParams();
  const slug = rawSlug.toLowerCase();
  const itemSlug = rawItem.toLowerCase();
  const storefront = useStorefront(slug);
  const itemQuery = useStorefrontItem(slug, itemSlug);
  const [copied, setCopied] = useState(false);

  const business = storefront.data;
  const item = itemQuery.data;
  const url = itemUrl(slug, itemSlug);

  usePageMeta({
    title: item && business ? `${item.title} · ${business.name}` : undefined,
    description: item?.description?.slice(0, 160) ?? undefined,
    canonical: item ? url : undefined,
    image: item?.images[0] ? publicMediaUrl(item.images[0].thumb_path ?? item.images[0].path) : undefined,
    noindex: !item,
  });

  if (storefront.isPending || itemQuery.isPending) return <StorefrontSkeleton />;
  if (storefront.isError || itemQuery.isError) {
    return (
      <StorefrontUnavailable
        kind="error"
        onRetry={() => {
          void storefront.refetch();
          void itemQuery.refetch();
        }}
      />
    );
  }
  if (!business) return <StorefrontUnavailable kind="not-found" />;

  const back = (
    <Link to={storefrontPath(business.slug)} className="inline-flex h-11 items-center gap-2 rounded-md pr-3 text-sm font-medium text-foreground hover:text-sf-accent">
      <ArrowLeft className="size-4" aria-hidden="true" /> Back to {business.name}
    </Link>
  );

  if (!item) {
    return (
      <div className="min-h-dvh bg-background" style={accentStyle(business.accent_color)}>
        <div className="container-page py-4">{back}</div>
        <main className="container-page flex flex-col items-center py-20 text-center">
          <h1 className="text-2xl font-bold">This item is no longer available</h1>
          <p className="mt-2 max-w-md text-muted-foreground">It may have been sold, renamed or removed. Have a look at what else {business.name} offers.</p>
          <Button asChild className="mt-6">
            <Link to={storefrontPath(business.slug)}>See the full catalogue</Link>
          </Button>
        </main>
      </div>
    );
  }

  const price = formatPrice(item.price_mode, item.price, item.currency);
  const message = itemEnquiry(item.title, url);
  const others = secondaryContactLinks(business);

  async function share() {
    if (!item || !business) return;
    const outcome = await shareOrCopy({ title: item.title, text: `${item.title} — ${business.name}`, url });
    if (outcome === 'copied') {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    }
  }

  return (
    <div className="min-h-dvh bg-background" style={accentStyle(business.accent_color)}>
      <header className="border-b border-border bg-surface">
        <div className="container-page flex h-16 items-center justify-between gap-3">
          <Link to={storefrontPath(business.slug)} className="flex min-w-0 items-center gap-2.5">
            <BusinessAvatar name={business.name} logoPath={business.logo_path} className="size-9 rounded-lg text-sm" />
            <span className="truncate font-display font-semibold">{business.name}</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={share} aria-live="polite">
            {copied ? <Check /> : canNativeShare() ? <Share2 /> : <Link2 />}
            {copied ? 'Link copied' : 'Share'}
          </Button>
        </div>
      </header>

      <main className="container-page pb-32 pt-3 sm:pb-12">
        <div className="hidden sm:block">{back}</div>
        <div className="mt-2 grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-10">
          <Gallery images={item.images} title={item.title} />
          <div className="md:pt-2">
            {item.category_name && (
              <p className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Tag className="size-3.5" aria-hidden="true" /> {item.category_name}
              </p>
            )}
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{item.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {price && <p className="text-xl font-semibold">{price}</p>}
              <AvailabilityChip item={item} showAvailable />
            </div>
            {item.description && <p className="mt-5 whitespace-pre-line text-[0.9375rem] leading-relaxed text-foreground/85">{item.description}</p>}

            <div className="mt-7 hidden flex-col gap-3 sm:flex">
              {business.whatsapp_number && <WhatsAppButton number={business.whatsapp_number} message={message} label="Ask about this on WhatsApp" />}
              {others.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {others.map(({ key, label, href, icon: Icon, external }) => (
                    <a
                      key={key}
                      href={href}
                      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      className="inline-flex h-10 items-center gap-2 rounded-md border border-border-strong bg-surface px-3 text-sm font-medium hover:bg-surface-muted"
                    >
                      <Icon className="size-4" /> {label}
                    </a>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-8 border-t border-border pt-6 sm:hidden">{back}</div>
          </div>
        </div>
        <p className="mt-12 text-center text-xs text-subtle-foreground">
          <Link to="/" className="hover:text-foreground">{BRAND.poweredBy}</Link>
        </p>
      </main>

      {business.whatsapp_number && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 pt-3 backdrop-blur safe-bottom sm:hidden">
          <WhatsAppButton number={business.whatsapp_number} message={message} label="Ask about this on WhatsApp" className="mb-3 w-full" />
        </div>
      )}
    </div>
  );
}
