import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Gauge, Search, X, Cpu, Database, GitBranch, Filter, ArrowUpRight,
  CircleDot, Layers, AlertTriangle, BookOpen,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/contexts/I18nContext";
import {
  buildInstrumentIndex, instrumentFacets, searchInstruments,
  type InstrumentEntry,
} from "@/lib/instrumentIndex";
import { describeInstrument, instrumentUnit } from "@/lib/instrumentTags";

const L = (lang: "en" | "fr", en: string, fr: string) => (lang === "fr" ? fr : en);

/** Cards rendered per screen — the rest stay one keystroke away. */
const PAGE = 60;

const CLASS_STYLE: Record<string, string> = {
  valve: "border-rose-500/40 text-rose-400 bg-rose-500/10",
  controller: "border-cyan-500/40 text-cyan-400 bg-cyan-500/10",
  indicator: "border-slate-500/40 text-slate-300 bg-slate-500/10",
  transmitter: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
  switch: "border-amber-500/40 text-amber-400 bg-amber-500/10",
  alarm: "border-orange-500/40 text-orange-400 bg-orange-500/10",
  hand: "border-violet-500/40 text-violet-400 bg-violet-500/10",
  analyser: "border-teal-500/40 text-teal-400 bg-teal-500/10",
  speed: "border-indigo-500/40 text-indigo-400 bg-indigo-500/10",
  position: "border-sky-500/40 text-sky-400 bg-sky-500/10",
  totalizer: "border-lime-500/40 text-lime-400 bg-lime-500/10",
  relay: "border-fuchsia-500/40 text-fuchsia-400 bg-fuchsia-500/10",
  element: "border-slate-500/40 text-slate-300 bg-slate-500/10",
  unknown: "border-border text-muted-foreground bg-muted/30",
};

