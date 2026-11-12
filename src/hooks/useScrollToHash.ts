import { useEffect } from 'react';
import { useLocation } from 'react-router';

/** Scrolls to #anchor targets after client-side navigation (e.g. /dashboard/settings#contact). */
export function useScrollToHash(ready = true): void {
  const { hash } = useLocation();
  useEffect(() => {
    if (!ready || !hash) return;
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!el) return;
    const timer = window.setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    return () => window.clearTimeout(timer);
  }, [hash, ready]);
}
