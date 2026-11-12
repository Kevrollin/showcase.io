import { supabase } from '@/lib/supabase/client';
import type { Category } from '@/types/models';

const CATEGORY_COLUMNS = 'id, business_id, name, sort_order' as const;

export async function listCategories(businessId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select(CATEGORY_COLUMNS)
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createCategory(businessId: string, name: string, sortOrder: number): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({ business_id: businessId, name: name.trim(), sort_order: sortOrder })
    .select(CATEGORY_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function renameCategory(id: string, name: string): Promise<Category> {
  const { data, error } = await supabase.from('categories').update({ name: name.trim() }).eq('id', id).select(CATEGORY_COLUMNS).single();
  if (error) throw error;
  return data;
}

/**
 * Deletes a category. Items are kept: optionally moved to another category
 * first, otherwise the database sets their category to NULL (uncategorised).
 */
export async function deleteCategory(category: Category, moveItemsTo: string | null): Promise<void> {
  if (moveItemsTo) {
    const { error } = await supabase
      .from('catalogue_items')
      .update({ category_id: moveItemsTo })
      .eq('business_id', category.business_id)
      .eq('category_id', category.id);
    if (error) throw error;
  }
  const { error } = await supabase.from('categories').delete().eq('id', category.id);
  if (error) throw error;
}

export async function reorderCategories(businessId: string, orderedIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('reorder_categories', { p_business_id: businessId, p_category_ids: orderedIds });
  if (error) throw error;
}
