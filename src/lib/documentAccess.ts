/**
 * Document access control.
 *
 * Plant drawings, P&IDs, PFDs and manuals are company assets. Which ones may be
 * served without a session is a business decision, and it is recorded in
 * `DOCUMENT_CLASSES` so it is reviewable in one place instead of being implied
 * by whichever folder a file happens to sit in.
 *
 * IMPORTANT — this module is an ADVISORY client-side gate. It decides what the
 * UI offers and where it fetches from. It is not the security boundary:
 *  - PUBLIC      → static asset, served by Cloudflare Pages;
 *  - INTERNAL    → Supabase Storage, signed URL, requires a session;
 *  - RESTRICTED  → Supabase Storage, signed URL, requires a session and a role
 *                  with engineering write access (enforced by the RLS policies
 *                  in supabase/migrations/2026103000000*.sql).
 *
 * A document that has been migrated to the private bucket carries a
 * `storagePath`; anything still under `publicPath` is served as a static asset
 * until the migration is run (see docs/SECURITY.md, "Document migration plan").
 */

import { storageUrl } from "./storageUrl";

export type DocumentClass = "PUBLIC" | "INTERNAL" | "RESTRICTED";

/** Roles as defined by public.app_role in the database. */
export type AccessRole =
  | "administrator"
  | "reliability_engineer"
  | "mechanical_engineer"
  | "process_engineer"
  | "instrumentation_engineer"
  | "maintenance_technician"
  | "operations_viewer"
  | "auditor"
  | "anonymous";

export interface DocumentDescriptor {
  id: string;
  title: string;
  kind: DocumentKind;
  classification: DocumentClass;
  /** Path under the private bucket, once the document has been migrated. */
  storagePath?: string;
  /** Static path served from `public/`, used until migration. */
  publicPath?: string;
  bucket?: string;
}

export type DocumentKind =
  | "pid"
  | "pfd"
  | "manual"
  | "dcs_panel"
  | "equipment_photo"
  | "line_list"
  | "procedure";

interface ClassRule {
  classification: DocumentClass;
  /** Why this class was chosen — reviewed when the decision is revisited. */
  rationale: string;
}

export const DOCUMENT_CLASSES: Record<DocumentKind, ClassRule> = {
  pid: {
    classification: "RESTRICTED",
    rationale:
      "P&IDs disclose the plant's process topology, line sizes and instrument layout. Not public information.",
  },
  pfd: {
    classification: "RESTRICTED",
    rationale: "Process flow diagrams disclose operating conditions and unit configuration.",
  },
  manual: {
    classification: "RESTRICTED",
    rationale: "Vendor and operating manuals are licensed material and describe operating limits.",
  },
  procedure: {
    classification: "RESTRICTED",
    rationale: "Maintenance and test procedures are controlled documents.",
  },
  dcs_panel: {
    classification: "INTERNAL",
    rationale:
      "DCS screenshots show live plant values. Internal to signed-in staff; currently also public in Storage (accepted risk R-02).",
  },
  equipment_photo: {
    classification: "INTERNAL",
    rationale: "Photographs of plant equipment reveal layout and condition.",
  },
  line_list: {
    classification: "RESTRICTED",
    rationale: "The piping line list is the verified source for line data.",
  },
};

export function classifyDocument(kind: DocumentKind): DocumentClass {
  return DOCUMENT_CLASSES[kind]?.classification ?? "RESTRICTED";
}

/**
 * Whether the caller should be shown the document.
 *
 * Advisory only: Storage and Postgres make the real decision, and a signed URL
 * is only issued to a session the server accepts.
 *
 * Two tiers, matching the RLS policies in
 * supabase/migrations/20261030000003_two_tier_access_model.sql:
 *   - reading a document needs a session and a plant role (an auditor reads the
 *     audit trail, not the drawings);
 *   - managing one needs the administrator role.
 */
export function canAccessDocument(
  doc: DocumentDescriptor,
  actor: { authenticated: boolean; role: AccessRole },
): boolean {
  const classification = doc.classification ?? classifyDocument(doc.kind);
  if (classification === "PUBLIC") return true;
  if (!actor.authenticated) return false;
  return actor.role !== "anonymous" && actor.role !== "auditor";
}

/**
 * Whether the caller may add, replace, verify or remove a document.
 *
 * The database is the authority — public.engineering_documents and the
 * restricted-documents bucket accept writes from public.is_admin() only — so
 * this only decides which controls the UI shows.
 */
export function canManageDocuments(actor: { authenticated: boolean; role: AccessRole }): boolean {
  return actor.authenticated && actor.role === "administrator";
}

/** Signed URL for a migrated document, or the static path while it is public. */
export async function documentUrl(doc: DocumentDescriptor): Promise<string | null> {
  if (doc.storagePath) {
    return storageUrl(doc.bucket ?? "restricted-documents", doc.storagePath);
  }
  return doc.publicPath ?? null;
}

/**
 * Human-readable statement for the UI. Restricted documents always say what is
 * required to open them, so a refusal is never a blank screen.
 */
export function accessNotice(
  doc: DocumentDescriptor,
  actor: { authenticated: boolean; role: AccessRole },
  lang: "en" | "fr",
): string | null {
  if (canAccessDocument(doc, actor)) return null;
  if (!actor.authenticated) {
    return lang === "en"
      ? "This document is restricted to signed-in staff."
      : "Ce document est réservé au personnel connecté.";
  }
  if (actor.role === "auditor") {
    return lang === "en"
      ? "An auditor account reads the audit trail, not the drawings."
      : "Un compte auditeur consulte la piste d'audit, pas les plans.";
  }
  return lang === "en"
    ? "Your role does not include access to this document. Ask an administrator."
    : "Votre rôle ne donne pas accès à ce document. Demandez à un administrateur.";
}
