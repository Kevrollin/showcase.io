import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/** A phone-shaped frame for live storefront previews. */
export function PhonePreview({
  children,
  className,
  label = 'Storefront preview',
  tall = false,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
  tall?: boolean;
}) {
  return (
    <figure className={cn('mx-auto w-full max-w-[22rem]', className)} aria-label={label}>
      <div className="rounded-[2.25rem] bg-[#1b2741] p-2.5 shadow-lg">
        <div className={cn('relative overflow-hidden rounded-[1.75rem] bg-background', tall ? 'h-[38rem]' : 'h-[34rem]')}>
          <div className="pointer-events-none absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-[#1b2741]" aria-hidden="true" />
          <div className="h-full overflow-y-auto overscroll-contain [scrollbar-width:thin]">{children}</div>
        </div>
      </div>
    </figure>
  );
}
