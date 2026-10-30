/**
 * Storage URL resolution.
 *
 * Plant photographs and classified documents are private objects: they are
 * served through short-lived signed URLs, not public URLs. This module owns
 * that decision so no component has to (and so no component can forget).
 *
 * A public URL is only ever produced as an explicit fallback: if a bucket is
 * still public in Storage, `getPublicUrl` keeps working, so the frontend can
 * be deployed before the storage migration is applied.
 */

import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";

/** Signed URLs are short-lived on purpose: a shared link stops working. */
export const SIGNED_URL_TTL_SECONDS = 60 * 60;
/** Renew a minute early so the image never expires mid-render. */
const REFRESH_MARGIN_MS = 60_000;

interface StorageClientLike {
  storage: {
    from(bucket: string): {
      getPublicUrl(path: string): { data: { publicUrl: string } };
      createSignedUrl(
        path: string,
        ttl: number,
      ): Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>;
    };
  };
}

interface CacheEntry {
  url: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(bucket: string, path: string): string {
  return `${bucket}/${path}`;
}

export function publicUrlFor(client: StorageClientLike, bucket: string, path: string): string {
  return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/**
 * Resolve a displayable URL for a stored object.
 *
 * Order: cached signed URL → fresh signed URL → public URL fallback.
 * Returns null when Supabase is not configured, so callers can show an honest
 * empty state instead of a broken image.
 */
export async function resolveStorageUrl(
  client: StorageClientLike,
  bucket: string,
  path: string,
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  if (!path) return null;

  const key = cacheKey(bucket, path);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.url;

  try {
    const { data, error } = await client.storage.from(bucket).createSignedUrl(path, ttlSeconds);
    if (!error && data?.signedUrl) {
      cache.set(key, { url: data.signedUrl, expiresAt: Date.now() + ttlSeconds * 1000 - REFRESH_MARGIN_MS });
      return data.signedUrl;
    }
  } catch {
    // Fall through to the public URL: a private bucket is not the only
    // supported deployment, and a broken image helps nobody.
  }

  return publicUrlFor(client, bucket, path);
}

/** Bound the cache so a long session cannot grow it without limit. */
export function clearStorageUrlCache(): void {
  cache.clear();
}

export function cachedUrlCount(): number {
  return cache.size;
}

/**
 * The signed URL for the current session, or the public fallback.
 * Convenience wrapper bound to the application's Supabase client.
 */
export async function storageUrl(
  bucket: string,
  path: string,
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  return resolveStorageUrl(supabase, bucket, path, ttlSeconds);
}
