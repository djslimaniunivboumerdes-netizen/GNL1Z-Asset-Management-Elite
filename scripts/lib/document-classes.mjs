/**
 * One source of truth for "which public file is which class of document".
 *
 * Both scripts/audit-documents.mjs (read-only report) and
 * scripts/upload-restricted-documents.mjs (the migration) read this module, so
 * the number of RESTRICTED files they report can never disagree.
 *
 * This mirrors DOCUMENT_CLASSES in src/lib/documentAccess.ts. If you change one,
 * change the other — src/test/documentAccess.test.ts and
 * src/test/documentMigration.test.ts hold the two in step.
 *
 * `target` is the folder inside the private bucket; `docType` is the value of
 * public.engineering_documents.doc_type (its CHECK constraint is fixed).
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export const DOCUMENT_EXTENSIONS = /\.(pdf|png|jpe?g|webp|csv|xlsx?|docx?)$/i;

export const CLASS_RULES = [
  {
    match: /^pids?\//i,
    kind: "pid",
    classification: "RESTRICTED",
    docType: "P_AND_ID",
    bucket: "restricted-documents",
    target: "pids",
  },
  {
    match: /^pfd\//i,
    kind: "pfd",
    classification: "RESTRICTED",
    docType: "PFD",
    bucket: "restricted-documents",
    target: "pfd",
  },
  {
    match: /^manuals?\//i,
    kind: "manual",
    classification: "RESTRICTED",
    docType: "MANUAL",
    bucket: "restricted-documents",
    target: "manuals",
  },
  {
    match: /^procedures?\//i,
    kind: "procedure",
    classification: "RESTRICTED",
    docType: "PROCEDURE",
    bucket: "restricted-documents",
    target: "procedures",
  },
  { match: /^data\//i, kind: "line_list", classification: "INTERNAL", docType: "LINE_LIST" },
  { match: /^images\//i, kind: "equipment_photo", classification: "INTERNAL", docType: "PHOTO" },
];

/** Rules that mean "this must leave the public folder". */
export const RESTRICTED_RULES = CLASS_RULES.filter((rule) => rule.classification === "RESTRICTED");

export function classifyPublicFile(relPath) {
  const rel = relPath.replace(/^\/+/, "").split("\\").join("/");
  const rule = CLASS_RULES.find((candidate) => candidate.match.test(rel));
  if (!rule) return { kind: "unclassified", classification: "REVIEW" };
  return { kind: rule.kind, classification: rule.classification, docType: rule.docType, target: rule.target, bucket: rule.bucket };
}

/** Every document-shaped file under a public/ directory, with its class. */
export function listPublicDocuments(publicDir) {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else found.push(full);
    }
  };
  walk(publicDir);

  return found
    .map((file) => ({ file, rel: relative(publicDir, file).split("\\").join("/") }))
    .filter(({ rel }) => DOCUMENT_EXTENSIONS.test(rel))
    .map(({ file, rel }) => ({
      publicPath: `/${rel}`,
      absolutePath: file,
      bytes: statSync(file).size,
      ...classifyPublicFile(rel),
    }))
    .sort((a, b) => a.publicPath.localeCompare(b.publicPath));
}

/** The files that must be migrated out of the public folder. */
export function listRestrictedDocuments(publicDir) {
  return listPublicDocuments(publicDir).filter((doc) => doc.classification === "RESTRICTED");
}
