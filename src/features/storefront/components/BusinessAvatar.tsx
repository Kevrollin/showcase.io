import { MediaImage } from '@/components/shared/MediaImage';
import { cn } from '@/lib/utils/cn';
import { initials } from '../presentation';

/** Business logo, or tasteful initials on the accent colour when there is none. */
export function BusinessAvatar({
  name,
  logoPath,
  logoSrc,
  className,
  priority,
}: {
  name: string;
  logoPath?: string | null;
  logoSrc?: string | null;
  className?: string;
  priority?: boolean;
}) {
  if (logoPath || logoSrc) {
    return (
      <MediaImage
        path={logoPath}
        src={logoSrc}
        alt={`${name} logo`}
        aspect="1 / 1"
        priority={priority}
        className={cn('size-16 rounded-xl border border-border bg-surface shadow-xs', className)}
        fallbackIcon={false}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex size-16 shrink-0 items-center justify-center rounded-xl bg-sf-accent font-display text-xl font-bold text-white shadow-xs',
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}
