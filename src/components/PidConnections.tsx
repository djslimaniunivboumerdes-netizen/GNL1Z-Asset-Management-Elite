import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Search, ShieldAlert, ShieldCheck, Ruler, ExternalLink, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { connectionsForTag, searchPidText, type PidTextHit } from "@/lib/pidIndex";

const L = (lang: "en" | "fr", en: string, fr: string) => (lang === "fr" ? fr : en);

/**
 * What the drawings say is connected to an equipment tag.
 *
 * The readings come from the P&ID index — the drawings were read once and the
 * result stored, so nothing here runs OCR. Until a sheet is signed off the
 * values are pointers to where to look, not design values.
 */
export function PidConnections({ tag, lang }: { tag: string; lang: "en" | "fr" }) {
  const connections = useMemo(() => connectionsForTag(tag), [tag]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PidTextHit[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const needle = query.trim();
    if (needle.length < 2) {
      setHits([]);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      searchPidText(needle)
        .then((results) => { if (active) setHits(results); })
        .finally(() => { if (active) setSearching(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);

  if (connections.empty) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
          <ShieldAlert className="h-4 w-4" />
          {L(lang, "This tag is not on any indexed drawing", "Ce repère n'apparaît sur aucun plan indexé")}
        </div>
        <p className="text-sm text-muted-foreground">
          {L(
            lang,
            "No P&ID in the drawing index mentions this tag, so there is nothing to read — I will not infer a pipe size from a filename.",
            "Aucun P&ID de l'index ne mentionne ce repère : il n'y a rien à lire — je ne déduis pas de diamètre à partir d'un nom de fichier.",
          )}
        </p>
        <Link to="/pids" className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-600 dark:text-cyan-400 hover:underline">
          {L(lang, "Open the P&ID library", "Ouvrir la bibliothèque P&ID")} <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="pid-connections">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-mono text-[10px]">
          {connections.sheets.length} {L(lang, "drawing(s)", "plan(s)")}
        </Badge>
        {connections.verified ? (
          <Badge variant="outline" className="font-mono text-[10px] border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10">
            <ShieldCheck className="h-3 w-3 mr-1" /> {L(lang, "reviewed extraction", "extraction relue")}
          </Badge>
        ) : (
          <Badge variant="outline" className="font-mono text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10">
            <ShieldAlert className="h-3 w-3 mr-1" /> {L(lang, "OCR reading — not verified", "lecture OCR — non vérifié")}
          </Badge>
        )}
        {connections.sizes.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
            <Ruler className="h-3 w-3" />
            {L(lang, "Distinct sizes read", "Diamètres distincts lus")}: <strong className="text-foreground">{connections.sizes.join(", ")}</strong>
          </span>
        )}
      </div>

      {connections.sheets.slice(0, 6).map((sheet) => (
        <article key={sheet.file} className="rounded-xl border border-border bg-card p-4 space-y-3" data-testid="pid-connection-sheet">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">
                {lang === "fr" ? sheet.titleFr ?? sheet.titleEn ?? sheet.title : sheet.titleEn ?? sheet.title}
              </div>
              <div className="text-[11px] font-mono text-muted-foreground">
                {sheet.drawing ? `${sheet.drawing} · ` : ""}{sheet.file.replace(/^\/pids\//, "")}
              </div>
            </div>
            <Link
              to={`/pids?file=${encodeURIComponent(sheet.file)}`}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-600 dark:text-cyan-400 hover:underline shrink-0"
            >
              {L(lang, "Open drawing", "Ouvrir le plan")} <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          {sheet.sizes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {sheet.sizes.slice(0, 14).map((size) => (
                <span key={size} className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[11px] text-cyan-700 dark:text-cyan-400">
                  {size}
                </span>
              ))}
            </div>
          )}

          {sheet.lineCalls.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                {L(lang, "Line callouts as read", "Repères de ligne tels que lus")}
              </div>
              <div className="font-mono text-[11px] text-foreground/80 break-words">
                {sheet.lineCalls.slice(0, 8).map((call) => call.asRead).join(" · ")}
              </div>
            </div>
          )}
        </article>
      ))}

      {!connections.verified && (
        <p className="text-[11px] text-amber-700/90 dark:text-amber-400/90 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
          <ShieldAlert className="h-3 w-3 inline mr-1.5 -mt-0.5" />
          {L(
            lang,
            "The drawings are scans: sizes and callouts were read by OCR and no engineer has signed them off. OCR confuses digits and separators on dense callouts. Use these as pointers to where to look on the drawing — never as a design or work-permit value. For verified values, attach the piping line list CSV in the assistant.",
            "Les plans sont des scans : diamètres et repères ont été lus par OCR et aucun ingénieur ne les a validés. L'OCR confond chiffres et séparateurs sur les repères denses. Utilisez-les comme indication de où chercher sur le plan — jamais comme valeur de conception ou d'autorisation. Pour des valeurs vérifiées, joignez le CSV de liste de lignes dans l'assistant.",
          )}
        </p>
      )}

      {/* Where is this mentioned at all? — raw text retrieval over the drawings. */}
      <div className="space-y-2 pt-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label={L(lang, "Search the drawing text", "Rechercher dans le texte des plans")}
            placeholder={L(lang, "e.g. E-520 · 6\" · purge · flare · nozzle", "ex. E-520 · 6\" · purge · torche · piquage")}
            className="pl-9 font-mono text-xs"
          />
        </div>
        {hits.length > 0 && (
          <ul className="space-y-1.5" data-testid="pid-text-hits">
            {hits.map((hit) => (
              <li key={hit.file} className="rounded-lg border border-border bg-card px-3 py-2">
                <Link to={`/pids?file=${encodeURIComponent(hit.file)}`} className="text-xs font-mono text-cyan-600 dark:text-cyan-400 hover:underline">
                  {hit.title}
                </Link>
                <div className="text-[11px] text-muted-foreground truncate">
                  <FileText className="h-3 w-3 inline mr-1 -mt-0.5" />
                  “{hit.snippet}”
                  <span className="ml-2 opacity-70">
                    {hit.matches}× · {Math.round(hit.confidence * 100)}%
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {query.trim().length >= 2 && !searching && hits.length === 0 && (
          <p className="text-[11px] font-mono text-muted-foreground">
            {L(lang, "No drawing text matches that.", "Aucun texte de plan ne correspond.")}
          </p>
        )}
      </div>
    </div>
  );
}
