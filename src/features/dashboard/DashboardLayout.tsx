import {
  ExternalLink,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Palette,
  Plus,
  QrCode,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router';
import { Logo } from '@/components/shared/Logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/dialog';
import { PageLoader } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toaster';
import { BUSINESS_TYPE_COPY } from '@/config/catalog';
import { storefrontPath } from '@/config/site';
import { CurrentBusinessContext, pickCurrentBusiness, useMyBusinesses } from '@/features/businesses/hooks';
import { BusinessAvatar } from '@/features/storefront/components/BusinessAvatar';
import { accentStyle } from '@/features/storefront/presentation';
import { cn } from '@/lib/utils/cn';
import { toUserMessage } from '@/lib/utils/errors';
import { signOut } from '@/services/auth.service';
import type { Business } from '@/types/models';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

function navItems(business: Business): NavItem[] {
  return [
    { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/dashboard/catalogue', label: BUSINESS_TYPE_COPY[business.business_type].catalogueLabel, icon: Package },
    { to: '/dashboard/categories', label: 'Categories', icon: FolderTree },
    { to: '/dashboard/appearance', label: 'Storefront appearance', icon: Palette },
    { to: '/dashboard/share', label: 'Share and QR', icon: QrCode },
    { to: '/dashboard/settings', label: 'Settings', icon: Settings },
  ];
}

export function StatusBadge({ status }: { status: Business['status'] }) {
  if (status === 'published') return <Badge tone="success">Published</Badge>;
  if (status === 'unpublished') return <Badge tone="warning">Unpublished</Badge>;
  return <Badge tone="neutral">Draft</Badge>;
}

async function handleSignOut() {
  try {
    await signOut();
  } catch (error) {
    toast.error(toUserMessage(error));
  }
}

function SideNav({ business, onNavigate }: { business: Business; onNavigate?: () => void }) {
  return (
    <nav aria-label="Dashboard" className="space-y-1">
      {navItems(business).map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex h-11 items-center gap-3 rounded-md px-3 text-[0.9375rem] font-medium transition-colors',
              isActive ? 'bg-primary text-white' : 'text-foreground hover:bg-surface-sunken',
            )
          }
        >
          <Icon className="size-[1.125rem] shrink-0" aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function BottomNav({ business, onMore }: { business: Business; onMore: () => void }) {
  const location = useLocation();
  const item = (to: string, label: string, Icon: LucideIcon, end = false) => (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn('flex h-full flex-1 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium', isActive ? 'text-foreground' : 'text-muted-foreground')
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn('size-5', isActive && 'stroke-[2.4]')} aria-hidden="true" />
          {label}
        </>
      )}
    </NavLink>
  );
  const moreActive = ['/dashboard/categories', '/dashboard/appearance', '/dashboard/settings'].some((p) => location.pathname.startsWith(p));
  return (
    <nav aria-label="Dashboard" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur safe-bottom lg:hidden">
      <div className="mx-auto flex h-16 max-w-lg items-stretch px-2">
        {item('/dashboard', 'Home', LayoutDashboard, true)}
        {item('/dashboard/catalogue', BUSINESS_TYPE_COPY[business.business_type].itemNounPlural.replace(/^./, (c) => c.toUpperCase()), Package)}
        <div className="flex flex-1 items-center justify-center">
          <Link
            to="/dashboard/catalogue/new"
            aria-label={`Add a new ${BUSINESS_TYPE_COPY[business.business_type].itemNoun}`}
            className="flex size-12 items-center justify-center rounded-full bg-primary text-white shadow-md"
          >
            <Plus className="size-6" aria-hidden="true" />
          </Link>
        </div>
        {item('/dashboard/share', 'Share', QrCode)}
        <button
          type="button"
          onClick={onMore}
          className={cn('flex flex-1 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium', moreActive ? 'text-foreground' : 'text-muted-foreground')}
        >
          <Menu className="size-5" aria-hidden="true" />
          More
        </button>
      </div>
    </nav>
  );
}

function DashboardShell({ business }: { business: Business }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const live = business.status === 'published';

  const viewStorefront = live ? (
    <Button asChild variant="secondary" size="sm">
      <a href={storefrontPath(business.slug)} target="_blank" rel="noopener noreferrer">
        <ExternalLink /> <span className="hidden sm:inline">View storefront</span>
        <span className="sr-only sm:hidden">View storefront</span>
      </a>
    </Button>
  ) : null;

  return (
    <div className="min-h-dvh bg-background" style={accentStyle(business.accent_color)}>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-16 items-center px-5">
          <Logo to="/dashboard" />
        </div>
        <div className="mx-3 mb-4 flex items-center gap-3 rounded-lg border border-border bg-background p-3">
          <BusinessAvatar name={business.name} logoPath={business.logo_path} className="size-10 rounded-lg text-sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{business.name}</p>
            <StatusBadge status={business.status} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3">
          <SideNav business={business} />
        </div>
        <div className="border-t border-border p-3">
          <Button variant="ghost" className="w-full justify-start" onClick={() => void handleSignOut()}>
            <LogOut /> Sign out
          </Button>
        </div>
      </aside>

      {/* Top bar (mobile + desktop content header) */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur lg:ml-64">
        <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:h-16">
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2.5 lg:hidden">
            <BusinessAvatar name={business.name} logoPath={business.logo_path} className="size-8 rounded-lg text-xs" />
            <span className="truncate font-display font-semibold">{business.name}</span>
          </Link>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2">{viewStorefront}</div>
        </div>
      </header>

      <main className="px-4 pb-28 pt-5 [--sticky-bottom:calc(4rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-8 lg:ml-64 lg:pb-12 lg:[--sticky-bottom:0px]">
        <div className="mx-auto w-full max-w-5xl">
          <Outlet />
        </div>
      </main>

      <BottomNav business={business} onMore={() => setMenuOpen(true)} />
      <Sheet open={menuOpen} onOpenChange={setMenuOpen} title="Menu" full>
        <div className="mx-auto w-full max-w-lg space-y-4 p-4">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
            <BusinessAvatar name={business.name} logoPath={business.logo_path} className="size-10 rounded-lg text-sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{business.name}</p>
              <StatusBadge status={business.status} />
            </div>
          </div>
          <SideNav business={business} onNavigate={() => setMenuOpen(false)} />
          <div className="border-t border-border pt-3">
            <Button variant="ghost" className="w-full justify-start" onClick={() => void handleSignOut()}>
              <LogOut /> Sign out
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

export function Component() {
  const businesses = useMyBusinesses();

  if (businesses.isPending) return <PageLoader label="Loading your dashboard" />;
  if (businesses.isError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-muted-foreground">{toUserMessage(businesses.error)}</p>
        <Button onClick={() => void businesses.refetch()}>Try again</Button>
      </div>
    );
  }
  const business = pickCurrentBusiness(businesses.data);
  if (!business) return <Navigate to="/onboarding" replace />;

  return (
    <CurrentBusinessContext.Provider value={business}>
      <DashboardShell business={business} />
    </CurrentBusinessContext.Provider>
  );
}
