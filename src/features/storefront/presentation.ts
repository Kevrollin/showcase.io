import { Globe, Mail, Phone } from 'lucide-react';
import type { ComponentType, CSSProperties, SVGProps } from 'react';
import { FacebookIcon, InstagramIcon, TikTokIcon } from '@/components/shared/BrandIcons';
import { AVAILABILITY_LABELS, getAccent } from '@/config/catalog';
import type { PublicBusiness, PublicItemSummary } from '@/types/models';

/** CSS variables that colour a storefront with its owner's accent. */
export function accentStyle(accentId: string): CSSProperties {
  const accent = getAccent(accentId);
  return { '--sf-accent': accent.value, '--sf-accent-tint': accent.tint } as CSSProperties;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0]![0]}${parts[1]![0]}` : (parts[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}

export function availabilityLabel(item: Pick<PublicItemSummary, 'item_type' | 'availability_status'>): string | null {
  return AVAILABILITY_LABELS[item.item_type][item.availability_status] ?? null;
}

export type ContactFields = Pick<
  PublicBusiness,
  'whatsapp_number' | 'phone_number' | 'contact_email' | 'instagram_url' | 'tiktok_url' | 'facebook_url' | 'website_url'
>;

export interface SecondaryLink {
  key: string;
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  external: boolean;
}

/** Optional contact channels, in display order. Only configured ones are returned. */
export function secondaryContactLinks(business: ContactFields): SecondaryLink[] {
  const links: SecondaryLink[] = [];
  if (business.phone_number) links.push({ key: 'call', label: 'Call', href: `tel:${business.phone_number}`, icon: Phone, external: false });
  if (business.contact_email) links.push({ key: 'email', label: 'Email', href: `mailto:${business.contact_email}`, icon: Mail, external: false });
  if (business.instagram_url) links.push({ key: 'instagram', label: 'Instagram', href: business.instagram_url, icon: InstagramIcon, external: true });
  if (business.tiktok_url) links.push({ key: 'tiktok', label: 'TikTok', href: business.tiktok_url, icon: TikTokIcon, external: true });
  if (business.facebook_url) links.push({ key: 'facebook', label: 'Facebook', href: business.facebook_url, icon: FacebookIcon, external: true });
  if (business.website_url) links.push({ key: 'website', label: 'Website', href: business.website_url, icon: Globe, external: true });
  return links;
}
