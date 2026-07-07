import { useState, useRef } from "react";
import {
  BookOpen, FileText, ExternalLink, Search,
  ScanText, ChevronDown, ChevronUp, Loader2,
  AlertCircle, X, FileSearch, CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/contexts/I18nContext";
import { MANUALS, driveDocViewUrl } from "@/data/manuals";

const categoryColors: Record<string, string> = {
  Process:       "border-accent/40 text-accent",
  Refrigeration: "border-primary/40 text-primary",
  Storage:       "border-success/40 text-success",
  Utilities:     "border-muted-foreground/30 text-muted-foreground",
  Safety:        "border-destructive/40 text-destructive",
  Operations:    "border-accent/40 text-accent",
  Treatment:     "border-warning/40 text-warning-foreground",
  Fractionation: "border-primary/40 text-primary",
};

// ─── Types ───────────────────────────────────────────────────────────────────
interface DocHit {
  id: string;
  title: string;
  driveId: string;
  count: number;
  snippets: string[];
}

// ─── Highlight matching text ─────────────────────────────────────────────────
function highlight(text: string, query: string): React.ReactNode[] {
  if (!query) return [text];
  const re    = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(re);
  return parts.map((p, i) =>
    re.test(p)
      ? <mark key={i} className="bg-orange-500/30 text-orange-300 rounded px-0.5 not-italic font-semibold">{p}</mark>
      : p
  );
}

// ─── Collapsible result card ──────────────────────────────────────────────────
function DocResult({ hit, query }: { hit: DocHit; query: string }) {
  const [open, setOpen] = useState(true);
  const m = MANUALS.find(x => x.id === hit.id);

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors text-left gap-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <FileSearch className="h-4 w-4 text-orange-500 shrink-0" />
          <span className="font-mono text-xs font-bold text-orange-500">{hit.id}</span>
          <span className="font-display font-semibold text-sm truncate">{hit.title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-mono bg-orange-500/15 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full">
            {hit.count} match{hit.count !== 1 ? "es" : ""}
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Snippets */}
      {open && (
        <div className="border-t border-border divide-y divide-border/50">
          {hit.snippets.map((snip, i) => (
            <p key={i} className="px-4 py-3 text-xs text-muted-foreground leading-relaxed font-mono">
              {highlight(snip, query)}
            </p>
          ))}
          {m && (
            <div className="px-4 py-3 flex justify-end">
              <a
                href={driveDocViewUrl(m.drive_id)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] text-accent hover:text-accent/80 font-mono transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open document
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Manuals() {
  const { t, lang } = useI18n();

  // ── Metadata filter ──
  const [q, setQ] = useState("");

  // ── In-document search ──
  const [docMode,     setDocMode]     = useState(false);
  const [docQuery,    setDocQuery]    = useState("");
  const [docResults,  setDocResults]  = useState<DocHit[] | null>(null);
  const [docSearching, setDocSearching] = useState(false);
  const [docError,    setDocError]    = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Filtered list for metadata search
  const list = MANUALS.filter(m => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (
      m.id.toLowerCase().includes(s) ||
      m.title_en.toLowerCase().includes(s) ||
      m.title_fr.toLowerCase().includes(s) ||
      m.category.toLowerCase().includes(s)
    );
  });

  // ── In-document search handler ──
  const handleDocSearch = async () => {
    const term = docQuery.trim();
    if (!term) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setDocSearching(true);
    setDocError(null);
    setDocResults(null);

    try {
      const res = await fetch("/api/search-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: term,
          manuals: MANUALS.map(m => ({
            id: m.id,
            title: lang === "en" ? m.title_en : m.title_fr,
            driveId: m.drive_id,
          })),
        }),
        signal: abortRef.current?.signal,
      });

      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json() as { results: DocHit[] };
      setDocResults(data.results ?? []);
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        setDocError((err as Error).message ?? "Search failed");
      }
    } finally {
      setDocSearching(false);
    }
  };

  const clearDocSearch = () => {
    abortRef.current?.abort();
    setDocResults(null);
    setDocError(null);
    setDocQuery("");
  };

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div>
        <div className="text-[10px] uppercase tracking-widest text-accent font-mono mb-1">/ {t("manuals")}</div>
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="h-7 w-7 text-accent" />
          <h1 className="text-3xl md:text-4xl font-display font-bold">{t("manuals")}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {MANUALS.length} {lang === "en" ? "documents" : "documents"} · S01 → S15
        </p>
      </div>

      {/* ── Mode toggle ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => { setDocMode(false); clearDocSearch(); }}
          className={[
            "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-mono font-bold border transition-all",
            !docMode ? "bg-accent text-accent-foreground border-accent" : "border-border text-muted-foreground hover:border-accent/40",
          ].join(" ")}
        >
          <Search className="h-3.5 w-3.5" />
          {lang === "en" ? "By title / ID" : "Par titre / ID"}
        </button>
        <button
          onClick={() => setDocMode(true)}
          className={[
            "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-mono font-bold border transition-all",
            docMode ? "bg-orange-500 text-white border-orange-500" : "border-border text-muted-foreground hover:border-orange-500/40",
          ].join(" ")}
        >
          <ScanText className="h-3.5 w-3.5" />
          {lang === "en" ? "Search inside documents" : "Recherche dans les documents"}
        </button>
      </div>

      {/* ── METADATA SEARCH MODE ── */}
      {!docMode && (
        <>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)}
              placeholder={t("search")} className="pl-9 h-11" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {list.map(m => (
              <a key={m.id} href={driveDocViewUrl(m.drive_id)} target="_blank" rel="noopener noreferrer"
                className="text-left group border border-border rounded-lg bg-card p-5 hover:border-accent/50 hover:shadow-card transition-all">
                <div className="flex items-start justify-between mb-3">
                  <FileText className="h-5 w-5 text-accent" />
                  <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors" />
                </div>
                <div className="font-mono text-xs font-bold text-accent mb-1">{m.id}</div>
                <div className="font-display font-semibold leading-tight mb-3">
                  {lang === "en" ? m.title_en : m.title_fr}
                </div>
                <Badge variant="outline" className={`font-mono text-[10px] ${categoryColors[m.category] ?? ""}`}>
                  {m.category}
                </Badge>
              </a>
            ))}
            {list.length === 0 && (
              <div className="col-span-full text-center text-muted-foreground py-12">{t("noResults")}</div>
            )}
          </div>
        </>
      )}

      {/* ── IN-DOCUMENT SEARCH MODE ── */}
      {docMode && (
        <div className="space-y-5">
          {/* Search bar */}
          <div className="flex gap-2 max-w-xl">
            <div className="relative flex-1">
              <ScanText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-500" />
              <Input
                value={docQuery}
                onChange={e => setDocQuery(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") void handleDocSearch(); }}
                placeholder={lang === "en" ? "e.g.  E-501  or  propane compressor…" : "ex.  E-501  ou  compresseur propane…"}
                className="pl-9 h-11 border-orange-500/40 focus-visible:ring-orange-500/40 font-mono"
              />
              {docQuery && (
                <button type="button" onClick={clearDocSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button onClick={() => void handleDocSearch()} disabled={docSearching || !docQuery.trim()}
              className="h-11 px-5 bg-orange-500 hover:bg-orange-500/90 text-white font-mono gap-2">
              {docSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {lang === "en" ? "Search" : "Rechercher"}
            </Button>
          </div>

          {/* Info banner */}
          {!docResults && !docSearching && !docError && (
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4 max-w-xl text-sm text-muted-foreground">
              <ScanText className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground mb-1">
                  {lang === "en" ? "Full-text search across all 23 manuals" : "Recherche plein texte dans les 23 manuels"}
                </p>
                <p className="text-xs leading-relaxed">
                  {lang === "en"
                    ? "Type an equipment tag (E-501), keyword, or phrase. Each document is scanned and matching passages are returned with context."
                    : "Tapez un repère d'équipement (E-501), un mot-clé ou une phrase. Chaque document est analysé et les passages correspondants sont retournés avec leur contexte."}
                </p>
              </div>
            </div>
          )}

          {/* Loading */}
          {docSearching && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
              <p className="text-sm font-mono">
                {lang === "en" ? `Scanning ${MANUALS.length} documents…` : `Analyse de ${MANUALS.length} documents…`}
              </p>
              <p className="text-xs">This may take 10–20 seconds</p>
            </div>
          )}

          {/* Error */}
          {docError && !docSearching && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 max-w-xl">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-destructive mb-1">Search failed</p>
                <p className="text-muted-foreground text-xs">{docError}</p>
                <p className="text-muted-foreground text-xs mt-1">
                  The search API runs as a Cloudflare Pages Function
                  (<code className="font-mono bg-muted px-1 rounded">functions/api/search-manual.ts</code>).
                  Make sure the file is committed and pushed — Cloudflare deploys it automatically.
                </p>
              </div>
            </div>
          )}

          {/* Results */}
          {docResults && !docSearching && (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="flex items-center gap-2 text-sm">
                {docResults.length > 0 ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="font-mono font-bold">{docResults.length}</span>
                    <span className="text-muted-foreground">
                      {lang === "en"
                        ? `document${docResults.length !== 1 ? "s" : ""} contain "${docQuery}"`
                        : `document${docResults.length !== 1 ? "s" : ""} contien${docResults.length !== 1 ? "nent" : "t"} « ${docQuery} »`}
                    </span>
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground font-mono">
                      {lang === "en" ? `No matches found for "${docQuery}"` : `Aucun résultat pour « ${docQuery} »`}
                    </span>
                  </>
                )}
              </div>

              {/* Result cards */}
              {docResults.map(hit => (
                <DocResult key={hit.id} hit={hit} query={docQuery} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
      }
