import { MapPin } from 'lucide-react';
import { useState } from 'react';
import { OverflowLine } from '@/components/shared/OverflowLine';
import { categoryLabel, getTheme } from '@/config/catalog';
import { publicMediaUrl } from '@/lib/supabase/publicApi';
import { cn } from '@/lib/utils/cn';
import { storefrontEnquiry } from '@/lib/utils/whatsapp';
import type { PublicBusiness } from '@/types/models';
import { BusinessAvatar } from './BusinessAvatar';
import { ContactActions } from './ContactActions';

/**
 * Bottom-up scrim over the cover photo: solid behind the text, easing to clear
 * at the top so the photo stays visible. Eased stops avoid a visible band.
 */
const SCRIM =
  'linear-gradient(to top, rgb(12 17 28 / 0.97) 0%, rgb(12 17 28 / 0.92) 22%, rgb(12 17 28 / 0.74) 42%, rgb(12 17 28 / 0.44) 62%, rgb(12 17 28 / 0.16) 82%, rgb(12 17 28 / 0.04) 100%)';

/**
 * The storefront hero: business identity and contact options. With a cover
 * photo, the photo fills the whole section behind the content. Without one, it
 * is a calm panel tinted with the business's accent colour.
 *
 * Tagline and category/location stay on one line: on the live storefront long
 * lines glide to reveal the rest; in previews/mockups they truncate with "…".
 */
export function StorefrontHero({
  business,
  logoSrc,
  coverSrc,
  preview = false,
}: {
  business: PublicBusiness;
  logoSrc?: string | null;
  coverSrc?: string | null;
  preview?: boolean;
}) {
  const lineMode = preview ? 'truncate' : 'marquee';
  const theme = getTheme(business.theme_id);
  const coverUrl = coverSrc ?? publicMediaUrl(business.cover_path);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const hasCover = Boolean(coverUrl);
  const centered = theme.header === 'centered';
  const tall = theme.header === 'cover';
  const meta = [categoryLabel(business.category), business.location_label].filter((part): part is string => Boolean(part));

  return (
    <header
      className={cn(
        'relative isolate overflow-hidden',
        hasCover ? 'bg-[#0c111c] text-white' : 'border-b border-border bg-sf-accent-tint text-foreground',
      )}
    >
      {hasCover && coverUrl && (
        <>
          <img
            src={coverUrl}
            alt=""
            decoding="async"
            fetchPriority="high"
            onLoad={() => setLoadedUrl(coverUrl)}
            className={cn(
              'absolute inset-0 -z-20 size-full object-cover object-center transition-opacity duration-700 ease-out',
              loadedUrl === coverUrl ? 'opacity-100' : 'opacity-0',
            )}
          />
          <div aria-hidden="true" className="absolute inset-0 -z-10" style={{ backgroundImage: SCRIM }} />
        </>
      )}

      <div
        className={cn(
          'sf-container flex flex-col',
          hasCover
            ? cn('justify-end pb-7 @2xl:pb-10', tall ? 'min-h-[28rem] pt-32 @2xl:min-h-[36rem]' : 'min-h-[23rem] pt-24 @2xl:min-h-[30rem]')
            : cn('py-7 @2xl:py-10', preview && 'pt-11'),
          centered && 'items-center text-center',
        )}
      >
        {/* w-full + min-w-0: one-line text must never widen the hero beyond the screen. */}
        <div className={cn('flex w-full min-w-0 gap-4', centered ? 'flex-col items-center' : 'flex-row items-center')}>
          <BusinessAvatar
            name={business.name}
            logoPath={business.logo_path}
            logoSrc={logoSrc}
            priority
            className={cn('size-16 @2xl:size-20', hasCover ? 'shadow-lg ring-2 ring-white/80' : 'ring-4 ring-surface')}
          />
          <div className={cn('min-w-0', centered ? 'w-full' : 'flex-1')}>
            <h1
              className={cn(
                'text-[1.625rem] font-bold leading-tight @2xl:text-[2.5rem]',
                hasCover && 'text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.3)]',
              )}
            >
              {business.name}
            </h1>
            {business.tagline && (
              <p className={cn('mt-1 text-[0.9375rem] font-medium @2xl:text-base', hasCover ? 'text-white/90' : 'text-sf-accent')}>
                <OverflowLine mode={lineMode}>{business.tagline}</OverflowLine>
              </p>
            )}
            {meta.length > 0 && (
              <p className={cn('mt-1.5 text-sm', hasCover ? 'text-white/75' : 'text-muted-foreground')}>
                <OverflowLine mode={lineMode}>
                  {meta.map((part, i) => (
                    <span key={part}>
                      {i > 0 && (
                        <span aria-hidden="true" className={cn('mx-2', hasCover ? 'text-white/40' : 'text-border-strong')}>
                          •
                        </span>
                      )}
                      {part === business.location_label && <MapPin className="mr-1 inline-block size-3.5 align-[-2px]" aria-hidden="true" />}
                      {part}
                    </span>
                  ))}
                </OverflowLine>
              </p>
            )}
          </div>
        </div>

        {business.description && (
          <p
            className={cn(
              'mt-4 max-w-2xl text-[0.9375rem] leading-relaxed @2xl:text-base',
              hasCover ? 'text-white/85' : 'text-foreground/85',
              centered && 'mx-auto',
            )}
          >
            {business.description}
          </p>
        )}

        <ContactActions
          business={business}
          message={storefrontEnquiry(business.name)}
          align={centered ? 'center' : 'start'}
          tone={hasCover ? 'dark' : 'light'}
          className="mt-5 w-full"
        />
      </div>
    </header>
  );
}
