import { useState, useRef } from "react";
import {
  BookOpen, FileText, ExternalLink, Search,
  ScanText, ChevronDown, ChevronUp, Loader2,
  AlertCircle, X, FileSearch, CheckCircle2,
  History, Copy, Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/contexts/I18nContext";
import { MANUALS, driveDocViewUrl } from "@/data/manuals";
import { highlightParts } from "@/lib/textMatch";
import { copyToClipboard } from "@/lib/clipboard";

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

// Sample queries for in-document search (equipment tag + domain keywords).
const EXAMPLE_QUERIES = ["E-501", "propane", "flare", "shutdown"];

// Recent in-document queries — kept locally so an operator can re-run the
// searches that matter without retyping (and they hit the warm cache).
const RECENT_KEY = "gnl1z-manual-searches";
const RECENT_MAX = 6;

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function saveRecent(terms: string[]) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(terms.slice(0, RECENT_MAX))); } catch { /* private mode */ }
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface DocHit {
  id: string;
  title: string;
  driveId: string;
  count: number;
  snippets: string[];
  terms?: string[];
}

interface SearchMeta {
  total: number;
  matched: number;
  failed: number;
  cached: number;
  elapsedMs: number;
}

// ─── Highlight matching text ─────────────────────────────────────────────────
// Accent-insensitive and deterministic: `terms` come from the server (query
// variants + the surface forms as written in the document), so "mesure" marks
// "mesuré" and "E501" marks "E-501". Every occurrence is marked — the previous
// `re.test()` loop advanced lastIndex and skipped every other hit.
function highlight(text: string, terms: string[]): React.ReactNode[] {
  return highlightParts(text, terms).map((part, i) =>
    part.match
      ? <mark key={i} className="bg-orange-500/30 text-orange-300 rounded px-0.5 not-italic font-semibold">{part.text}</mark>
      : <span key={i}>{part.text}</span>,
  );
}

