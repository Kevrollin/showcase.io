import { MEDIA } from '@/config/catalog';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase/client';
import { AppError } from '@/lib/utils/errors';
import type { EncodedImage } from '@/lib/utils/image';

/**
 * Supabase Storage access for the media bucket.
 *
 * Paths always follow  {user_id}/{business_id}/{brand|item_id}/{file}  —
 * Storage RLS (see 20261111090400_storage.sql) rejects anything else.
 */

export type ProgressHandler = (fraction: number) => void;

export function newMediaId(): string {
  return crypto.randomUUID();
}

export function brandPath(userId: string, businessId: string, kind: 'logo' | 'cover' | 'share', ext: string): string {
  return `${userId}/${businessId}/brand/${kind}-${newMediaId()}.${ext}`;
}

export function itemImagePaths(userId: string, businessId: string, itemId: string, imageId: string, ext: string) {
  const folder = `${userId}/${businessId}/${itemId}`;
  return { main: `${folder}/${imageId}.${ext}`, thumb: `${folder}/${imageId}-thumb.${ext}` };
}

/**
 * Uploads one object with progress events. Uses the documented Storage REST
 * endpoint (POST /storage/v1/object/{bucket}/{path}) via XHR because fetch
 * cannot report upload progress. Objects are immutable (new UUID per upload),
 * so they can be cached for a year.
 */
export async function uploadObject(
  path: string,
  blob: Blob,
  options: { onProgress?: ProgressHandler; signal?: AbortSignal } = {},
): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AppError('Please sign in again to upload images.', 'not_authenticated');

  const url = `${env.supabaseUrl}/storage/v1/object/${MEDIA.bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.timeout = 120_000;
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', env.supabaseAnonKey);
    xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream');
    xhr.setRequestHeader('Cache-Control', 'max-age=31536000');
    xhr.setRequestHeader('x-upsert', 'false');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        options.onProgress?.(1);
        resolve();
        return;
      }
      let body: { statusCode?: string; message?: string; error?: string } = {};
      try {
        body = JSON.parse(xhr.responseText) as typeof body;
      } catch {
        // Ignore non-JSON bodies.
      }
      reject(Object.assign(new Error(body.message ?? `Upload failed (${xhr.status})`), { status: body.statusCode ?? String(xhr.status) }));
    };
    xhr.onerror = () => reject(new TypeError('Network request failed'));
    xhr.ontimeout = () => reject(new TypeError('Network request failed'));
    xhr.onabort = () => reject(new AppError('Upload cancelled.', 'aborted'));
    options.signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(blob);
  });
}

export async function uploadEncoded(path: string, image: EncodedImage, onProgress?: ProgressHandler): Promise<void> {
  await uploadObject(path, image.blob, { onProgress });
}

/** Best-effort removal; never throws (orphans are harmless and logged in dev). */
export async function removeObjects(paths: Array<string | null | undefined>): Promise<void> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100);
    const { error } = await supabase.storage.from(MEDIA.bucket).remove(batch);
    if (error && import.meta.env.DEV) console.warn('Storage cleanup failed', error);
  }
}

/** Lists every object below a folder (Storage list() is one level deep). */
export async function listObjectsRecursive(prefix: string): Promise<string[]> {
  const found: string[] = [];
  const queue = [prefix.replace(/\/+$/, '')];
  while (queue.length > 0) {
    const folder = queue.shift()!;
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.storage.from(MEDIA.bucket).list(folder, { limit: 1000, offset });
      if (error) throw error;
      for (const entry of data) {
        const full = `${folder}/${entry.name}`;
        // Folders are returned without an id.
        if (entry.id === null) queue.push(full);
        else found.push(full);
      }
      if (data.length < 1000) break;
    }
  }
  return found;
}

export async function removeFolder(prefix: string): Promise<void> {
  const paths = await listObjectsRecursive(prefix);
  await removeObjects(paths);
}

export async function copyObject(from: string, to: string): Promise<void> {
  const { error } = await supabase.storage.from(MEDIA.bucket).copy(from, to);
  if (error) throw error;
}
