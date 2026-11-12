import { RefreshCw, Store } from 'lucide-react';
import { Link } from 'react-router';
import { LogoMark } from '@/components/shared/Logo';
import { Button } from '@/components/ui/button';
import { BRAND } from '@/config/brand';
import { getTheme } from '@/config/catalog';
import { ItemCardSkeleton } from './ItemCard';

export function StorefrontSkeleton() {
  const theme = getTheme('minimal');
  return (
    <div className="min-h-dvh bg-background" aria-busy="true" aria-label="Loading storefront">
      <div className="border-b border-border bg-surface">
        <div className="container-page flex flex-col items-center gap-3 py-10">
          <div className="skeleton size-20 rounded-xl" />
          <div className="skeleton h-7 w-48 rounded" />
          <div className="skeleton h-4 w-64 rounded" />
          <div className="skeleton mt-3 h-12 w-56 rounded-md" />
        </div>
      </div>
      <div className="container-page grid grid-cols-2 gap-x-3 gap-y-6 py-8 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <ItemCardSkeleton key={i} theme={theme} />
        ))}
      </div>
    </div>
  );
}

export function StorefrontUnavailable({ kind, onRetry }: { kind: 'not-found' | 'error'; onRetry?: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
      <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-gold-soft text-gold-strong">
        <Store className="size-7" aria-hidden="true" />
      </div>
      {kind === 'not-found' ? (
        <>
          <h1 className="text-2xl font-bold">This storefront isn&apos;t available</h1>
          <p className="mt-2 max-w-md text-muted-foreground">
            The link may be mistyped, or the owner may have changed or unpublished it. Ask them for their latest link.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold">We couldn&apos;t load this storefront</h1>
          <p className="mt-2 max-w-md text-muted-foreground">Check your internet connection and try again.</p>
          {onRetry && (
            <Button className="mt-6" onClick={onRetry}>
              <RefreshCw /> Try again
            </Button>
          )}
        </>
      )}
      <div className="mt-12 flex flex-col items-center gap-3 border-t border-border pt-8">
        <LogoMark className="size-7" />
        <p className="text-sm text-muted-foreground">Have a business? Create your own catalogue for free.</p>
        <Button asChild variant="secondary" size="sm">
          <Link to="/">Learn about {BRAND.name}</Link>
        </Button>
      </div>
    </main>
  );
}
