import { ArrowRight, CircleCheck, Circle, ExternalLink, Palette, Plus, QrCode, Rocket, Share2, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, Skeleton } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toaster';
import { BUSINESS_TYPE_COPY } from '@/config/catalog';
import { displayUrl, storefrontPath, storefrontUrl } from '@/config/site';
import { useAuth } from '@/features/auth/auth-context';
import { useCurrentBusiness, usePublishBusiness } from '@/features/businesses/hooks';
import { useItems } from '@/features/catalogue/hooks';
import { CopyLinkButton } from '@/features/sharing/ShareActions';
import { usePageMeta } from '@/hooks/usePageMeta';
import { cn } from '@/lib/utils/cn';
import { toUserMessage } from '@/lib/utils/errors';
import { buildChecklist } from './checklist';
import { StatusBadge } from './DashboardLayout';

function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="p-4 sm:p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

function QuickAction({ to, icon: Icon, label, external }: { to: string; icon: LucideIcon; label: string; external?: boolean }) {
  const className =
    'flex min-h-14 items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm font-medium shadow-xs transition-colors hover:border-border-strong hover:bg-surface-muted';
  const inner = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-gold-soft text-gold-strong">
        <Icon className="size-[1.125rem]" aria-hidden="true" />
      </span>
      {label}
    </>
  );
  return external ? (
    <a href={to} target="_blank" rel="noopener noreferrer" className={className}>
      {inner}
    </a>
  ) : (
    <Link to={to} className={className}>
      {inner}
    </Link>
  );
}

export function Component() {
  usePageMeta({ title: 'Dashboard', noindex: true });
  const business = useCurrentBusiness();
  const { user } = useAuth();
  const items = useItems(business.id);
  const publish = usePublishBusiness();
  const copy = BUSINESS_TYPE_COPY[business.business_type];
  const list = items.data ?? [];
  const publishedCount = list.filter((i) => i.is_published).length;
  const checklist = buildChecklist(business, list);
  const doneCount = checklist.filter((c) => c.done).length;
  const firstName = (typeof user?.user_metadata.full_name === 'string' ? user.user_metadata.full_name : '').split(' ')[0];
  const live = business.status === 'published';
  const url = storefrontUrl(business.slug);
  const onboardingDone = Boolean(business.onboarding_completed_at);

  async function goLive() {
    try {
      await publish.mutateAsync({ id: business.id, status: 'published' });
      toast.success('Your storefront is now live.');
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">{firstName ? `Welcome back, ${firstName}` : 'Welcome back'}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold sm:text-[1.75rem]">{business.name}</h1>
          <StatusBadge status={business.status} />
        </div>
      </div>

      {!onboardingDone && (
        <div className="flex flex-col gap-3 rounded-lg border border-gold/40 bg-gold-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Finish setting up your storefront</p>
            <p className="text-sm text-muted-foreground">Pick up where you left off — it only takes a few minutes.</p>
          </div>
          <Button asChild>
            <Link to="/onboarding">
              Continue setup <ArrowRight />
            </Link>
          </Button>
        </div>
      )}

      <Card>
        <CardHeader title="Your storefront link" description={live ? 'Share it anywhere customers can find you.' : 'Publish your storefront to start sharing it.'} />
        <CardBody>
          {live ? (
            <div className="space-y-4">
              <a href={url} target="_blank" rel="noopener noreferrer" className="block break-all font-display text-lg font-semibold underline decoration-gold underline-offset-4">
                {displayUrl(url)}
              </a>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <CopyLinkButton url={url} variant="primary" />
                <Button asChild variant="secondary">
                  <Link to="/dashboard/share">
                    <Share2 /> Share
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link to="/dashboard/share#qr">
                    <QrCode /> QR code
                  </Link>
                </Button>
                <Button asChild variant="ghost">
                  <a href={storefrontPath(business.slug)} target="_blank" rel="noopener noreferrer">
                    <ExternalLink /> View
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {business.status === 'unpublished'
                  ? 'Your storefront is temporarily hidden. Customers who open your link see a “not available” page.'
                  : 'Your storefront is a draft. Only you can see it.'}
              </p>
              {onboardingDone || business.status === 'unpublished' ? (
                <Button onClick={() => void goLive()} loading={publish.isPending}>
                  <Rocket /> {business.status === 'unpublished' ? 'Publish again' : 'Publish storefront'}
                </Button>
              ) : (
                <Button asChild>
                  <Link to="/onboarding">
                    <Rocket /> Review and publish
                  </Link>
                </Button>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label={`Total ${copy.itemNounPlural}`} value={items.isPending ? <Skeleton className="h-8 w-10" /> : list.length} />
        <StatCard label="Showing on storefront" value={items.isPending ? <Skeleton className="h-8 w-10" /> : publishedCount} hint={list.length > publishedCount ? `${list.length - publishedCount} hidden` : undefined} />
        <div className="col-span-2 sm:col-span-1">
          <StatCard label="Storefront status" value={live ? 'Live' : business.status === 'unpublished' ? 'Hidden' : 'Draft'} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {doneCount < checklist.length && (
          <Card>
            <CardHeader title="Getting started" description={`${doneCount} of ${checklist.length} done`} />
            <ul className="divide-y divide-border">
              {checklist.map((item) => (
                <li key={item.id}>
                  <Link to={item.to} className={cn('flex items-center gap-3 px-4 py-3.5 sm:px-5', !item.done && 'hover:bg-surface-muted')}>
                    {item.done ? (
                      <CircleCheck className="size-5 shrink-0 text-success" aria-hidden="true" />
                    ) : (
                      <Circle className="size-5 shrink-0 text-border-strong" aria-hidden="true" />
                    )}
                    <span className={cn('flex-1 text-sm', item.done ? 'text-muted-foreground line-through' : 'font-medium')}>{item.label}</span>
                    <span className="sr-only">{item.done ? 'Done' : 'Not done yet'}</span>
                    {!item.done && <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <section aria-labelledby="quick-actions">
          <h2 id="quick-actions" className="mb-3 text-base font-semibold">
            Quick actions
          </h2>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <QuickAction to="/dashboard/catalogue/new" icon={Plus} label={`Add new ${copy.itemNoun}`} />
            <QuickAction to="/dashboard/appearance" icon={Palette} label="Edit storefront" />
            <QuickAction to="/dashboard/share" icon={Share2} label="Share catalogue" />
            {live ? (
              <QuickAction to={storefrontPath(business.slug)} icon={ExternalLink} label="View public page" external />
            ) : (
              <QuickAction to="/dashboard/settings#visibility" icon={Rocket} label="Publish storefront" />
            )}
            <QuickAction to="/dashboard/share#qr" icon={QrCode} label="Generate QR code" />
          </div>
        </section>
      </div>
    </div>
  );
}
