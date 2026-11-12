import { formatPhone, toLocalKenyan } from '@/lib/utils/phone';
import type { ContactValues, IdentityValues } from '@/lib/validation/schemas';
import type { Business } from '@/types/models';

/* Form <-> database mapping for the business identity and contact forms. */

export function identityDefaults(business: Business | null, draft?: Partial<IdentityValues> | null): IdentityValues {
  return {
    name: draft?.name ?? business?.name ?? '',
    description: draft?.description ?? business?.description ?? '',
    category: draft?.category ?? business?.category ?? '',
    location_label: draft?.location_label ?? business?.location_label ?? '',
  };
}

export function identityToColumns(values: IdentityValues) {
  return {
    name: values.name,
    description: values.description || null,
    category: values.category || null,
    location_label: values.location_label || null,
  };
}

export function contactDefaults(business: Business | null): ContactValues {
  const handle = (url: string | null, prefix: RegExp) => (url ? url.replace(prefix, '').replace(/\/$/, '') : '');
  return {
    whatsapp_number: toLocalKenyan(business?.whatsapp_number) || formatPhone(business?.whatsapp_number),
    phone_number: toLocalKenyan(business?.phone_number) || formatPhone(business?.phone_number),
    contact_email: business?.contact_email ?? '',
    instagram: handle(business?.instagram_url ?? null, /^https:\/\/(www\.)?instagram\.com\//),
    tiktok: handle(business?.tiktok_url ?? null, /^https:\/\/(www\.)?tiktok\.com\//),
    facebook: business?.facebook_url ?? '',
    website: business?.website_url ?? '',
  };
}
