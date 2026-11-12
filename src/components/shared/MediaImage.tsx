import { ImageOff } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { publicMediaUrl } from '@/lib/supabase/publicApi';
import { cn } from '@/lib/utils/cn';
import { resolveFit, type ImageFit } from '@/lib/utils/imageFit';

interface MediaImageProps {
  /** Storage path inside the media bucket, or an absolute/blob URL via `src`. */
  path?: string | null;
  src?: string | null;
  alt: string;
  /** CSS aspect-ratio for the frame, e.g. "1 / 1". Reserves space → no layout shift. */
  aspect?: string;
  /** Intrinsic size of the image (used for `smart` fit and to help the browser). */
  width?: number | null;
  height?: number | null;
  /** Above-the-fold images: eager + high fetch priority. */
  priority?: boolean;
  className?: string;
  imgClassName?: string;
  /**
   * cover   – fill the frame (may crop)
   * contain – show the whole image over a soft blurred fill of itself
   * smart   – cover when the image's shape is close to the frame's, otherwise contain
   */
  fit?: ImageFit;
  sizes?: string;
  fallbackIcon?: boolean;
  /**
   * Small version shown instantly while the full image loads (e.g. the card
   * thumbnail, usually already cached), then cross-faded away.
   */
  placeholderPath?: string | null;
}

export function MediaImage({
  path,
  src,
  alt,
  aspect,
  width,
  height,
  priority = false,
  className,
  imgClassName,
  fit = 'cover',
  sizes,
  fallbackIcon = true,
  placeholderPath,
}: MediaImageProps) {
  const url = src ?? publicMediaUrl(path);
  const placeholder = placeholderPath ? publicMediaUrl(placeholderPath) : null;
  const [loaded, setLoaded] = useState(false);
  const [placeholderShown, setPlaceholderShown] = useState(false);
  const [failed, setFailed] = useState(false);
  const style: CSSProperties | undefined = aspect ? { aspectRatio: aspect } : undefined;
  const mode = resolveFit(fit, aspect, width, height);
  const loading = priority ? 'eager' : 'lazy';

  return (
    <div className={cn('img-frame', !loaded && !placeholderShown && !failed && url && 'skeleton', className)} style={style}>
      {url && !failed ? (
        <>
          {mode === 'contain' && (
            // Same file as the main image (one download): blurred and enlarged
            // to fill the frame edge to edge, so nothing looks letterboxed.
            <img
              src={placeholder ?? url}
              alt=""
              aria-hidden="true"
              loading={loading}
              decoding="async"
              className={cn(
                'scale-150 blur-2xl brightness-90 saturate-150 transition-opacity duration-300',
                loaded || placeholderShown ? 'opacity-90' : 'opacity-0',
              )}
            />
          )}
          {placeholder && placeholder !== url && !loaded && (
            <img
              src={placeholder}
              alt=""
              aria-hidden="true"
              decoding="async"
              onLoad={() => setPlaceholderShown(true)}
              className={cn(mode === 'contain' ? '!object-contain' : 'object-cover', placeholderShown ? 'opacity-100' : 'opacity-0')}
            />
          )}
          <img
            src={url}
            alt={alt}
            width={width ?? undefined}
            height={height ?? undefined}
            sizes={sizes}
            loading={loading}
            decoding="async"
            fetchPriority={priority ? 'high' : 'auto'}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={cn(
              'transition-opacity duration-300',
              mode === 'contain' ? '!object-contain' : 'object-cover',
              loaded ? 'opacity-100' : 'opacity-0',
              imgClassName,
            )}
          />
        </>
      ) : (
        fallbackIcon && (
          <div className="absolute inset-0 flex items-center justify-center text-subtle-foreground" aria-hidden={!failed}>
            <ImageOff className="size-6" aria-hidden="true" />
            {failed && <span className="sr-only">Image unavailable</span>}
          </div>
        )
      )}
    </div>
  );
}
