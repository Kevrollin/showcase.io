import { env } from '@/lib/env';
import { AppError } from '@/lib/utils/errors';

/**
 * Headers for anonymous API calls. Legacy anon keys are JWTs and are also sent
 * as a bearer token; new publishable keys (sb_publishable_…) are not JWTs and
 * must only be sent in the `apikey` header.
 */
export function publicHeaders(key: string): Record<string, string> {
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json', Accept: 'application/json' };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  return headers;
}

/**
 * Minimal PostgREST RPC client for public pages (~1 KB instead of the full
 * supabase-js SDK). Calls run as the `anon` role, so RLS decides visibility.
 */
export async function callPublicRpc<T>(fn: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new AppError('This storefront is temporarily unavailable.', 'not_configured');
  }
  const response = await fetch(`${env.supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: publicHeaders(env.supabaseAnonKey),
    body: JSON.stringify(args),
    signal,
  });
  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // Non-JSON error body.
    }
    const shape = (typeof body === 'object' && body !== null ? body : {}) as { code?: string; message?: string };
    const error = new Error(shape.message ?? `Request failed with status ${response.status}`) as Error & {
      code?: string;
      status?: number;
    };
    error.code = shape.code;
    error.status = response.status;
    throw error;
  }
  return (await response.json()) as T;
}

/** Public CDN URL for an object in the media bucket. */
export function publicMediaUrl(path: string | null | undefined, bucket = 'catalog-media'): string | null {
  if (!path) return null;
  // Inline illustrations used by the marketing demo. Database paths can never
  // be URLs: triggers require them to start with "{owner_id}/{business_id}/".
  if (path.startsWith('data:image/')) return path;
  if (!env.supabaseUrl) return null;
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `${env.supabaseUrl}/storage/v1/object/public/${bucket}/${encoded}`;
}
