/**
 * Client-side mirror of private.slugify / private.is_valid_slug in the database.
 * The database remains the authority; this is for instant feedback.
 */
export const SLUG_MIN = 3;
export const SLUG_MAX = 48;

export const RESERVED_SLUGS = new Set([
  'about', 'account', 'admin', 'api', 'app', 'assets', 'auth', 'billing', 'blog', 'contact',
  'dashboard', 'docs', 'edit', 'favicon', 'help', 'home', 'login', 'logout', 'new', 'null',
  'onboarding', 'pricing', 'privacy', 'register', 'reset-password', 'root', 's', 'settings',
  'showcase', 'signin', 'signup', 'static', 'status', 'support', 'terms', 'undefined', 'www',
]);

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export type SlugProblem = 'too_short' | 'too_long' | 'format' | 'reserved';

export function validateSlug(slug: string): SlugProblem | null {
  if (slug.length < SLUG_MIN) return 'too_short';
  if (slug.length > SLUG_MAX) return 'too_long';
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return 'format';
  if (RESERVED_SLUGS.has(slug)) return 'reserved';
  return null;
}

export const SLUG_PROBLEM_MESSAGES: Record<SlugProblem, string> = {
  too_short: `Use at least ${SLUG_MIN} characters.`,
  too_long: `Use at most ${SLUG_MAX} characters.`,
  format: 'Use lowercase letters, numbers and single hyphens (e.g. kelvin-designs).',
  reserved: 'This address is reserved. Please choose another one.',
};
