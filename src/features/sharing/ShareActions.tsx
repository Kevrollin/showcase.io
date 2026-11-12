import { Check, Copy, ExternalLink, MessageCircle, Share2 } from 'lucide-react';
import { useState } from 'react';
import { FacebookIcon } from '@/components/shared/BrandIcons';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils/cn';
import { canNativeShare, copyText, shareOrCopy } from '@/lib/utils/share';
import { facebookShareLink, shareMessage, whatsappShareLink } from '@/lib/utils/whatsapp';

export function CopyLinkButton({ url, label = 'Copy link', className, variant = 'secondary' }: { url: string; label?: string; className?: string; variant?: 'primary' | 'secondary' }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (await copyText(url)) {
      setCopied(true);
      toast.success('Storefront link copied.');
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Couldn't copy automatically. Press and hold the link to copy it.");
    }
  }
  return (
    <Button variant={variant} onClick={() => void copy()} className={className}>
      {copied ? <Check /> : <Copy />} {copied ? 'Copied' : label}
    </Button>
  );
}

/** Copy, native share (when supported), WhatsApp, Facebook and open. */
export function ShareActions({ url, businessName, className, showOpen = true }: { url: string; businessName: string; className?: string; showOpen?: boolean }) {
  const native = canNativeShare();
  async function share() {
    const outcome = await shareOrCopy({ title: businessName, text: shareMessage(businessName, url).replace(` ${url}`, ''), url });
    if (outcome === 'copied') toast.success('Storefront link copied.');
    if (outcome === 'failed') toast.error("Sharing isn't available here. Copy the link instead.");
  }
  return (
    <div className={cn('grid grid-cols-2 gap-2 sm:flex sm:flex-wrap', className)}>
      <CopyLinkButton url={url} variant="primary" />
      {native && (
        <Button variant="secondary" onClick={() => void share()}>
          <Share2 /> Share
        </Button>
      )}
      <Button asChild variant="secondary">
        <a href={whatsappShareLink(shareMessage(businessName, url))} target="_blank" rel="noopener noreferrer">
          <MessageCircle /> WhatsApp
        </a>
      </Button>
      <Button asChild variant="secondary">
        <a href={facebookShareLink(url)} target="_blank" rel="noopener noreferrer">
          <FacebookIcon /> Facebook
        </a>
      </Button>
      {showOpen && (
        <Button asChild variant="ghost">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink /> View storefront
          </a>
        </Button>
      )}
    </div>
  );
}
