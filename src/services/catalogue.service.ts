import { supabase } from '@/lib/supabase/client';
import { toUserMessage } from '@/lib/utils/errors';
import type { EncodedImage } from '@/lib/utils/image';
import type { TablesInsert, TablesUpdate } from '@/types/database';
import { toCatalogueItem, type CatalogueImage, type CatalogueItem } from '@/types/models';
import { copyObject, itemImagePaths, newMediaId, removeObjects, uploadEncoded, type ProgressHandler } from './media.service';

const IMAGE_COLUMNS = 'id, item_id, storage_path, thumb_path, width, height, alt_text, sort_order, byte_size' as const;
export const ITEM_COLUMNS =
  `id, business_id, category_id, item_type, title, slug, description, price, currency, price_mode, availability_status, is_featured, is_published, sort_order, created_at, updated_at, catalogue_images(${IMAGE_COLUMNS})` as const;

export type ItemCreate = Omit<TablesInsert<'catalogue_items'>, 'id' | 'slug' | 'created_at' | 'updated_at' | 'currency'>;
export type ItemPatch = Omit<TablesUpdate<'catalogue_items'>, 'id' | 'business_id' | 'slug' | 'created_at' | 'updated_at'>;

export async function listItems(businessId: string): Promise<CatalogueItem[]> {
  const { data, error } = await supabase
    .from('catalogue_items')
    .select(ITEM_COLUMNS)
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(toCatalogueItem);
}

export async function getItem(itemId: string): Promise<CatalogueItem | null> {
  const { data, error } = await supabase.from('catalogue_items').select(ITEM_COLUMNS).eq('id', itemId).maybeSingle();
  if (error) throw error;
  return data ? toCatalogueItem(data) : null;
}

/** New items go to the top of the catalogue. */
async function nextTopSortOrder(businessId: string): Promise<number> {
  const { data, error } = await supabase
    .from('catalogue_items')
    .select('sort_order')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? data.sort_order - 1 : 0;
}

export async function createItem(input: ItemCreate): Promise<CatalogueItem> {
  const sort_order = input.sort_order ?? (await nextTopSortOrder(input.business_id));
  const { data, error } = await supabase
    .from('catalogue_items')
    .insert({ ...input, sort_order })
    .select(ITEM_COLUMNS)
    .single();
  if (error) throw error;
  return toCatalogueItem(data);
}

export async function updateItem(itemId: string, patch: ItemPatch): Promise<CatalogueItem> {
  const { data, error } = await supabase.from('catalogue_items').update(patch).eq('id', itemId).select(ITEM_COLUMNS).single();
  if (error) throw error;
  return toCatalogueItem(data);
}

/** Deletes the row (cascading to image rows), then the files. */
export async function deleteItem(item: CatalogueItem): Promise<void> {
  const { error } = await supabase.from('catalogue_items').delete().eq('id', item.id);
  if (error) throw error;
  await removeObjects(item.images.flatMap((im) => [im.storage_path, im.thumb_path]));
}

export async function reorderItems(businessId: string, orderedIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('reorder_items', { p_business_id: businessId, p_item_ids: orderedIds });
  if (error) throw error;
}

// ─── Images ──────────────────────────────────────────────────────────────────

export interface NewImageDraft {
  kind: 'new';
  key: string;
  main: EncodedImage;
  thumb: EncodedImage;
  previewUrl: string;
  fileName: string;
}

export interface ExistingImageDraft {
  kind: 'existing';
  key: string;
  image: CatalogueImage;
}

export type ImageDraft = NewImageDraft | ExistingImageDraft;

export interface SaveImagesResult {
  failed: Array<{ key: string; message: string }>;
}

/**
 * Applies the image editor state to an item:
 *   1. uploads new images (main + thumbnail) and records them,
 *   2. removes deleted images (row first, then files),
 *   3. persists the final order (first image = primary).
 * A failed upload never leaves an orphaned file or a broken record; failures
 * are returned so the UI can offer a retry.
 */
