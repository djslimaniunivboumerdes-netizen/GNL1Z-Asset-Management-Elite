import { useDeferredValue, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, Download, ArrowRight, Filter, Box, X, ChevronLeft, ChevronRight, Database } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EQUIPMENT, UNITS, STATUSES } from "@/data";
import { exportToCsv } from "@/lib/industrial";
import { createEquipmentSearch, matchingParts } from "@/lib/equipmentSearch";
import { useI18n } from "@/contexts/I18nContext";

const PAGE_SIZE = 20;
const searchEquipment = createEquipmentSearch(EQUIPMENT);

function StatusChip({ status }: { status: string }) {
  const color = status === "DEROGATION" ? "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300"
    : status === "PREVENTIVE" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    : "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return <span className={`inline-flex whitespace-nowrap rounded-md border px-2 py-1 text-[10px] font-medium ${color}`}>{status}</span>;
}

export default function EquipmentList() {
  const { t, lang } = useI18n();
  const L = (en: string, fr: string) => lang === "fr" ? fr : en;
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const deferredQuery = useDeferredValue(query);
  const unit = UNITS.includes(params.get("unit") ?? "") ? params.get("unit")! : "all";
  const status = STATUSES.includes(params.get("status") ?? "") ? params.get("status")! : "all";
  const sort = params.get("sort") ?? "register";
  const setFilter = (key: string, value: string) => setParams((previous) => {
    const next = new URLSearchParams(previous);
    if (!value || value === "all") next.delete(key); else next.set(key, value);
    if (key !== "page") next.delete("page");
    return next;
  }, { replace: true });

  const filtered = useMemo(() => {
    const result = searchEquipment(deferredQuery).filter((item) => (unit === "all" || item.unit === unit) && (status === "all" || item.testing_status === status));
    return sort === "register" ? result : [...result].sort((a, b) => sort === "parts" ? b.spare_parts.count - a.spare_parts.count : a.tag.localeCompare(b.tag));
  }, [deferredQuery, unit, status, sort]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(pageCount - 1, Math.max(0, Math.floor(Number(params.get("page")) || 1) - 1));
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const hasFilters = Boolean(query || unit !== "all" || status !== "all");
  const linkOf = (tag: string) => `/equipment/${encodeURIComponent(tag)}`;
  const handleExport = () => exportToCsv("gnl1z_equipment.csv", filtered.map((item) => ({
    tag: item.tag, name: item.name, type: item.type.name, unit: item.unit, section: item.section,
    status: item.testing_status, weight_kg: item.technical.weight_kg, pressure_bar: item.technical.pressure_bar,
    volume_m3: item.technical.volume_m3, serial_no: item.technical.serial_no, parts_count: item.spare_parts.count, notes: item.notes ?? "",
  })));

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 md:py-8 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><div className="mb-2 flex items-center gap-2 text-xs font-medium text-cyan-700 dark:text-cyan-400"><Database className="h-4 w-4" />{L("TECHNICAL REGISTER", "RÉFÉRENTIEL TECHNIQUE")}</div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("equipment")}</h1><p className="mt-2 text-sm text-muted-foreground">{L("Equipment specifications, components and maintenance records.", "Spécifications, composants et dossiers de maintenance des équipements.")}</p></div>
        <Button variant="outline" onClick={handleExport} disabled={!filtered.length} className="rounded-lg"><Download className="h-4 w-4" />{t("exportCsv")}</Button>
      </div>
      <section aria-label={L("Equipment filters", "Filtres des équipements")} className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="relative"><Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" /><Input type="search" placeholder={L("Search tag, equipment, serial number or spare part…", "Rechercher un tag, équipement, série ou pièce…")} aria-label={t("searchEquipment")} value={query} onChange={(event) => setFilter("q", event.target.value)} className="h-11 rounded-lg bg-background pl-10 pr-10 text-sm" />{query && <Button variant="ghost" size="icon" aria-label={L("Clear search", "Effacer la recherche")} onClick={() => setFilter("q", "")} className="absolute right-1 top-1 h-9 w-9"><X className="h-4 w-4" /></Button>}</div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <div className="relative"><Filter className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><select aria-label={t("unit")} value={unit} onChange={(event) => setFilter("unit", event.target.value)} className="h-11 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm"><option value="all">{t("filterAll")}</option>{UNITS.map((value) => <option key={value}>{value}</option>)}</select></div>
          <select aria-label={t("status")} value={status} onChange={(event) => setFilter("status", event.target.value)} className="h-11 min-w-0 rounded-lg border border-input bg-background px-3 text-sm"><option value="all">{t("filterStatus")}</option>{STATUSES.map((value) => <option key={value}>{value}</option>)}</select>
          <select aria-label={L("Sort equipment", "Trier les équipements")} value={sort} onChange={(event) => setFilter("sort", event.target.value)} className="h-11 min-w-0 rounded-lg border border-input bg-background px-3 text-sm"><option value="register">{L("Register order", "Ordre du registre")}</option><option value="tag">{L("Tag A–Z", "Tag A–Z")}</option><option value="parts">{L("Most parts", "Plus de pièces")}</option></select>
          <Button variant="ghost" disabled={!hasFilters} onClick={() => setParams({})} className="col-span-2 h-11 text-muted-foreground lg:col-span-1"><X className="h-4 w-4" />{L("Reset filters", "Réinitialiser")}</Button>
        </div>
      </section>
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground"><span role="status" aria-live="polite">{filtered.length} {L("of", "sur")} {EQUIPMENT.length} {L("equipment items", "équipements")}</span><span className="hidden sm:inline">{L("Select an asset to open its technical file", "Sélectionnez un actif pour ouvrir son dossier")}</span></div>
      {filtered.length ? <>
        <section className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
          <table className="w-full text-sm"><thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground"><tr>{[t("tag"), t("name"), t("unit"), t("status"), t("parts"), ""].map((label, index) => <th key={index} scope="col" className={`px-4 py-3.5 font-medium ${index === 4 ? "text-right" : "text-left"}`}>{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">{pageItems.map((item) => {
              const parts = matchingParts(item, deferredQuery);
              return <tr key={item.tag} className="transition-colors hover:bg-muted/40"><td className="whitespace-nowrap px-4 py-4 font-mono text-xs font-semibold"><Link to={linkOf(item.tag)} className="text-cyan-700 hover:underline dark:text-cyan-400">{item.tag}</Link></td><td className="max-w-[340px] px-4 py-4"><Link to={linkOf(item.tag)} className="block font-medium hover:underline">{item.name}</Link><span className="mt-1 block text-xs text-muted-foreground">{item.type.name} · {item.section}</span>{parts.length > 0 && <span className="mt-2 inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-1 text-[10px] text-amber-700 dark:text-amber-300"><Box className="h-3 w-3" />{parts.length} {L("matching parts", "pièces correspondantes")}</span>}</td><td className="px-4 py-4 font-mono text-xs text-muted-foreground">{item.unit}</td><td className="px-4 py-4"><StatusChip status={item.testing_status} /></td><td className="px-4 py-4 text-right font-mono text-xs tabular-nums">{item.spare_parts.count}</td><td className="px-3"><Button asChild variant="ghost" size="icon" aria-label={`${L("Open", "Ouvrir")} ${item.tag}`}><Link to={linkOf(item.tag)}><ArrowRight className="h-4 w-4" /></Link></Button></td></tr>;
            })}</tbody>
          </table>
        </section>
        <section className="space-y-3 md:hidden" aria-label={L("Equipment results", "Résultats des équipements")}>{pageItems.map((item) => {
          const parts = matchingParts(item, deferredQuery);
          return <Link key={item.tag} to={linkOf(item.tag)} className="block rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-cyan-500/50"><div className="flex items-center justify-between gap-2"><span className="font-mono text-sm font-semibold text-cyan-700 dark:text-cyan-400">{item.tag}</span><StatusChip status={item.testing_status} /></div><h2 className="mt-3 text-sm font-semibold leading-relaxed">{item.name}</h2><p className="mt-1 text-xs text-muted-foreground">{item.type.name}</p>{parts.length > 0 && <p className="mt-2 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300"><Box className="h-3 w-3" />{parts.length} {L("matching parts", "pièces correspondantes")}</p>}<div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground"><span>{item.unit} · {item.section}</span><span className="flex items-center gap-2">{item.spare_parts.count} {t("parts")}<ArrowRight className="h-3.5 w-3.5" /></span></div></Link>;
        })}</section>
        <nav aria-label={L("Equipment pagination", "Pagination des équipements")} className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><span>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} {L("of", "sur")} {filtered.length}</span><div className="flex items-center gap-3"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => setFilter("page", String(page))}><ChevronLeft className="h-4 w-4" />{L("Previous", "Précédent")}</Button><span className="tabular-nums">{page + 1} / {pageCount}</span><Button variant="outline" size="sm" disabled={page >= pageCount - 1} onClick={() => setFilter("page", String(page + 2))}>{L("Next", "Suivant")}<ChevronRight className="h-4 w-4" /></Button></div></nav>
      </> : <section className="rounded-xl border border-dashed border-border bg-card px-5 py-16 text-center"><Search className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-4 font-semibold">{L("No matching equipment", "Aucun équipement trouvé")}</h2><p className="mt-2 text-sm text-muted-foreground">{L("Try a shorter tag or remove a filter.", "Essayez un tag plus court ou supprimez un filtre.")}</p><Button variant="outline" className="mt-5" onClick={() => setParams({})}>{L("Clear all filters", "Effacer tous les filtres")}</Button></section>}
    </div>
  );
}
