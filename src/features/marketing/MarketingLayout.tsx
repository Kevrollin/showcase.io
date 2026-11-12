import { ArrowRight, Menu, X } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Logo } from '@/components/shared/Logo';
import { Button } from '@/components/ui/button';
import { BRAND } from '@/config/brand';
import { CONTACT_EMAIL } from '@/config/site';

const NAV = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#features', label: 'Features' },
  { href: '/#who-its-for', label: "Who it's for" },
];

/**
 * Header with a full-page mobile menu. Lightweight on purpose (no dialog library
 * on the public bundle) but with dialog semantics: aria-modal, focus moves in
 * and is kept inside, Escape closes, page scroll is locked, and focus returns
 * to the menu button on close.
 */
export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => toggle.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab' || !panel.current) return;
      const focusable = Array.from(panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  // Section links: the menu closes first (its cleanup restores page scrolling),
  // then this effect glides to the requested section.
  const pendingSection = useRef<string | null>(null);
  useEffect(() => {
    if (open || !pendingSection.current) return;
    const hash = pendingSection.current;
    pendingSection.current = null;
    document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.replaceState(null, '', `#${hash}`);
  }, [open]);

  function goToSection(event: MouseEvent<HTMLAnchorElement>, href: string) {
    const hash = href.split('#')[1];
    if (hash && window.location.pathname === '/') {
      event.preventDefault();
      pendingSection.current = hash;
    }
    close(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="rounded-md px-3 py-2 text-[0.9375rem] font-medium text-muted-foreground transition-colors hover:text-foreground">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link to="/signup">Get started</Link>
          </Button>
        </div>
        <Button
          ref={toggle}
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-expanded={open}
          aria-controls={panelId}
          aria-haspopup="dialog"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
        >
          <Menu />
        </Button>
      </div>

      {open && (
        <div
          ref={panel}
          id={panelId}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-50 flex h-dvh flex-col bg-background animate-fade-in md:hidden"
        >
          <div className="container-page flex h-16 shrink-0 items-center justify-between border-b border-border">
            <Logo />
            <Button variant="ghost" size="icon" aria-label="Close menu" data-autofocus onClick={() => close()}>
              <X />
            </Button>
          </div>
          <nav aria-label="Mobile" className="container-page flex-1 overflow-y-auto pt-4">
            <ul>
              {NAV.map((n, i) => (
                <li key={n.href} className="animate-slide-up border-b border-border [animation-fill-mode:both]" style={{ animationDelay: `${60 + i * 50}ms` }}>
                  <a
                    href={n.href}
                    onClick={(e) => goToSection(e, n.href)}
                    className="group flex items-center justify-between py-5 font-display text-[1.75rem] font-bold tracking-tight text-foreground"
                  >
                    {n.label}
                    <ArrowRight className="size-6 text-gold-strong transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-8 max-w-xs text-[0.9375rem] leading-relaxed text-muted-foreground">{BRAND.promise}</p>
          </nav>
          <div className="container-page shrink-0 space-y-2.5 border-t border-border bg-surface py-4 safe-bottom">
            <Button asChild size="lg" className="w-full">
              <Link to="/signup" onClick={() => close(false)}>
                Create your free catalogue <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg" className="w-full">
              <Link to="/login" onClick={() => close(false)}>
                Sign in
              </Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}

export function MarketingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-surface">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3 lg:col-span-2">
          <Logo />
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            {BRAND.promise} A simple digital storefront and portfolio for student entrepreneurs, freelancers and local businesses.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Product</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {NAV.map((n) => (
              <li key={n.href}>
                <a href={n.href} className="hover:text-foreground">
                  {n.label}
                </a>
              </li>
            ))}
            <li>
              <Link to="/signup" className="hover:text-foreground">Create your catalogue</Link>
            </li>
            <li>
              <Link to="/login" className="hover:text-foreground">Sign in</Link>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Company</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {CONTACT_EMAIL && (
              <li>
                <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-foreground">
                  {CONTACT_EMAIL}
                </a>
              </li>
            )}
            <li>
              <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
            </li>
            <li>
              <Link to="/terms" className="hover:text-foreground">Terms of Service</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="container-page py-5 text-xs text-subtle-foreground">
          © {year} {BRAND.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

export function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:shadow-md">
        Skip to content
      </a>
      <MarketingHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
