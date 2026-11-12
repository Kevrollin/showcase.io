import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { AppError } from '@/lib/utils/errors';
import type { Database } from '@/types/database';

/**
 * Supabase client for signed-in areas (auth, onboarding, dashboard).
 * Public pages must NOT import this module — they use ./publicApi instead so
 * the storefront bundle stays small.
 *
 * Only the public anon key is used; RLS policies are the security boundary.
 */
export const supabase = createClient<Database>(
  env.supabaseUrl || 'http://127.0.0.1:54321',
  env.supabaseAnonKey || 'public-anon-key-not-configured',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Auth redirects are handled explicitly in /auth/confirm and /auth/callback
      // so errors (expired links, wrong device) can be shown properly.
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  },
);

/** The signed-in user's id, taken from the verified session (never from input). */
export async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (error || !id) throw new AppError('Please sign in to continue.', 'not_authenticated');
  return id;
}
