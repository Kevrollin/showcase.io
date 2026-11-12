import { Link } from 'react-router';
import { BRAND } from '@/config/brand';
import { cn } from '@/lib/utils/cn';

/** Brand mark: a small storefront with an awning. Mirrors public/favicon/favicon.svg. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8 shrink-0', className)} aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="#1B2741" />
      <path d="M9 14.5h14V22a1.75 1.75 0 0 1-1.75 1.75h-10.5A1.75 1.75 0 0 1 9 22z" fill="#FAF8F4" />
      <rect x="14" y="18" width="4" height="5.75" rx="0.9" fill="#1B2741" />
      <path d="M7 12.25V9.25A1.25 1.25 0 0 1 8.25 8h15.5A1.25 1.25 0 0 1 25 9.25v3a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z" fill="#B8924A" />
    </svg>
  );
}

export function Logo({ to = '/', className, label = true }: { to?: string; className?: string; label?: boolean }) {
  return (
    <Link to={to} className={cn('inline-flex items-center gap-2.5 rounded-md', className)} aria-label={`${BRAND.name} home`}>
      <LogoMark />
      {label && <span className="font-display text-lg font-bold tracking-tight text-foreground">{BRAND.name}</span>}
    </Link>
  );
}
