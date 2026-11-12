/**
 * Brand values live here so the product can be renamed in one place.
 * This module is plain data (no browser or env access) so it can also be used
 * by vite.config.ts (index.html placeholders) and the share-preview function.
 */
export const BRAND = {
  name: 'Showcase',
  /** The central product promise. */
  promise: 'Everything you sell or do, in one simple link.',
  shortDescription:
    'Create a digital catalogue for your products, services or previous work and share it with one simple link.',
  /** Short attribution used on storefronts and QR cards. */
  poweredBy: 'Powered by Showcase',
  /** Path prefix for public storefronts: /s/{slug}. */
  storefrontPrefix: '/s',
  /** Browser UI colour (matches --background). */
  themeColor: '#FAF8F4',
} as const;
