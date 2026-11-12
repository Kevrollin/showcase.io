import { requireUserId, supabase } from '@/lib/supabase/client';
import { AppError } from '@/lib/utils/errors';
import type { EncodedImage } from '@/lib/utils/image';
import type { TablesInsert, TablesUpdate } from '@/types/database';
import { toBusiness, type Business, type Plan } from '@/types/models';
import { brandPath, removeFolder, removeObjects, uploadEncoded, type ProgressHandler } from './media.service';

export const BUSINESS_COLUMNS =
  'id, owner_id, name, slug, description, tagline, business_type, category, location_label, whatsapp_number, phone_number, contact_email, instagram_url, tiktok_url, facebook_url, website_url, logo_path, cover_path, share_image_path, theme_id, accent_color, status, published_at, onboarding_step, onboarding_completed_at, created_at, updated_at' as const;

export type BusinessCreate = Omit<TablesInsert<'businesses'>, 'id' | 'owner_id' | 'status' | 'published_at' | 'created_at' | 'updated_at'>;
export type BusinessPatch = Omit<TablesUpdate<'businesses'>, 'id' | 'owner_id' | 'published_at' | 'created_at' | 'updated_at'>;

/** Businesses owned by the signed-in user (RLS also exposes others' published ones, so filter). */
export async function listMyBusinesses(): Promise<Business[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('businesses')
    .select(BUSINESS_COLUMNS)
    .eq('owner_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data.map(toBusiness);
}

export async function createBusiness(input: BusinessCreate): Promise<Business> {
  // owner_id is set by the database from auth.uid(); never sent by the client.
  const { data, error } = await supabase.from('businesses').insert(input).select(BUSINESS_COLUMNS).single();
  if (error) throw error;
  return toBusiness(data);
}

export async function updateBusiness(id: string, patch: BusinessPatch): Promise<Business> {
  const { data, error } = await supabase.from('businesses').update(patch).eq('id', id).select(BUSINESS_COLUMNS).single();
  if (error) throw error;
  return toBusiness(data);
}

export async function setBusinessStatus(id: string, status: 'published' | 'unpublished'): Promise<Business> {
  return updateBusiness(id, status === 'published' ? { status, onboarding_completed_at: new Date().toISOString() } : { status });
}

export async function isSlugAvailable(slug: string, businessId?: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_slug_available', { p_slug: slug, p_business_id: businessId });
  if (error) throw error;
  return data === true;
}

export async function getMyPlan(): Promise<Plan> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('profiles')
    .select('plan_id, plans(id, name, max_businesses, max_published_businesses, max_items_per_business, max_images_per_item)')
    .eq('id', userId)
    .single();
  if (error) throw error;
  if (!data.plans) throw new AppError('Your plan could not be loaded.', 'plan_missing');
  return data.plans;
}

// ─── Brand images ────────────────────────────────────────────────────────────

export async function uploadLogo(business: Business, logo: EncodedImage, onProgress?: ProgressHandler): Promise<Business> {
  const path = brandPath(business.owner_id, business.id, 'logo', logo.extension);
  await uploadEncoded(path, logo, onProgress);
  try {
    const updated = await updateBusiness(business.id, { logo_path: path });
    await removeObjects([business.logo_path]);
    return updated;
  } catch (error) {
    await removeObjects([path]);
    throw error;
  }
}

export async function uploadCover(
  business: Business,
  images: { cover: EncodedImage; share: EncodedImage },
  onProgress?: ProgressHandler,
): Promise<Business> {
  const coverPath = brandPath(business.owner_id, business.id, 'cover', images.cover.extension);
  const sharePath = brandPath(business.owner_id, business.id, 'share', images.share.extension);
  const coverWeight = images.cover.blob.size / (images.cover.blob.size + images.share.blob.size);
  await uploadEncoded(coverPath, images.cover, (f) => onProgress?.(f * coverWeight));
  try {
    await uploadEncoded(sharePath, images.share, (f) => onProgress?.(coverWeight + f * (1 - coverWeight)));
  } catch (error) {
    await removeObjects([coverPath]);
    throw error;
  }
  try {
    const updated = await updateBusiness(business.id, { cover_path: coverPath, share_image_path: sharePath });
    await removeObjects([business.cover_path, business.share_image_path]);
    return updated;
  } catch (error) {
    await removeObjects([coverPath, sharePath]);
    throw error;
  }
}

export async function removeBrandImage(business: Business, kind: 'logo' | 'cover'): Promise<Business> {
  if (kind === 'logo') {
    const updated = await updateBusiness(business.id, { logo_path: null });
    await removeObjects([business.logo_path]);
    return updated;
  }
  const updated = await updateBusiness(business.id, { cover_path: null, share_image_path: null });
  await removeObjects([business.cover_path, business.share_image_path]);
  return updated;
}

// ─── Deletion ────────────────────────────────────────────────────────────────

/**
 * Deletes a business and everything in it. Storage objects are removed first
 * (they cannot be deleted from SQL); the row deletion cascades to categories,
 * items and image records.
 */
export async function deleteBusiness(business: Business): Promise<void> {
  await removeFolder(`${business.owner_id}/${business.id}`);
  const { error } = await supabase.from('businesses').delete().eq('id', business.id);
  if (error) throw error;
}
