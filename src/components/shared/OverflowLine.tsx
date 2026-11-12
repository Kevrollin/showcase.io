import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/** Pixels per second for the reveal movement. */
const SPEED = 36;

/**
 * Keeps text on a single line.
 * - `marquee`: if it doesn't fit, it glides left to reveal the rest, pauses,
 *   and glides back (paused entirely for prefers-reduced-motion).
 * - `truncate`: it ends with "…".
 */
export function OverflowLine({
  children,
  mode = 'marquee',
  className,
}: {
  children: ReactNode;
  mode?: 'marquee' | 'truncate';
  className?: string;
}) {
  const outer = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);

  useEffect(() => {
    if (mode !== 'marquee' || !outer.current || !inner.current || typeof ResizeObserver === 'undefined') return;
    const o = outer.current;
    const i = inner.current;
    // ResizeObserver reports the initial size too, so no synchronous measure is needed.
    const observer = new ResizeObserver(() => {
      const overflow = i.scrollWidth - o.clientWidth;
      setShift(overflow > 2 ? overflow : 0);
    });
    observer.observe(o);
    observer.observe(i);
    return () => observer.disconnect();
  }, [mode]);

  if (mode === 'truncate') {
    return <span className={cn('block max-w-full truncate', className)}>{children}</span>;
  }

  const moving = shift > 0;
  // Two moves (out and back) take ~70% of the cycle; the rest are pauses.
  const duration = Math.max(6, (2 * shift) / SPEED / 0.7);
  const style = moving ? ({ '--marquee-shift': `-${shift}px`, '--marquee-duration': `${duration.toFixed(1)}s` } as CSSProperties) : undefined;

  return (
    <span ref={outer} className={cn('block max-w-full overflow-hidden whitespace-nowrap', moving && 'marquee-fade', className)}>
      <span ref={inner} className={cn('inline-block', moving && 'animate-marquee pr-5')} style={style}>
        {children}
      </span>
    </span>
  );
}
