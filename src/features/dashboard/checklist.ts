import type { Business, CatalogueItem } from '@/types/models';

export interface ChecklistItem {
  id: 'profile' | 'logo' | 'item' | 'whatsapp' | 'publish';
  label: string;
  done: boolean;
  to: string;
}

/** Getting-started checklist, derived entirely from real data. */
export function buildChecklist(business: Business, items: CatalogueItem[]): ChecklistItem[] {
  return [
    { id: 'profile', label: 'Complete your business profile', done: Boolean(business.name && business.description && business.category), to: '/dashboard/settings' },
    { id: 'logo', label: 'Add your business logo', done: Boolean(business.logo_path), to: '/dashboard/appearance' },
    { id: 'item', label: 'Add your first item', done: items.length > 0, to: '/dashboard/catalogue/new' },
    { id: 'whatsapp', label: 'Add your WhatsApp contact', done: Boolean(business.whatsapp_number), to: '/dashboard/settings#contact' },
    { id: 'publish', label: 'Publish your storefront', done: business.status === 'published', to: '/dashboard/settings#visibility' },
  ];
}
