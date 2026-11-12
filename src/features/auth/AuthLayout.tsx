import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Logo } from '@/components/shared/Logo';
import { BRAND } from '@/config/brand';

export function AuthLayout({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="container-page flex h-16 items-center">
        <Logo />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:items-center sm:pt-0">
        <div className="w-full max-w-[26rem]">
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8">
            <h1 className="text-2xl font-bold">{title}</h1>
            {description && <p className="mt-2 text-[0.9375rem] text-muted-foreground">{description}</p>}
            <div className="mt-6">{children}</div>
          </div>
          {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </main>
      <footer className="pb-6 text-center text-xs text-subtle-foreground">
        <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
        <span className="mx-2">·</span>
        <Link to="/terms" className="hover:text-foreground">Terms</Link>
        <span className="mx-2">·</span>© {new Date().getFullYear()} {BRAND.name}
      </footer>
    </div>
  );
}
