/**
 * Which documents have been migrated out of public/ into the private bucket.
 *
 * The document migration (scripts/upload-restricted-documents.mjs) moves the
 * P&IDs and PFDs to the private `restricted-documents` bucket and writes one row
 * per file to public.engineering_documents. Once that has happened, the static
 * path `/pids/….pdf` no longer resolves — a component that still links to it
 * shows a blank iframe instead of a drawing.
 *
 * This module is the bridge: it reads the register once per session and maps the
 * old public path to the stored object, so every existing link keeps working
 * through a short-lived signed URL.
 *
 * Two honest rules:
 *  - The register is only visible to the roles the RLS policies allow. If a
 *    caller cannot read it, this module reports the document as migrated and
 *    unreadable rather than silently falling back to a URL that no longer exists.
 *  - Before the migration runs, the register is empty and every document keeps
 *    resolving to its static path. Both states are supported.
 */

import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { SIGNED_URL_TTL_SECONDS as TTL_SECONDS } from "@/lib/storageUrl";

export interface MigratedDocument {
  publicPath: string;
  storageBucket: string;
  storagePath: string;
  classification: "PUBLIC" | "INTERNAL" | "RESTRICTED";
  title: string | null;
  drawingNo: string | null;
  docType: string | null;
}

export interface ResolvedDocument {
  /** Usable URL, or null when the document exists but this session may not open it. */
  url: string | null;
  /** Where the URL came from — shown in the UI so a fallback is never invisible. */
  source: "storage" | "static" | "unavailable";
  /** True once the file has left public/ and lives in the private bucket. */
  migrated: boolean;
  classification: "PUBLIC" | "INTERNAL" | "RESTRICTED" | null;
  /** Set when the object is known but no URL could be issued (no session, or denied). */
  reason: string | null;
}

/** Minimal shape of the Supabase client this module needs — keeps it testable. */
export interface RegistryClientLike {
  from(table: string): {
    select(columns: string): {
      not(column: string, operator: string, value: null): Promise<{
        data: Array<Record<string, unknown>> | null;
        error: { message: string } | null;
      }>;
    };
  };
  storage: {
    from(bucket: string): {
      createSignedUrl(
        path: string,
        ttl: number,
      ): Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>;
    };
  };
}

const REGISTRY_TTL_MS = 5 * 60_000;

let cache: { map: Map<string, MigratedDocument>; loadedAt: number } | null = null;

export function clearDocumentRegistry(): void {
  cache = null;
}

function normalise(path: string | null | undefined): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/**
 * Read the register. Cached for five minutes; an unreadable or empty register is
 * not an error, it simply means "nothing has been migrated yet".
 */
export async function loadDocumentRegistry(client: RegistryClientLike): Promise<Map<string, MigratedDocument>> {
  if (cache && Date.now() - cache.loadedAt < REGISTRY_TTL_MS) return cache.map;

  const map = new Map<string, MigratedDocument>();
  try {
    const { data, error } = await client
      .from("engineering_documents")
      .select("public_path, storage_bucket, storage_path, classification, title, drawing_no, doc_type")
      .not("storage_path", "is", null);

    if (!error && Array.isArray(data)) {
      for (const row of data) {
        const publicPath = normalise(row.public_path as string | null);
        const storagePath = (row.storage_path as string | null) ?? null;
        if (!publicPath || !storagePath) continue;
        map.set(publicPath.toLowerCase(), {
          publicPath,
          storageBucket: (row.storage_bucket as string | null) ?? "restricted-documents",
          storagePath,
          classification: (row.classification as MigratedDocument["classification"]) ?? "RESTRICTED",
          title: (row.title as string | null) ?? null,
          drawingNo: (row.drawing_no as string | null) ?? null,
          docType: (row.doc_type as string | null) ?? null,
        });
      }
    }
  } catch {
    // A register that cannot be read behaves like an empty one: the caller
    // shows the honest state instead of a broken document.
  }

  cache = { map, loadedAt: Date.now() };
  return map;
}

/**
 * Resolve a legacy public path (for example `/pids/E520 R792 R793.pdf`) to
 * something that can be rendered or downloaded today.
 */
export async function resolveDocumentUrl(publicPath: string | null | undefined, client?: RegistryClientLike): Promise<ResolvedDocument> {
  const path = normalise(publicPath);
  if (!path) return { url: null, source: "unavailable", migrated: false, classification: null, reason: "no document path" };

  const active = client ?? (isSupabaseConfigured ? (supabase as unknown as RegistryClientLike) : null);
  if (!active) {
    // No backend configured: the static asset is all there is.
    return { url: path, source: "static", migrated: false, classification: null, reason: null };
  }

  const registry = await loadDocumentRegistry(active);
  const migrated = registry.get(path.toLowerCase());

  if (!migrated) {
    return { url: path, source: "static", migrated: false, classification: null, reason: null };
  }

  try {
    // A signed URL is required here, never the public-URL fallback: for a
    // private bucket the public URL does not resolve, and silently handing one
    // out would turn a permission decision into a blank frame.
    const { data, error } = await active.storage.from(migrated.storageBucket).createSignedUrl(migrated.storagePath, TTL_SECONDS);
    const url = !error && data?.signedUrl ? data.signedUrl : null;
    if (url) {
      return { url, source: "storage", migrated: true, classification: migrated.classification, reason: null };
    }
    return {
      url: null,
      source: "unavailable",
      migrated: true,
      classification: migrated.classification,
      reason: "No signed URL was issued. Sign in to open this document.",
    };
  } catch {
    return {
      url: null,
      source: "unavailable",
      migrated: true,
      classification: migrated.classification,
      reason: "This document is in private storage and could not be opened.",
    };
  }
}

/** True when the document has left public/ and needs a session. */
export function documentNeedsSession(result: ResolvedDocument): boolean {
  return result.migrated && result.url === null;
}
