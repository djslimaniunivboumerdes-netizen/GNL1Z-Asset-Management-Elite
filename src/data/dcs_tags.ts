// Pre-scanned DCS instrument tags (cached AI vision results).
// Shipped with the app so every user sees results without running the scan.
import detected from "./dcs_detected_tags.json";

export const DCS_DETECTED_TAGS = detected as Record<string, string[]>;

export function getTagsForPanel(panelId: string): string[] {
  return DCS_DETECTED_TAGS[panelId] ?? [];
}

// Reverse index: tag -> list of panel ids where it appears
let _reverse: Record<string, string[]> | null = null;
export function getTagIndex(): Record<string, string[]> {
  if (_reverse) return _reverse;
  const idx: Record<string, string[]> = {};
  for (const [panelId, tags] of Object.entries(DCS_DETECTED_TAGS)) {
    for (const t of tags) {
      const key = t.toUpperCase().trim();
      if (!idx[key]) idx[key] = [];
      if (!idx[key].includes(panelId)) idx[key].push(panelId);
    }
  }
  _reverse = idx;
  return idx;
}

export function getAllTagsSorted(): string[] {
  return Object.keys(getTagIndex()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
