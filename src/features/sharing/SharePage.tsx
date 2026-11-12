import { Download, Link2, Printer, QrCode, Rocket } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MediaImage } from '@/components/shared/MediaImage';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, Skeleton } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toaster';
import { BRAND } from '@/config/brand';
import { BUSINESS_TYPE_COPY, getAccent } from '@/config/catalog';
import { displayUrl, itemUrl, storefrontUrl } from '@/config/site';
import { useCurrentBusiness, usePublishBusiness } from '@/features/businesses/hooks';
import { useItems } from '@/features/catalogue/hooks';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useScrollToHash } from '@/hooks/useScrollToHash';
import { toUserMessage } from '@/lib/utils/errors';
import { slugify } from '@/lib/utils/slug';
import { copyText } from '@/lib/utils/share';
import { PageHeader } from '../dashboard/PageHeader';
import { downloadBlob, qrCardPng, qrPng, qrSvg, svgDataUrl } from './qr';
import { ShareActions } from './ShareActions';

export function Component() {
  usePageMeta({ title: 'Share and QR', noindex: true });
  useScrollToHash();
  const business = useCurrentBusiness();
  const items = useItems(business.id);
  const publish = usePublishBusiness();
  const [qr, setQr] = useState<{ url: string; svg: string | null; failed: boolean } | null>(null);
  const [busy, setBusy] = useState<'png' | 'svg' | 'card' | null>(null);
  const live = business.status === 'published';
  const url = storefrontUrl(business.slug);
  const fileBase = slugify(business.name) || 'storefront';
  const copy = BUSINESS_TYPE_COPY[business.business_type];

  // Regenerates whenever the storefront URL changes (e.g. after a slug change).
  useEffect(() => {
    let cancelled = false;
    qrSvg(url)
      .then((result) => !cancelled && setQr({ url, svg: result, failed: false }))
      .catch(() => !cancelled && setQr({ url, svg: null, failed: true }));
    return () => {
      cancelled = true;
    };
  }, [url]);
  const current = qr?.url === url ? qr : null;
  const svg = current?.svg ?? null;
  const qrError = current?.failed ?? false;

  async function download(kind: 'png' | 'svg' | 'card') {
    setBusy(kind);
    try {
      if (kind === 'svg' && svg) downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${fileBase}-qr.svg`);
      if (kind === 'png') downloadBlob(await qrPng(url), `${fileBase}-qr.png`);
      if (kind === 'card') downloadBlob(await qrCardPng({ businessName: business.name, url, accent: getAccent(business.accent_color).value }), `${fileBase}-qr-card.png`);
    } catch {
      toast.error('The download could not be created. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  async function goLive() {
    try {
      await publish.mutateAsync({ id: business.id, status: 'published' });
      toast.success('Your storefront is now live.');
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  const sharable = (items.data ?? []).filter((i) => i.is_published);

  return (
    <div>
      <PageHeader title="Share and QR" description="Send your link to customers or print a QR code for your counter, stall or packaging." />

      {!live && (
        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-foreground">Your storefront isn&apos;t published yet</p>
            <p className="text-sm text-muted-foreground">Customers who open your link or scan the QR code will see a “not available” page until you publish.</p>
          </div>
          <Button onClick={() => void goLive()} loading={publish.isPending}>
            <Rocket /> Publish now
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Your storefront link" />
          <CardBody className="space-y-4">
            <a href={url} target="_blank" rel="noopener noreferrer" className="block break-all font-display text-lg font-semibold underline decoration-gold underline-offset-4">
              {displayUrl(url)}
            </a>
            <ShareActions url={url} businessName={business.name} />
          </CardBody>
        </Card>

        <Card id="qr">
          <CardHeader title="QR code" description="Points to your storefront link. High resolution, ready to print." />
          <CardBody>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <div className="w-48 shrink-0 rounded-lg border border-border bg-white p-2">
                {svg ? (
                  <img src={svgDataUrl(svg)} alt={`QR code for ${displayUrl(url)}`} className="aspect-square w-full" />
                ) : qrError ? (
                  <div className="flex aspect-square items-center justify-center text-center text-sm text-muted-foreground">QR code unavailable</div>
                ) : (
                  <Skeleton className="aspect-square w-full" />
                )}
              </div>
              <div className="flex w-full flex-col gap-2">
                <Button variant="secondary" onClick={() => void download('png')} loading={busy === 'png'} disabled={!svg}>
                  <Download /> Download PNG
                </Button>
                <Button variant="secondary" onClick={() => void download('svg')} loading={busy === 'svg'} disabled={!svg}>
                  <Download /> Download SVG
                </Button>
                <p className="text-xs text-muted-foreground">SVG stays sharp at any size — best for professional printing.</p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Printable QR card" description="Display it at your counter, on your stall or inside your packaging." />
        <CardBody>
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <div id="print-area" className="w-full max-w-[18rem] rounded-xl border border-border bg-white px-6 pb-6 pt-0 text-center shadow-sm print:max-w-none print:border-0 print:shadow-none">
              <div className="-mx-6 mb-5 h-2 rounded-t-xl" style={{ background: getAccent(business.accent_color).value }} />
              <p className="font-display text-xl font-extrabold leading-tight text-[#172033]">{business.name}</p>
              <p className="mt-1 text-sm text-[#5b6375]">Scan to explore our catalogue</p>
              <div className="mx-auto mt-4 w-full max-w-[13rem] rounded-lg border border-[#e6e1d7] p-1.5">
                {svg ? <img src={svgDataUrl(svg)} alt="" className="aspect-square w-full" /> : <Skeleton className="aspect-square w-full" />}
              </div>
              <p className="mt-3 break-all text-xs font-semibold text-[#172033]">{displayUrl(url)}</p>
              <p className="mt-4 text-[0.6875rem] text-[#868c99]">{BRAND.poweredBy}</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:max-w-xs">
              <Button onClick={() => void download('card')} loading={busy === 'card'} disabled={!svg}>
                <Download /> Download card (PNG)
              </Button>
              <Button variant="secondary" onClick={() => window.print()} disabled={!svg}>
                <Printer /> Print card
              </Button>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Tip: test the code with your phone camera before printing many copies. If you change your storefront link, download a new QR code.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader title={`Share individual ${copy.itemNounPlural}`} description={`Each ${copy.itemNoun} has its own link — perfect for answering “do you have…?” messages.`} />
        {items.isPending ? (
          <CardBody>
            <Skeleton className="h-16 w-full" />
          </CardBody>
        ) : sharable.length === 0 ? (
          <CardBody>
            <p className="text-sm text-muted-foreground">Items showing on your storefront will appear here.</p>
          </CardBody>
        ) : (
          <ul className="divide-y divide-border">
            {sharable.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <MediaImage path={item.images[0]?.thumb_path ?? item.images[0]?.storage_path} alt="" aspect="1 / 1" className="w-11 shrink-0 rounded-md" />
                <p className="min-w-0 flex-1 truncate text-sm font-medium">{item.title}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!live}
                  onClick={async () => {
                    if (await copyText(itemUrl(business.slug, item.slug))) toast.success('Item link copied.');
                    else toast.error("Couldn't copy the link.");
                  }}
                >
                  <Link2 /> Copy link
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {!live && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <QrCode className="size-4" aria-hidden="true" /> Links and QR codes start working as soon as you publish.
        </p>
      )}
    </div>
  );
}