// ─── Collapsible result card ──────────────────────────────────────────────────
function DocResult({ hit, query, lang }: { hit: DocHit; query: string; lang: "en" | "fr" }) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const m = MANUALS.find(x => x.id === hit.id);
  const terms = hit.terms?.length ? hit.terms : [query];

  const copyExcerpts = async () => {
    const body = hit.snippets.map(s => `• ${s.replace(/\s+/g, " ").trim()}`).join("\n");
    const ok = await copyToClipboard(`${hit.id} — ${hit.title}\n${body}`);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

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
              {highlight(snip, terms)}
            </p>
          ))}
          {m && (
            <div className="px-4 py-3 flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={() => void copyExcerpts()}
                aria-label={lang === "en" ? `Copy excerpts from ${hit.id}` : `Copier les extraits de ${hit.id}`}
                className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground font-mono transition-colors"
              >
                {copied
                  ? <><Check className="h-3.5 w-3.5 text-success" />{lang === "en" ? "Copied" : "Copié"}</>
                  : <><Copy className="h-3.5 w-3.5" />{lang === "en" ? "Copy excerpts" : "Copier les extraits"}</>}
              </button>
              <span role="status" className="sr-only">
                {copied ? (lang === "en" ? `Excerpts from ${hit.id} copied` : `Extraits de ${hit.id} copiés`) : ""}
              </span>
              <a
                href={driveDocViewUrl(m.drive_id)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] text-accent hover:text-accent/80 font-mono transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {lang === "en" ? "Open document" : "Ouvrir le document"}
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
  const [docMeta,     setDocMeta]     = useState<SearchMeta | null>(null);
  // When set, only this manual is downloaded + scanned (fast scoped search).
  const [scopeId,     setScopeId]     = useState<string | null>(null);
  const [recent,      setRecent]      = useState<string[]>(() => loadRecent());
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
  const handleDocSearch = async (termOverride?: string) => {
    const term = (termOverride ?? docQuery).trim();
    if (term.length < 2) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setDocSearching(true);
    setDocError(null);
    setDocResults(null);
    setDocMeta(null);
    if (termOverride !== undefined) setDocQuery(termOverride);

    const targets = (scopeId ? MANUALS.filter(m => m.id === scopeId) : MANUALS);

    try {
      const res = await fetch("/api/search-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: term,
          manuals: targets.map(m => ({
            id: m.id,
            title: lang === "en" ? m.title_en : m.title_fr,
            driveId: m.drive_id,
          })),
        }),
        signal: abortRef.current?.signal,
      });

      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json() as { results: DocHit[]; meta?: SearchMeta };
      setDocResults(data.results ?? []);
      setDocMeta(data.meta ?? null);
      const next = [term, ...recent.filter(r => r.toLowerCase() !== term.toLowerCase())].slice(0, RECENT_MAX);
      setRecent(next);
      saveRecent(next);
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
    setDocMeta(null);
    setDocQuery("");
  };

  const forgetRecent = () => {
    setRecent([]);
    saveRecent([]);
  };

  // Card action: jump into full-text mode scoped to one document.
  const startScopedSearch = (id: string) => {
    clearDocSearch();
    setScopeId(id);
    setDocMode(true);
  };

  // Empty full-text results → try titles/categories with the same term.
  const fallBackToTitles = () => {
    const term = docQuery;
    setDocMode(false);
    setScopeId(null);
    clearDocSearch();
    setQ(term);
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
          onClick={() => { setDocMode(false); setScopeId(null); clearDocSearch(); }}
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
            docMode ? "bg-orange-500 text-foreground border-orange-500" : "border-border text-muted-foreground hover:border-orange-500/40",
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
              <div key={m.id}
                className="text-left border border-border rounded-lg bg-card p-5 hover:border-accent/50 hover:shadow-card transition-all flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <FileText className="h-5 w-5 text-accent" />
                  <Badge variant="outline" className={`font-mono text-[10px] ${categoryColors[m.category] ?? ""}`}>
                    {m.category}
                  </Badge>
                </div>
                <div className="font-mono text-xs font-bold text-accent mb-1">{m.id}</div>
                <div className="font-display font-semibold leading-tight mb-4">
                  {lang === "en" ? m.title_en : m.title_fr}
                </div>
                <div className="mt-auto flex items-center gap-2">
                  <a href={driveDocViewUrl(m.drive_id)} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] font-mono border border-border rounded-md px-2.5 py-1.5 text-muted-foreground hover:text-accent hover:border-accent/40 transition-colors">
                    <ExternalLink className="h-3.5 w-3.5" />
                    {lang === "en" ? "Open" : "Ouvrir"}
                  </a>
                  <button
                    type="button"
                    onClick={() => startScopedSearch(m.id)}
                    aria-label={lang === "en" ? `Search inside ${m.id}` : `Recherche plein texte dans ${m.id}`}
                    className="inline-flex items-center gap-1.5 text-[11px] font-mono border border-orange-500/30 text-orange-500 rounded-md px-2.5 py-1.5 hover:bg-orange-500/10 transition-colors">
                    <FileSearch className="h-3.5 w-3.5" />
                    {lang === "en" ? "Search inside" : "Plein texte"}
                  </button>
                </div>
              </div>
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
          {/* Scope chip — one document only */}
          {scopeId && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold border border-orange-500/40 bg-orange-500/10 text-orange-500 rounded-full px-3 py-1">
                {lang === "en" ? "Searching in" : "Recherche dans"}: {scopeId}
              </span>
              <button
                type="button"
                onClick={() => setScopeId(null)}
                aria-label={lang === "en" ? "Clear scope — search all documents" : "Retirer le périmètre — chercher dans tous les documents"}
                className="text-[11px] font-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1 underline underline-offset-2">
                {lang === "en" ? "all 23 documents" : "les 23 documents"}
              </button>
            </div>
          )}

          {/* Search bar */}
          <div className="flex gap-2 max-w-xl">
            <div className="relative flex-1">
              <ScanText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-500" />
              <Input
                value={docQuery}
                onChange={e => setDocQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") void handleDocSearch();
                  if (e.key === "Escape") clearDocSearch();
                }}
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
            <Button onClick={() => void handleDocSearch()} disabled={docSearching || docQuery.trim().length < 2}
              className="h-11 px-5 bg-orange-500 hover:bg-orange-500/90 text-foreground font-mono gap-2">
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
                  {scopeId
                    ? (lang === "en" ? `Full-text search inside ${scopeId}` : `Recherche plein texte dans ${scopeId}`)
                    : (lang === "en" ? "Full-text search across all 23 manuals" : "Recherche plein texte dans les 23 manuels")}
                </p>
                <p className="text-xs leading-relaxed">
                  {scopeId
                    ? (lang === "en"
                        ? "Only this document is downloaded and scanned — the fastest path for long phrases or repeated queries."
                        : "Seul ce document est téléchargé et analysé — le chemin le plus rapide pour les longues phrases ou les recherches répétées.")
                    : (lang === "en"
                        ? "Type an equipment tag (E-501), keyword, or phrase. Multi-word queries match every word (in any order); matching passages come back with context."
                        : "Tapez un repère d'équipement (E-501), un mot-clé ou une phrase. Les requêtes multi-mots retrouvent tous les mots (dans l'ordre quelconque) ; les passages correspondants sont retournés avec leur contexte.")}
                </p>
              </div>
            </div>
          )}

          {/* Example queries */}
          {!docResults && !docSearching && !docError && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">{lang === "en" ? "Try:" : "Essayer :"}</span>
              {EXAMPLE_QUERIES.map(example => (
                <button
                  key={example}
                  type="button"
                  onClick={() => { setDocQuery(example); void handleDocSearch(example); }}
                  className="text-xs font-mono border border-orange-500/30 text-orange-500 hover:bg-orange-500/10 rounded-full px-3 py-1 transition-colors">
                  {example}
                </button>
              ))}
            </div>
          )}

          {/* Recent queries — warm-cache friendly one-click re-runs */}
          {recent.length > 0 && !docSearching && (
            <div className="flex flex-wrap items-center gap-2">
              <History className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-mono text-muted-foreground">{lang === "en" ? "Recent:" : "Recent :"}</span>
              {recent.map(term => (
                <button
                  key={term}
                  type="button"
                  onClick={() => { setDocQuery(term); void handleDocSearch(term); }}
                  className="text-xs font-mono border border-border text-muted-foreground hover:text-orange-500 hover:border-orange-500/40 rounded-full px-3 py-1 transition-colors">
                  {term}
                </button>
              ))}
              <button
                type="button"
                onClick={forgetRecent}
                aria-label={lang === "en" ? "Clear recent searches" : "Effacer les recherches récentes"}
                className="text-xs font-mono text-muted-foreground hover:text-foreground underline underline-offset-2">
                {lang === "en" ? "clear" : "effacer"}
              </button>
            </div>
          )}

          {/* Loading */}
          {docSearching && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
              <p className="text-sm font-mono">
                {scopeId
                  ? (lang === "en" ? `Scanning ${scopeId}…` : `Analyse de ${scopeId}…`)
                  : (lang === "en" ? `Scanning ${MANUALS.length} documents…` : `Analyse de ${MANUALS.length} documents…`)}
              </p>
              <p className="text-xs text-center max-w-sm leading-relaxed">
                {lang === "en"
                  ? "The first search downloads every document (10–20 s); later searches reuse a warm cache."
                  : "La première recherche télécharge tous les documents (10–20 s) ; les suivantes réutilisent un cache chaud."}
              </p>
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

              {/* Scan diagnostics from the endpoint */}
              {docMeta && (
                <p className={[
                  "text-[11px] font-mono -mt-2",
                  docMeta.failed > 0 ? "text-orange-500" : "text-muted-foreground",
                ].join(" ")}>
                  {lang === "en"
                    ? `${docMeta.matched} of ${docMeta.total} documents matched · ${(docMeta.elapsedMs / 1000).toFixed(1)}s`
                    : `${docMeta.matched} / ${docMeta.total} documents correspondent · ${(docMeta.elapsedMs / 1000).toFixed(1)}s`}
                  {docMeta.cached > 0
                    ? (lang === "en" ? ` · ${docMeta.cached} from cache` : ` · ${docMeta.cached} depuis le cache`)
                    : ""}
                  {docMeta.failed > 0
                    ? (lang === "en" ? ` · ${docMeta.failed} unreachable` : ` · ${docMeta.failed} injoignable(s)`)
                    : ""}
                </p>
              )}

              {/* Result cards */}
              {docResults.map(hit => (
                <DocResult key={hit.id} hit={hit} query={docQuery} lang={lang} />
              ))}

              {/* Empty results → same term against titles/categories */}
              {docResults.length === 0 && (
                <button
                  type="button"
                  onClick={fallBackToTitles}
                  className="inline-flex items-center gap-2 text-xs font-mono border border-border rounded-lg px-3.5 py-2.5 text-muted-foreground hover:text-accent hover:border-accent/40 transition-colors">
                  <Search className="h-3.5 w-3.5" />
                  {lang === "en" ? "Search titles & categories instead" : "Rechercher dans les titres et catégories"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
      }
