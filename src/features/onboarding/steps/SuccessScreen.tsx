import { ArrowRight, PartyPopper, QrCode } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { displayUrl, storefrontUrl } from '@/config/site';
import { ShareActions } from '@/features/sharing/ShareActions';
import type { Business } from '@/types/models';

export function SuccessScreen({ business }: { business: Business }) {
  const url = storefrontUrl(business.slug);
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-5 flex size-16 items-center justify-center rounded-full bg-success-soft text-success">
        <PartyPopper className="size-8" aria-hidden="true" />
      </div>
      <h1 className="text-[1.75rem] font-bold sm:text-[2rem]">Your storefront is ready!</h1>
      <p className="mt-2 max-w-md text-muted-foreground">Share your link with customers on WhatsApp, Instagram, TikTok or anywhere else.</p>

      <div className="mt-8 w-full rounded-xl border border-border bg-surface p-4 text-left shadow-sm sm:p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your link</p>
        <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all font-display text-lg font-semibold text-foreground underline decoration-gold underline-offset-4">
          {displayUrl(url)}
        </a>
        <ShareActions url={url} businessName={business.name} className="mt-4" />
      </div>

      <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <Button asChild variant="secondary" size="lg">
          <Link to="/dashboard/share">
            <QrCode /> Get your QR code
          </Link>
        </Button>
        <Button asChild size="lg">
          <Link to="/dashboard">
            Go to dashboard <ArrowRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}
