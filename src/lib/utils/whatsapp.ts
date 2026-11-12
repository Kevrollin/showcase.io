import { toWhatsAppDigits } from './phone';

/**
 * Click-to-chat link: https://wa.me/<digits>?text=<url-encoded message>
 * The number must be in international format without "+", spaces or dashes.
 */
export function whatsappLink(e164: string, message?: string): string {
  const base = `https://wa.me/${toWhatsAppDigits(e164)}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function storefrontEnquiry(businessName: string): string {
  return `Hi ${businessName}, I found your catalogue and I'd like to know more.`;
}

export function itemEnquiry(itemTitle: string, itemUrl?: string): string {
  const line = `Hi, I found your catalogue and I'm interested in the ${itemTitle}.`;
  return itemUrl ? `${line}\n${itemUrl}` : line;
}

/** WhatsApp share without a recipient: https://wa.me/?text=… */
export function whatsappShareLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function facebookShareLink(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}

/** Text used when an owner shares their storefront. */
export function shareMessage(businessName: string, url: string): string {
  return `Check out ${businessName} — see everything we offer here: ${url}`;
}
