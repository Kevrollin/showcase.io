import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MediaImage } from '@/components/shared/MediaImage';
import { cn } from '@/lib/utils/cn';
import type { PublicImage } from '@/types/models';

/**
 * Swipeable image gallery using CSS scroll-snap (no carousel library).
 * Only the first image loads eagerly; the rest load as they come into view.
 */
export function Gallery({ images, title }: { images: PublicImage[]; title: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  function go(to: number) {
    const el = track.current;
    if (!el) return;
    const next = Math.max(0, Math.min(images.length - 1, to));
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
  }

  if (images.length === 0) {
    return <MediaImage alt={title} aspect="1 / 1" className="rounded-xl" />;
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <div
          ref={track}
          className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto rounded-xl bg-surface-sunken"
          aria-roledescription="carousel"
          aria-label={`${title} images`}
        >
          {images.map((image, i) => (
            <div
              key={image.id ?? image.path}
              className="w-full shrink-0 snap-center"
              aria-roledescription="slide"
              aria-label={`Image ${i + 1} of ${images.length}`}
            >
              <MediaImage
                path={image.path}
                alt={image.alt || (images.length > 1 ? `${title} — image ${i + 1}` : title)}
                width={image.width}
                height={image.height}
                aspect="1 / 1"
                fit="contain"
                placeholderPath={image.thumb_path}
                priority={i === 0}
                className="bg-surface-sunken"
              />
            </div>
          ))}
        </div>
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              disabled={index === 0}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-surface/95 shadow-md disabled:opacity-0 sm:flex"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              disabled={index === images.length - 1}
              aria-label="Next image"
              className="absolute right-3 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-surface/95 shadow-md disabled:opacity-0 sm:flex"
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-[#172033]/70 px-2.5 py-1 text-xs font-medium text-white" aria-live="polite">
              {index + 1} / {images.length}
            </span>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="scrollbar-none flex gap-2 overflow-x-auto">
          {images.map((image, i) => (
            <button
              key={image.id ?? image.path}
              type="button"
              onClick={() => go(i)}
              aria-label={`Show image ${i + 1}`}
              aria-current={i === index}
              className={cn(
                'w-16 shrink-0 overflow-hidden rounded-md border-2 transition-colors',
                i === index ? 'border-sf-accent' : 'border-transparent opacity-75 hover:opacity-100',
              )}
            >
              <MediaImage path={image.thumb_path ?? image.path} alt="" aspect="1 / 1" fallbackIcon={false} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
