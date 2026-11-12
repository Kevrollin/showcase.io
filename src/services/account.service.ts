import { requireUserId, supabase } from '@/lib/supabase/client';
import { removeFolder } from './media.service';

export async function getProfile(): Promise<{ id: string; full_name: string | null }> {
  const userId = await requireUserId();
  const { data, error } = await supabase.from('profiles').select('id, full_name').eq('id', userId).single();
  if (error) throw error;
  return data;
}

export async function updateProfileName(fullName: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from('profiles').update({ full_name: fullName.trim() || null }).eq('id', userId);
  if (error) throw error;
}

/**
 * Account deletion (see SECURITY.md):
 *   1. remove every Storage object under the caller's folder (RLS: own folder only),
 *   2. call delete_my_account(), a SECURITY DEFINER function that deletes
 *      auth.uid() — and nothing else — cascading to all business data,
 *   3. clear the local session.
 * No privileged key is ever used in the browser.
 */
export async function deleteMyAccount(): Promise<void> {
  const userId = await requireUserId();
  await removeFolder(userId);
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  await supabase.auth.signOut({ scope: 'local' });
}
