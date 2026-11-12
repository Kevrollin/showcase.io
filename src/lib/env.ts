/**
 * Typed access to public (VITE_) environment variables.
 * Only public values may ever be read here — never a service-role key.
 */
function read(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export const env = {
  supabaseUrl: read(import.meta.env.VITE_SUPABASE_URL).replace(/\/+$/, ''),
  supabaseAnonKey: read(import.meta.env.VITE_SUPABASE_ANON_KEY),
  siteUrl: read(import.meta.env.VITE_SITE_URL).replace(/\/+$/, ''),
  contactEmail: read(import.meta.env.VITE_CONTACT_EMAIL),
} as const;

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