export async function saveItemImages(params: {
  userId: string;
  businessId: string;
  itemId: string;
  altText: string;
  drafts: ImageDraft[];
  removed: CatalogueImage[];
  onProgress?: (key: string, fraction: number) => void;
}): Promise<SaveImagesResult> {
  const { userId, businessId, itemId, altText, drafts, removed, onProgress } = params;
  const failed: SaveImagesResult['failed'] = [];
  const finalOrder: string[] = [];

  if (removed.length > 0) {
    const { error } = await supabase.from('catalogue_images').delete().in('id', removed.map((im) => im.id));
    if (error) throw error;
    await removeObjects(removed.flatMap((im) => [im.storage_path, im.thumb_path]));
  }

  for (const [index, draft] of drafts.entries()) {
    if (draft.kind === 'existing') {
      finalOrder.push(draft.image.id);
      continue;
    }
    const imageId = newMediaId();
    const paths = itemImagePaths(userId, businessId, itemId, imageId, draft.main.extension);
    const report: ProgressHandler = (f) => onProgress?.(draft.key, f);
    const mainShare = draft.main.blob.size / (draft.main.blob.size + draft.thumb.blob.size);
    try {
      await uploadEncoded(paths.main, draft.main, (f) => report(f * mainShare));
      await uploadEncoded(paths.thumb, draft.thumb, (f) => report(mainShare + f * (1 - mainShare)));
      const { error } = await supabase.from('catalogue_images').insert({
        id: imageId,
        business_id: businessId,
        item_id: itemId,
        storage_path: paths.main,
        thumb_path: paths.thumb,
        width: draft.main.width,
        height: draft.main.height,
        byte_size: draft.main.blob.size,
        alt_text: altText.slice(0, 200),
        sort_order: index,
      });
      if (error) throw error;
      finalOrder.push(imageId);
    } catch (error) {
      await removeObjects([paths.main, paths.thumb]);
      failed.push({ key: draft.key, message: toUserMessage(error, 'This image could not be uploaded.') });
    }
  }

  if (finalOrder.length > 0) {
    const { error } = await supabase.rpc('reorder_images', { p_item_id: itemId, p_image_ids: finalOrder });
    if (error) throw error;
  }
  return { failed };
}

/** Copies an item (as an unpublished draft) including its images. */
export async function duplicateItem(item: CatalogueItem, userId: string): Promise<CatalogueItem> {
  const copy = await createItem({
    business_id: item.business_id,
    category_id: item.category_id,
    item_type: item.item_type,
    title: `${item.title} (copy)`.slice(0, 100),
    description: item.description,
    price: item.price,
    price_mode: item.price_mode,
    availability_status: item.availability_status,
    is_featured: false,
    is_published: false,
  });

  const records: TablesInsert<'catalogue_images'>[] = [];
  const created: string[] = [];
  try {
    for (const image of item.images) {
      const imageId = newMediaId();
      const ext = image.storage_path.split('.').pop() ?? 'webp';
      const paths = itemImagePaths(userId, item.business_id, copy.id, imageId, ext);
      await copyObject(image.storage_path, paths.main);
      created.push(paths.main);
      if (image.thumb_path) {
        await copyObject(image.thumb_path, paths.thumb);
        created.push(paths.thumb);
      }
      records.push({
        id: imageId,
        business_id: item.business_id,
        item_id: copy.id,
        storage_path: paths.main,
        thumb_path: image.thumb_path ? paths.thumb : null,
        width: image.width,
        height: image.height,
        byte_size: image.byte_size,
        alt_text: image.alt_text,
        sort_order: image.sort_order,
      });
    }
    if (records.length > 0) {
      const { error } = await supabase.from('catalogue_images').insert(records);
      if (error) throw error;
    }
  } catch (error) {
    await removeObjects(created);
    await supabase.from('catalogue_items').delete().eq('id', copy.id);
    throw error;
  }
  return (await getItem(copy.id)) ?? copy;
}
