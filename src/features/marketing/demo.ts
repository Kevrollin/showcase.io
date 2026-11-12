/**
 * Example storefronts for the marketing page. Clearly labelled as examples;
 * images are small inline SVG illustrations (no stock photos, no network).
 */
import type { PublicBusiness, PublicItemSummary } from '@/types/models';

function svg(body: string, bg: string): string {
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="${bg}"/>${body}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

const sneakerBody = (shoe: string, sole: string, accent: string) =>
  `<ellipse cx="200" cy="290" rx="150" ry="16" fill="#000" opacity=".08"/>
   <path d="M70 250c0-30 20-48 46-52l58-8c18-3 30-14 40-30l14-22c6-9 18-12 27-6l20 13c14 9 22 24 22 40v20c0 12 8 20 20 22l30 6c22 4 33 18 33 36v6H70z" fill="${shoe}"/>
   <path d="M70 262h310v14c0 6-5 10-11 10H82c-7 0-12-5-12-12z" fill="${sole}"/>
   <path d="M188 170l40 24M206 156l40 24M224 144l36 22" stroke="${accent}" stroke-width="7" stroke-linecap="round"/>
   <path d="M110 232c40 4 90-2 140-20" stroke="${accent}" stroke-width="9" fill="none" stroke-linecap="round" opacity=".9"/>`;

const sneaker = (shoe: string, sole: string, bg: string, accent: string) => svg(sneakerBody(shoe, sole, accent), bg);

/** Wide shop-shelf illustration used as the demo storefront's cover photo. */
function shelfCover(): string {
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000">
    <rect width="1600" height="1000" fill="#c98e6c"/>
    <rect y="640" width="1600" height="360" fill="#8f5b44"/>
    <circle cx="1330" cy="250" r="190" fill="#e4b896" opacity=".55"/>
    <rect x="180" y="560" width="1240" height="26" rx="6" fill="#f3e6d6"/>
    <g transform="translate(150 215) scale(1.05)">${sneakerBody('#f4f1ea', '#2b2d31', '#b5532e')}</g>
    <g transform="translate(590 205) scale(1.08)">${sneakerBody('#1f2a44', '#f4f1ea', '#c9a24f')}</g>
    <g transform="translate(1030 215) scale(1.05)">${sneakerBody('#2e5e4e', '#efe6d2', '#f4f1ea')}</g>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

const tote = (bag: string, bg: string, print: string) =>
  svg(
    `<path d="M150 150c0-40 20-62 50-62s50 22 50 62" stroke="${bag}" stroke-width="12" fill="none"/>
     <path d="M110 150h180l-14 170H124z" fill="${bag}"/>
     <circle cx="200" cy="230" r="34" fill="${print}"/><path d="M182 230h36M200 212v36" stroke="${bag}" stroke-width="8" stroke-linecap="round"/>`,
    bg,
  );

const cap = (color: string, bg: string) =>
  svg(
    `<ellipse cx="200" cy="292" rx="130" ry="14" fill="#000" opacity=".08"/>
     <path d="M90 250c0-70 50-120 110-120s110 50 110 120z" fill="${color}"/>
     <path d="M200 250h150c10 0 14 14 4 18l-30 12H200z" fill="${color}" opacity=".85"/>
     <circle cx="200" cy="130" r="9" fill="#fff" opacity=".5"/>`,
    bg,
  );

const hoodie = (color: string, bg: string) =>
  svg(
    `<path d="M150 110c10-18 28-26 50-26s40 8 50 26l60 40-24 58-26-14v130H140V194l-26 14-24-58z" fill="${color}"/>
     <path d="M168 110c6 26 18 40 32 40s26-14 32-40" stroke="#fff" stroke-width="6" fill="none" opacity=".45"/>
     <rect x="160" y="250" width="80" height="34" rx="8" fill="#fff" opacity=".18"/>`,
    bg,
  );

const poster = (bg: string, a: string, b: string) =>
  svg(
    `<rect x="95" y="60" width="210" height="280" rx="6" fill="#fff"/>
     <rect x="115" y="80" width="170" height="150" rx="4" fill="${a}"/>
     <circle cx="200" cy="155" r="44" fill="${b}"/>
     <rect x="115" y="250" width="120" height="14" rx="4" fill="#172033"/>
     <rect x="115" y="276" width="160" height="9" rx="4" fill="#c9c1b2"/>
     <rect x="115" y="294" width="100" height="9" rx="4" fill="#c9c1b2"/>`,
    bg,
  );

const logoMark = (bg: string, ink: string, gold: string) =>
  svg(
    `<rect x="70" y="90" width="260" height="220" rx="14" fill="#fff"/>
     <circle cx="200" cy="180" r="48" fill="${ink}"/>
     <path d="M178 180l16 16 30-34" stroke="${gold}" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
     <rect x="140" y="250" width="120" height="14" rx="5" fill="${ink}"/>
     <rect x="160" y="274" width="80" height="8" rx="4" fill="#c9c1b2"/>`,
    bg,
  );

const cards = (bg: string, ink: string, gold: string) =>
  svg(
    `<g transform="rotate(-8 200 200)"><rect x="90" y="150" width="220" height="130" rx="10" fill="${ink}"/><rect x="112" y="250" width="70" height="8" rx="4" fill="${gold}"/></g>
     <g transform="rotate(6 200 200)"><rect x="100" y="120" width="220" height="130" rx="10" fill="#fff"/><circle cx="140" cy="160" r="16" fill="${gold}"/><rect x="124" y="196" width="110" height="10" rx="4" fill="${ink}"/><rect x="124" y="214" width="76" height="8" rx="4" fill="#c9c1b2"/></g>`,
    bg,
  );

const tshirt = (color: string, bg: string, mark: string) =>
  svg(
    `<path d="M150 90h100l70 44-28 52-32-16v150H140V170l-32 16-28-52z" fill="${color}"/>
     <path d="M170 90c4 18 14 28 30 28s26-10 30-28" fill="${bg}"/>
     <circle cx="200" cy="190" r="26" fill="${mark}"/>`,
    bg,
  );

const banner = (bg: string, ink: string, gold: string) =>
  svg(
    `<rect x="150" y="70" width="100" height="270" rx="6" fill="#fff"/>
     <rect x="150" y="70" width="100" height="110" rx="6" fill="${ink}"/>
     <circle cx="200" cy="125" r="26" fill="${gold}"/>
     <rect x="166" y="200" width="68" height="10" rx="4" fill="${ink}"/>
     <rect x="166" y="220" width="50" height="8" rx="4" fill="#c9c1b2"/>
     <rect x="186" y="340" width="28" height="20" fill="#9b937f"/>`,
    bg,
  );

function item(partial: Partial<PublicItemSummary> & Pick<PublicItemSummary, 'id' | 'title'>, image: string): PublicItemSummary {
  return {
    slug: partial.id,
    summary: null,
    item_type: 'product',
    category_id: null,
    price: null,
    currency: 'KES',
    price_mode: 'fixed',
    availability_status: 'available',
    is_featured: false,
    image_count: 1,
    ...partial,
    image: { path: image, thumb_path: null, width: 400, height: 400, alt: partial.title },
  };
}

const base: Omit<PublicBusiness, 'id' | 'name' | 'slug' | 'business_type' | 'theme_id' | 'accent_color' | 'item_count' | 'item_types' | 'categories'> = {
  description: null,
  tagline: null,
  category: null,
  location_label: null,
  whatsapp_number: '+254700000000',
  phone_number: null,
  contact_email: null,
  instagram_url: null,
  tiktok_url: null,
  facebook_url: null,
  website_url: null,
  logo_path: null,
  cover_path: null,
  share_image_path: null,
};

export const DEMO_SHOP: { business: PublicBusiness; items: PublicItemSummary[] } = {
  business: {
    ...base,
    id: 'demo-shop',
    name: 'Campus Kicks',
    slug: 'campus-kicks',
    tagline: 'Sneakers & streetwear, delivered on campus',
    business_type: 'products',
    category: 'shoes',
    location_label: 'Egerton University, Njoro',
    instagram_url: 'https://instagram.com/example',
    phone_number: '+254700000000',
    website_url: 'https://example.com',
    cover_path: shelfCover(),
    theme_id: 'shop',
    accent_color: 'terracotta',
    item_count: 6,
    item_types: { product: 6 },
    categories: [
      { id: 'c1', name: 'Sneakers', item_count: 3 },
      { id: 'c2', name: 'Bags', item_count: 1 },
      { id: 'c3', name: 'Apparel', item_count: 2 },
    ],
  },
  items: [
    item({ id: 'airmax', title: 'Air Max 90 — White/Red', price: 4500, is_featured: true, category_id: 'c1' }, sneaker('#f4f1ea', '#2b2d31', '#e8e1d4', '#b5532e')),
    item({ id: 'runner', title: 'Classic Runner — Navy', price: 3800, category_id: 'c1' }, sneaker('#1f2a44', '#f4f1ea', '#dde3ee', '#c9a24f')),
    item({ id: 'tote', title: 'Canvas Tote Bag', price: 1200, category_id: 'c2' }, tote('#c9b68f', '#f2ede3', '#1f6f6b')),
    item({ id: 'hoodie', title: 'Oversized Hoodie', price: 2500, availability_status: 'preorder', category_id: 'c3' }, hoodie('#2e5e4e', '#e9f0ec')),
    item({ id: 'cap', title: 'Dad Cap — Sand', price: 900, category_id: 'c3' }, cap('#a4472a', '#f7ece6')),
    item({ id: 'court', title: 'Court Low — Cream', price: 4200, availability_status: 'unavailable', category_id: 'c1' }, sneaker('#efe6d2', '#8a6a1f', '#f5eddd', '#2e5e4e')),
  ],
};

export const DEMO_STUDIO: { business: PublicBusiness; items: PublicItemSummary[] } = {
  business: {
    ...base,
    id: 'demo-studio',
    name: 'Kelvin Designs',
    slug: 'kelvin-designs',
    description: 'Creative graphic design, branding and printing services for students, clubs and small businesses.',
    business_type: 'mixed',
    category: 'graphic-design',
    location_label: 'Egerton University / Njoro',
    instagram_url: 'https://instagram.com/example',
    tiktok_url: 'https://www.tiktok.com/@example',
    theme_id: 'minimal',
    accent_color: 'navy',
    item_count: 6,
    item_types: { service: 4, product: 2 },
    categories: [
      { id: 'k1', name: 'Branding', item_count: 2 },
      { id: 'k2', name: 'Posters & flyers', item_count: 2 },
      { id: 'k3', name: 'Printing', item_count: 2 },
    ],
  },
  items: [
    item({ id: 'logo', title: 'Logo design', item_type: 'service', price: 2500, price_mode: 'starting_from', is_featured: true, category_id: 'k1', summary: '3 concepts, 2 revisions, all files.' }, logoMark('#eef0f5', '#1f2a44', '#c9a24f')),
    item({ id: 'poster', title: 'Event poster design', item_type: 'service', price: 1500, price_mode: 'starting_from', category_id: 'k2', summary: 'Ready in 48 hours.' }, poster('#f5eddd', '#1d5b85', '#e7b75a')),
    item({ id: 'cards', title: 'Business cards (100 pcs)', price: 1800, category_id: 'k3' }, cards('#e8f3f2', '#1f2a44', '#c9a24f')),
    item({ id: 'brand', title: 'Full brand identity', item_type: 'service', price_mode: 'quote', category_id: 'k1', summary: 'Logo, colours, fonts and templates.' }, banner('#f8ecef', '#a23e58', '#f5eddd')),
    item({ id: 'tee', title: 'Custom printed T-shirt', price: 850, category_id: 'k3' }, tshirt('#1f2a44', '#f2ede3', '#c9a24f')),
    item({ id: 'flyer', title: 'Flyer & social media pack', item_type: 'service', price: 2000, price_mode: 'starting_from', category_id: 'k2' }, poster('#e9f1f7', '#2e5e4e', '#f4f1ea')),
  ],
};