function InstrumentCard({ entry, lang }: { entry: InstrumentEntry; lang: "en" | "fr" }) {
  const { parsed, unit, panels, equipment } = entry;
  const eu = instrumentUnit(parsed);

  return (
    <article
      data-testid="instrument-card"
      data-tag={entry.tag}
      className="border border-border rounded-xl bg-card p-4 flex flex-col gap-3 hover:border-cyan-500/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="font-mono text-base font-bold text-cyan-400 truncate">{entry.tag}</div>
          <div className="text-sm text-foreground/90 mt-0.5">{describeInstrument(parsed, lang)}</div>
          {eu && (
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">
              {L(lang, "Engineering unit", "Unité de mesure")}: {eu}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant="outline" className={`font-mono text-[10px] ${CLASS_STYLE[parsed.deviceClass] ?? CLASS_STYLE.unknown}`}>
            {parsed.deviceClass}
          </Badge>
          {(parsed.partial || parsed.unverified) && (
            <Badge variant="outline" className="font-mono text-[10px] border-amber-500/40 text-amber-400 bg-amber-500/10">
              {L(lang, "partial decode", "décodage partiel")}
            </Badge>
          )}
        </div>
      </div>

      {/* Where it is */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-muted-foreground">
        {unit && (
          <span className="inline-flex items-center gap-1 border border-border rounded-md px-2 py-1">
            <Layers className="h-3 w-3" />
            {unit.code} · {L(lang, unit.en, unit.fr)}
          </span>
        )}
        {parsed.train && (
          <span className="inline-flex items-center gap-1 border border-border rounded-md px-2 py-1">
            <CircleDot className="h-3 w-3" />
            {L(lang, "Train", "Train")} {parsed.train}
          </span>
        )}
        {parsed.loop && (
          <span className="inline-flex items-center gap-1 border border-border rounded-md px-2 py-1">
            {L(lang, "Loop", "Boucle")} {parsed.loop}
          </span>
        )}
      </div>

      {/* Which DCS screens show it */}
      {panels.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Cpu className="h-3 w-3" /> {L(lang, "Seen on", "Visible sur")}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {panels.map(panel => (
              <Link
                key={panel.id}
                to={`/dcs/${panel.id}?tag=${encodeURIComponent(entry.tag)}`}
                className="inline-flex items-center gap-1 text-[11px] font-mono border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 rounded-md px-2 py-1 transition-colors"
              >
                {L(lang, panel.titleEn, panel.titleFr)}
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Which equipment it belongs to */}
      {equipment.length > 0 ? (
        <div className="space-y-1.5">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Database className="h-3 w-3" />
            {L(lang, `Related equipment (${equipment.length})`, `Équipements liés (${equipment.length})`)}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {equipment.map(eq => (
              <div key={eq.id} className="flex items-center gap-1">
                {eq.dbTag && (
                  <Link
                    to={`/equipment/${encodeURIComponent(eq.dbTag)}`}
                    className="text-[11px] font-mono border border-border text-foreground/80 hover:border-cyan-500/40 hover:text-cyan-400 rounded-md px-2 py-1 transition-colors"
                  >
                    {eq.diag}
                  </Link>
                )}
                {!eq.dbTag && (
                  <span className="text-[11px] font-mono border border-border text-muted-foreground rounded-md px-2 py-1">{eq.diag}</span>
                )}
                <Link
                  to={`/flow?tag=${encodeURIComponent(eq.id)}`}
                  aria-label={L(lang, `Show ${eq.diag} on the process flow`, `Voir ${eq.diag} sur le schéma`)}
                  title={L(lang, "Show on the process flow diagram", "Voir sur le schéma de procédé")}
                  className="p-1 rounded-md border border-border text-muted-foreground hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
                >
                  <GitBranch className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-[11px] font-mono text-amber-500/80 flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3" />
          {L(lang, "No equipment in this unit is mapped yet.", "Aucun équipement mappé dans cette unité.")}
        </p>
      )}
    </article>
  );
}

export default function Instruments() {
  const { lang } = useI18n();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(() => params.get("q") ?? "");
  const [variable, setVariable] = useState<string | null>(null);
  const [deviceClass, setDeviceClass] = useState<string | null>(null);
  const [unitCode, setUnitCode] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const facets = useMemo(() => instrumentFacets(), []);
  const matches = useMemo(
    () => searchInstruments({ q, variable, deviceClass, unitCode, limit: Number.MAX_SAFE_INTEGER }),
    [q, variable, deviceClass, unitCode],
  );
  // The first screenful is enough — the filters and the search box narrow it down.
  const results = useMemo(() => matches.slice(0, PAGE), [matches]);

  // Keep ?q= shareable so a colleague can be sent a specific lookup.
  const updateQuery = (value: string) => {
    setQ(value);
    const next = new URLSearchParams(params);
    if (value.trim()) next.set("q", value); else next.delete("q");
    setParams(next, { replace: true });
  };

  const clearAll = () => {
    setQ("");
    setVariable(null);
    setDeviceClass(null);
    setUnitCode(null);
    setParams(new URLSearchParams(), { replace: true });
  };

  const filtered = q.trim().length > 0 || variable || deviceClass || unitCode;

  return (
    <div className="px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="text-[10px] uppercase tracking-widest text-cyan-500 font-mono mb-1">/ {L(lang, "Instrument Finder", "Recherche d'Instruments")}</div>
        <div className="flex items-center gap-3 mb-2">
          <Gauge className="h-7 w-7 text-cyan-500" />
          <h1 className="text-3xl md:text-4xl font-display font-bold">{L(lang, "Instrument Finder", "Recherche d'Instruments")}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {L(
            lang,
            `${facets.total} instrument tags read from the DCS screens — search a tag, a loop, a unit or an equipment.`,
            `${facets.total} tags d'instruments relevés sur les écrans DCS — cherchez un tag, une boucle, une unité ou un équipement.`,
          )}
        </p>
      </div>

      {/* Search */}
      <div className="flex gap-2 max-w-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={e => updateQuery(e.target.value)}
            aria-label={L(lang, "Search instruments", "Rechercher des instruments")}
            placeholder={L(lang, "e.g. LIC101204 · XV · level · F502 · 105", "ex. LIC101204 · XV · niveau · F502 · 105")}
            className="pl-9 h-11 font-mono"
          />
          {q && (
            <button
              type="button"
              onClick={() => updateQuery("")}
              aria-label={L(lang, "Clear search", "Effacer la recherche")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {filtered && (
          <button
            type="button"
            onClick={clearAll}
            className="h-11 px-4 rounded-md border border-border text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-cyan-500/40 transition-colors"
          >
            {L(lang, "Reset", "Réinitialiser")}
          </button>
        )}
      </div>

      {/* How to read a tag — the question behind every lookup. */}
      <div className="border border-border rounded-xl bg-secondary/30">
        <button
          type="button"
          onClick={() => setShowHelp(v => !v)}
          aria-expanded={showHelp}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-cyan-500">
            <BookOpen className="h-3.5 w-3.5" />
            {L(lang, "How to read a tag", "Comment lire un tag")}
          </span>
          <span className="text-[11px] font-mono text-muted-foreground">
            {showHelp ? "−" : "+"}
          </span>
        </button>
        {showHelp && (
          <div className="px-4 pb-4 space-y-3" data-testid="tag-anatomy">
            <pre className="font-mono text-[11px] text-foreground/80 overflow-x-auto leading-relaxed">
{`LIC  101 204
│┬│   └┬┘  └┬┘
│ │    │    └── ${L(lang, "loop number", "numéro de boucle")}
│ │    └─────── ${L(lang, "unit: 1 = train, 01 = decarbonation (MEA)", "unité : 1 = train, 01 = décarbonatation (MEA)")}
│ └──────────── ${L(lang, "functions: I = indicating, C = controller", "fonctions : I = indicateur, C = contrôleur")}
└────────────── ${L(lang, "measured variable: L = level", "variable mesurée : L = niveau")}`}
            </pre>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { tag: "LIC101204", en: "Level indicating controller on loop 204 of the decarbonation unit", fr: "Contrôleur indicateur de niveau de la boucle 204 de l'unité de décarbonatation" },
                { tag: "XV-101-223", en: "On-off valve on loop 223 — same writing, with separators", fr: "Vanne tout-ou-rien de la boucle 223 — même écriture, avec séparateurs" },
                { tag: "PDAH102229", en: "Differential pressure high alarm — the last letter names the device", fr: "Alarme pression différentielle haute — la dernière lettre nomme l'appareil" },
                { tag: "FIQ10602", en: "Flow indicating totalizer — the meter that is read for production", fr: "Totalisateur indicateur de débit — le compteur lu pour la production" },
              ].map(example => (
                <div key={example.tag} className="border border-border rounded-lg bg-card px-3 py-2">
                  <div className="font-mono text-xs font-bold text-cyan-400">{example.tag}</div>
                  <div className="text-[11px] text-muted-foreground">{L(lang, example.en, example.fr)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Facets */}
      <div className="space-y-3">
        <FacetRow
          icon={<Filter className="h-3.5 w-3.5" />}
          label={L(lang, "Measurement", "Mesure")}
          options={facets.byVariable.map(v => ({ key: v.key, label: `${v.key} · ${L(lang, v.en, v.fr)}`, count: v.count }))}
          active={variable}
          onPick={key => setVariable(key)}
          lang={lang}
        />
        <FacetRow
          icon={<Gauge className="h-3.5 w-3.5" />}
          label={L(lang, "Device", "Appareil")}
          options={facets.byDeviceClass.map(c => ({ key: c.key, label: c.key, count: c.count }))}
          active={deviceClass}
          onPick={key => setDeviceClass(key)}
          lang={lang}
        />
        <FacetRow
          icon={<Layers className="h-3.5 w-3.5" />}
          label={L(lang, "Unit", "Unité")}
          options={facets.byUnit.map(u => ({ key: u.code, label: `${u.code} · ${L(lang, u.en, u.fr)}`, count: u.count }))}
          active={unitCode}
          onPick={key => setUnitCode(key)}
          lang={lang}
        />
      </div>

      {/* Result count */}
      <div className="flex items-center gap-2 text-sm" data-testid="instrument-count">
        <Badge variant="outline" className="font-mono text-xs">{matches.length}</Badge>
        <span className="text-muted-foreground">
          {L(lang, "instrument(s) matching", "instrument(s) correspondant(s)")}
          {q.trim() ? ` « ${q.trim()} »` : ""}
        </span>
        {matches.length > results.length && (
          <span className="text-[11px] font-mono text-muted-foreground">
            {L(lang, `showing the first ${results.length}`, `affichage des ${results.length} premiers`)}
          </span>
        )}
        {facets.withoutEquipment > 0 && (
          <span className="text-[11px] font-mono text-muted-foreground ml-auto">
            {facets.withoutEquipment} {L(lang, "without a mapped equipment yet", "sans équipement mappé")}
          </span>
        )}
      </div>

      {/* Results */}
      {results.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {results.map(entry => (
            <InstrumentCard key={entry.tag} entry={entry} lang={lang} />
          ))}
        </div>
      ) : (
        <div className="text-center text-muted-foreground py-16 space-y-2" data-testid="instrument-empty">
          <BookOpen className="h-10 w-10 mx-auto opacity-20" />
          <p className="font-mono text-sm">{L(lang, "No instrument matches your filter.", "Aucun instrument ne correspond à votre filtre.")}</p>
        </div>
      )}
    </div>
  );
}

function FacetRow({
  icon, label, options, active, onPick, lang,
}: {
  icon: React.ReactNode;
  label: string;
  options: Array<{ key: string; label: string; count: number }>;
  active: string | null;
  onPick: (key: string | null) => void;
  lang: "en" | "fr";
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground mr-1">
        {icon}{label}
      </span>
      {options.map(option => {
        const isActive = active === option.key;
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onPick(isActive ? null : option.key)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-mono border transition-all ${
              isActive
                ? "bg-cyan-500 border-cyan-500 text-slate-950"
                : "border-border text-muted-foreground hover:border-cyan-500/40 hover:text-foreground"
            }`}
          >
            {option.label}
            <span className="ml-1.5 opacity-60">{option.count}</span>
          </button>
        );
      })}
      {active && (
        <button
          type="button"
          onClick={() => onPick(null)}
          aria-label={L(lang, "Clear this filter", "Effacer ce filtre")}
          className="text-[11px] font-mono text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          {L(lang, "clear", "effacer")}
        </button>
      )}
    </div>
  );
}
