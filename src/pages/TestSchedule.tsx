import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarClock, Search, RefreshCw, Download, ArrowRight, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/contexts/I18nContext";
import { useSchedule } from "@/hooks/useSchedule";
import { ScheduleStatusBadge } from "@/components/ScheduleStatusBadge";
import { exportToCsv } from "@/lib/industrial";
import type { ScheduleStatus } from "@/types/alerts";

const statuses: (ScheduleStatus | "ALL")[] = ["ALL", "OVERDUE", "DUE_SOON", "OK", "UNKNOWN"];
const order: Record<ScheduleStatus, number> = { OVERDUE: 0, DUE_SOON: 1, UNKNOWN: 2, OK: 3 };

export default function TestSchedule() {
  const { lang } = useI18n();
  const L = (en: string, fr: string) => lang === "fr" ? fr : en;
  const { items, loading, errorMessage, isReference, refetch, isFetching, dataUpdatedAt } = useSchedule();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const rawStatus = params.get("status") ?? "ALL";
  const status = statuses.includes(rawStatus as ScheduleStatus) ? rawStatus as ScheduleStatus | "ALL" : "ALL";
  const sort = params.get("sort") === "tag" ? "tag" : "due";
  const setFilter = (key: string, value: string) => setParams((previous) => {
    const next = new URLSearchParams(previous);
    if (!value || value === "ALL") next.delete(key); else next.set(key, value);
    return next;
  }, { replace: true });
  const labels: Record<ScheduleStatus | "ALL", string> = {
    ALL: L("All", "Tous"), OVERDUE: L("Overdue", "En retard"), DUE_SOON: L("Due soon", "Bientôt dû"),
    OK: L("Up to date", "À jour"), UNKNOWN: L("Not scheduled", "Non planifié"),
  };
  const filtered = useMemo(() => items.filter((item) =>
    (status === "ALL" || item.status === status) && `${item.tag} ${item.next_due ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()),
  ).sort((a, b) => sort === "tag" ? a.tag.localeCompare(b.tag) : order[a.status] - order[b.status] || (a.days_left ?? Infinity) - (b.days_left ?? Infinity)), [items, status, query, sort]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 md:py-8 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="mb-2 flex items-center gap-2 text-xs font-medium text-cyan-700 dark:text-cyan-400"><CalendarClock className="h-4 w-4" />{L("MAINTENANCE PLANNING", "PLANIFICATION DES ESSAIS")}</div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{L("Equipment test schedule", "Calendrier des essais")}</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{L("Review verified dates, prioritize overdue tests and open an asset to record a passed test.", "Consultez les dates vérifiées, priorisez les retards et ouvrez un actif pour enregistrer un essai réussi.")}</p></div>
        <Button variant="outline" disabled={!filtered.length} onClick={() => exportToCsv("gnl1z-test-schedule.csv", filtered.map((item) => ({ tag: item.tag, last_passed_test: item.last_test, next_due: item.next_due, days_remaining: item.days_left, status: item.status, source: item.source })))}><Download className="h-4 w-4" />{L("Export view", "Exporter la vue")}</Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-3 text-xs text-muted-foreground"><span>{isReference ? L("Local equipment register · live records not connected", "Référentiel local · dossiers en direct non connectés") : L("Source: passed tests and confirmed schedule overrides", "Source : essais réussis et échéances confirmées")}</span>{dataUpdatedAt > 0 && <span>{L("Checked", "Vérifié")} {new Date(dataUpdatedAt).toLocaleTimeString(lang === "fr" ? "fr-FR" : "en-GB", { hour: "2-digit", minute: "2-digit" })}</span>}</div>
      <section aria-label={L("Schedule filters", "Filtres du calendrier")} className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={(event) => setFilter("q", event.target.value)} aria-label={L("Search schedule by tag or date", "Rechercher par tag ou date")} placeholder={L("Search tag or due date…", "Rechercher un tag ou une date…")} className="h-10 rounded-lg pl-9" /></div>
          <div className="flex gap-2"><select aria-label={L("Sort schedule", "Trier le calendrier")} value={sort} onChange={(event) => setFilter("sort", event.target.value)} className="rounded-lg border border-input bg-background px-3 text-sm"><option value="due">{L("Priority / due date", "Priorité / échéance")}</option><option value="tag">{L("Equipment tag", "Tag équipement")}</option></select><Button variant="outline" size="icon" disabled={loading || isFetching} onClick={() => void refetch()} aria-label={L("Refresh schedule", "Actualiser")}><RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /></Button></div>
        </div>
        <div className="flex flex-wrap gap-2">{statuses.map((value) => <button key={value} aria-pressed={status === value} onClick={() => setFilter("status", value)} className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${status === value ? "border-cyan-600 bg-cyan-600 text-white" : "border-border bg-background text-muted-foreground hover:bg-muted"}`}>{labels[value]}<span className="ml-2 tabular-nums opacity-80">{value === "ALL" ? items.length : items.filter((item) => item.status === value).length}</span></button>)}</div>
      </section>
      {loading ? <div role="status" className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">{L("Loading verified test dates…", "Chargement des dates vérifiées…")}</div>
        : errorMessage ? <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-8 text-center"><WifiOff className="mx-auto mb-3 h-7 w-7 text-amber-600 dark:text-amber-400" /><h2 className="font-semibold">{L("Unable to verify the schedule", "Impossible de vérifier le calendrier")}</h2><p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">{L("No status is assumed when records are unavailable. Check your connection or try again.", "Aucun statut n'est présumé lorsque les dossiers sont indisponibles. Vérifiez la connexion ou réessayez.")}</p><Button variant="outline" className="mt-4" onClick={() => void refetch()}>{L("Try again", "Réessayer")}</Button></div>
        : <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3 text-xs text-muted-foreground"><span aria-live="polite">{filtered.length} {L("of", "sur")} {items.length} {L("assets", "actifs")}</span>{(query || status !== "ALL") && <Button variant="ghost" size="sm" onClick={() => setParams({})}><X className="h-3 w-3" />{L("Clear filters", "Effacer les filtres")}</Button>}</div>
          {filtered.length ? <>
            <div className="hidden overflow-x-auto md:block"><table className="w-full text-sm"><thead className="bg-muted/50 text-xs text-muted-foreground"><tr>{[L("Equipment", "Équipement"), L("Last passed test", "Dernier essai réussi"), L("Next due", "Prochaine échéance"), L("Remaining", "Délai"), L("Status", "Statut"), ""].map((label, index) => <th key={index} scope="col" className="px-5 py-3 text-left font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-border">{filtered.map((item) => <tr key={item.tag} className="hover:bg-muted/40"><td className="px-5 py-4"><Link className="font-mono text-xs font-semibold text-cyan-700 hover:underline dark:text-cyan-400" to={`/equipment/${encodeURIComponent(item.tag)}`}>{item.tag}</Link></td><td className="px-5 py-4 font-mono text-xs text-muted-foreground">{item.last_test ?? "—"}</td><td className="px-5 py-4 font-mono text-xs">{item.next_due ?? "—"}</td><td className="px-5 py-4 text-xs tabular-nums">{item.days_left === null ? "—" : `${item.days_left} ${L("days", "jours")}`}</td><td className="px-5 py-4"><ScheduleStatusBadge status={item.status} /></td><td className="px-4"><Button asChild variant="ghost" size="icon" aria-label={`${L("Open", "Ouvrir")} ${item.tag}`}><Link to={`/equipment/${encodeURIComponent(item.tag)}`}><ArrowRight className="h-4 w-4" /></Link></Button></td></tr>)}</tbody></table></div>
            <div className="divide-y divide-border md:hidden">{filtered.map((item) => <Link key={item.tag} to={`/equipment/${encodeURIComponent(item.tag)}`} className="block space-y-3 p-4 hover:bg-muted/40"><div className="flex items-center justify-between gap-2"><span className="font-mono text-sm font-semibold text-cyan-700 dark:text-cyan-400">{item.tag}</span><ScheduleStatusBadge status={item.status} /></div><div className="flex justify-between gap-3 text-xs text-muted-foreground"><span>{L("Next due", "Échéance")} <strong className="ml-1 font-mono font-medium text-foreground">{item.next_due ?? "—"}</strong></span><span>{item.days_left === null ? L("No date", "Sans date") : `${item.days_left} ${L("days", "jours")}`}</span></div></Link>)}</div>
          </> : <div className="p-12 text-center"><Search className="mx-auto mb-3 h-6 w-6 text-muted-foreground" /><p className="text-sm text-muted-foreground">{L("No equipment matches these filters.", "Aucun équipement ne correspond aux filtres.")}</p><Button variant="outline" className="mt-4" onClick={() => setParams({})}>{L("Reset filters", "Réinitialiser")}</Button></div>}
        </section>}
      <p className="text-xs leading-relaxed text-muted-foreground">{L("Planning assistance only. Fallback intervals are not approved inspection procedures; confirm requirements against the facility's maintenance plan.", "Aide à la planification uniquement. Les intervalles par défaut ne sont pas des procédures approuvées ; confirmez les exigences selon le plan de maintenance.")}</p>
    </div>
  );
}
