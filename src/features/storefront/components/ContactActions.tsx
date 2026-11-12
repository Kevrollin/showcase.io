import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { whatsappLink } from '@/lib/utils/whatsapp';
import { secondaryContactLinks, type ContactFields } from '../presentation';

export function WhatsAppButton({
  number,
  message,
  label = 'Chat on WhatsApp',
  className,
  size = 'lg',
}: {
  number: string;
  message: string;
  label?: string;
  className?: string;
  size?: 'md' | 'lg';
}) {
  return (
    <Button asChild variant="whatsapp" size={size} className={className}>
      <a href={whatsappLink(number, message)} target="_blank" rel="noopener noreferrer">
        <MessageCircle aria-hidden="true" />
        {label}
      </a>
    </Button>
  );
}

const LINK_STYLES = {
  light: 'border-border-strong bg-surface text-foreground shadow-xs hover:bg-surface-muted',
  // On top of the hero photo: translucent, readable over the dark scrim.
  dark: 'border-white/25 bg-white/10 text-white hover:bg-white/20',
} as const;

/**
 * WhatsApp first, then only the channels the owner configured. On phones the
 * secondary links sit in one row that scrolls sideways (soft snapping and
 * faded edges); on wider screens they wrap inline next to WhatsApp.
 */
export function ContactActions({
  business,
  message,
  align = 'start',
  tone = 'light',
  className,
}: {
  business: ContactFields;
  message: string;
  align?: 'start' | 'center';
  tone?: keyof typeof LINK_STYLES;
  className?: string;
}) {
  const links = secondaryContactLinks(business);
  if (!business.whatsapp_number && links.length === 0) return null;
  return (
    <div className={cn('flex flex-col gap-2.5 @2xl:flex-row @2xl:flex-wrap @2xl:items-center @2xl:gap-2', align === 'center' && '@2xl:justify-center', className)}>
      {business.whatsapp_number && <WhatsAppButton number={business.whatsapp_number} message={message} className="w-full @2xl:w-auto" />}
      {links.length > 0 && (
        <div className="scrollbar-none scroll-fade-x -mx-4 snap-x snap-proximity overflow-x-auto overscroll-x-contain scroll-smooth px-4 @2xl:mx-0 @2xl:overflow-visible @2xl:px-0">
          <ul aria-label="Other ways to get in touch" className={cn('flex w-max gap-2 @2xl:w-auto @2xl:flex-wrap', align === 'center' && 'mx-auto')}>
            {links.map(({ key, label, href, icon: Icon, external }) => (
              <li key={key} className="shrink-0 snap-start scroll-ml-4">
                <a
                  href={href}
                  {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className={cn(
                    'inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-md border px-3.5 text-sm font-medium transition-colors',
                    LINK_STYLES[tone],
                  )}
                >
                  <Icon className="size-[1.125rem]" />
                  <span>{label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
