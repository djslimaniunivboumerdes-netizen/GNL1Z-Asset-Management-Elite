/**
 * Resolve one document path to a URL the browser can actually open.
 *
 * Handles the two states honestly:
 *  - before the migration: the static asset, no network call needed;
 *  - after it: a short-lived signed URL, or `null` with a reason the UI shows,
 *    so a restricted drawing is never a blank iframe.
 */
import { useEffect, useState } from "react";
import { resolveDocumentUrl, type ResolvedDocument } from "@/lib/documentRegistry";

const IDLE: ResolvedDocument = {
  url: null,
  source: "unavailable",
  migrated: false,
  classification: null,
  reason: null,
};

export interface UseDocumentUrl extends ResolvedDocument {
  /** True while the register or the signed URL is being fetched. */
  loading: boolean;
}

export function useDocumentUrl(publicPath: string | null | undefined): UseDocumentUrl {
  const [result, setResult] = useState<ResolvedDocument>(IDLE);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!publicPath) {
      setResult(IDLE);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    resolveDocumentUrl(publicPath)
      .then((resolved) => {
        if (!cancelled) {
          setResult(resolved);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResult({ ...IDLE, source: "unavailable", reason: "This document could not be opened." });
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [publicPath]);

  return { ...result, loading };
}
