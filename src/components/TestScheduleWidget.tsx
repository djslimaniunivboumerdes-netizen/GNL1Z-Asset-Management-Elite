import { Link } from "react-router-dom";
import { ArrowRight, CalendarClock, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/contexts/I18nContext";
import { useSchedule } from "@/hooks/useSchedule";
import { ScheduleStatusBadge } from "./ScheduleStatusBadge";

export function TestScheduleWidget() {
  const { lang } = useI18n();
  const { items, loading, errorMessage, isReference, refetch, isFetching } = useSchedule();
  const L = (en: string, fr: string) => lang === "fr" ? fr : en;
  const attention = items.filter((item) => item.status === "OVERDUE" || item.status === "DUE_SOON")
    .sort((a, b) => (a.days_left ?? 0) - (b.days_left ?? 0));
  const overdue = attention.filter((item) => item.status === "OVERDUE").length;
  const unknown = items.filter((item) => item.status === "UNKNOWN").length;

  return (
    <section aria-labelledby="schedule-widget-title" className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-amber-500/10 p-2.5 text-amber-600 dark:text-amber-400"><CalendarClock className="h-5 w-5" /></span>
          <div><h2 id="schedule-widget-title" className="font-display text-base font-semibold">{L("Maintenance outlook", "Suivi des essais")}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{L("Next 30 days", "30 prochains jours")}</p></div>
        </div>
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" disabled={loading || isFetching} onClick={() => void refetch()} aria-label={L("Refresh schedule", "Actualiser le calendrier")}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin motion-reduce:animate-none" : ""}`} />
        </Button>
      </div>

      {loading ? <div role="status" className="my-8 space-y-3"><div className="h-12 animate-pulse rounded-lg bg-muted" /><div className="h-12 animate-pulse rounded-lg bg-muted" /><span className="sr-only">{L("Loading schedule", "Chargement du calendrier")}</span></div>
        : errorMessage ? <div role="alert" className="my-6 rounded-lg border border-amber-500/25 bg-amber-500/5 p-4">
          <WifiOff className="mb-2 h-5 w-5 text-amber-600 dark:text-amber-400" />
          <p className="text-sm font-medium">{L("Schedule unavailable", "Calendrier indisponible")}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{L("We couldn't verify test dates. This does not mean equipment is up to date.", "Les dates n'ont pas pu être vérifiées. Cela ne signifie pas que les équipements sont à jour.")}</p>
        </div>
        : <>
          <div className="my-5 grid grid-cols-2 gap-3">
            <Link to="/test-schedule?status=OVERDUE" className="rounded-lg border border-border bg-background p-3 transition-colors hover:border-rose-500/50">
              <span className="block text-2xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">{overdue}</span><span className="text-xs text-muted-foreground">{L("Overdue tests", "Essais en retard")}</span>
            </Link>
            <Link to="/test-schedule?status=DUE_SOON" className="rounded-lg border border-border bg-background p-3 transition-colors hover:border-amber-500/50">
              <span className="block text-2xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">{attention.length - overdue}</span><span className="text-xs text-muted-foreground">{L("Due within 30 days", "Dus sous 30 jours")}</span>
            </Link>
          </div>
          <div className="mb-5 space-y-1">
            {attention.slice(0, 3).map((item) => <Link key={item.tag} to={`/equipment/${encodeURIComponent(item.tag)}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-2.5 hover:bg-muted">
              <span className="truncate font-mono text-xs font-medium">{item.tag}</span><ScheduleStatusBadge status={item.status} />
            </Link>)}
            {!attention.length && <p className="py-3 text-sm text-muted-foreground">{L("No tests due in the next 30 days.", "Aucun essai prévu dans les 30 prochains jours.")}{unknown > 0 && ` ${unknown} ${L("items have no verified due date.", "éléments sans date vérifiée.")}`}</p>}
          </div>
          {isReference && <p className="mb-3 text-xs text-muted-foreground">{L("Local equipment register · not connected to live records", "Référentiel local · sans connexion aux dossiers en direct")}</p>}
        </>}
      <Button asChild variant="outline" className="mt-auto w-full justify-between rounded-lg">
        <Link to="/test-schedule">{L("View full schedule", "Voir le calendrier complet")}<ArrowRight className="h-4 w-4" /></Link>
      </Button>
    </section>
  );
}
