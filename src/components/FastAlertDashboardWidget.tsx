import { Link } from "react-router-dom";
import { ArrowRight, Plus, ShieldAlert, WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/contexts/I18nContext";
import { useFastAlerts, alertTypeLabel, priorityStyle } from "@/lib/fastAlerts";
import { isSupabaseConfigured } from "@/integrations/supabase/client";

export default function FastAlertDashboardWidget() {
  const { lang } = useI18n();
  const { data = [], isPending, error, refetch, isFetching } = useFastAlerts();
  const L = (en: string, fr: string) => lang === "fr" ? fr : en;
  const open = data.filter((alert) => alert.status === "OPEN");
  const critical = open.filter((alert) => alert.priority === "P1");
  const loading = isSupabaseConfigured && isPending;
  return (
    <section aria-labelledby="alerts-widget-title" className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="rounded-lg bg-rose-500/10 p-2.5 text-rose-600 dark:text-rose-400"><ShieldAlert className="h-5 w-5" /></span><div><h2 id="alerts-widget-title" className="font-display text-base font-semibold">{L("Safety observations", "Observations de sécurité")}</h2><p className="mt-0.5 text-xs text-muted-foreground">{L("Fast Alert Center", "Centre d'alertes rapides")}</p></div></div>
        <Button asChild variant="outline" size="sm" className="shrink-0"><Link to="/alerts?report=1"><Plus className="h-4 w-4" /><span className="hidden sm:inline">{L("Report", "Signaler")}</span><span className="sr-only sm:hidden">{L("Report an alert", "Signaler une alerte")}</span></Link></Button>
      </div>
      {loading ? <div role="status" className="my-8 space-y-3"><div className="h-12 animate-pulse rounded-lg bg-muted" /><div className="h-12 animate-pulse rounded-lg bg-muted" /><span className="sr-only">{L("Loading alerts", "Chargement des alertes")}</span></div>
        : error || !isSupabaseConfigured ? <div role="status" className="my-6 rounded-lg border border-border bg-muted/40 p-4"><WifiOff className="mb-2 h-5 w-5 text-muted-foreground" /><p className="text-sm font-medium">{L("Live alerts unavailable", "Alertes en direct indisponibles")}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{L("Incident counts cannot be verified right now.", "Le nombre d'incidents ne peut pas être vérifié.")}</p>{error && <Button variant="ghost" size="sm" className="mt-2 px-0" disabled={isFetching} onClick={() => void refetch()}><RefreshCw className="h-3 w-3" />{L("Retry", "Réessayer")}</Button>}</div>
        : <>
          <div className="my-5 grid grid-cols-2 gap-3"><Link to="/alerts" className="rounded-lg border border-border bg-background p-3 hover:border-cyan-500/50"><span className="block text-2xl font-semibold tabular-nums">{open.length}</span><span className="text-xs text-muted-foreground">{L("Open observations", "Observations ouvertes")}</span></Link><Link to="/alerts?priority=P1" className="rounded-lg border border-border bg-background p-3 hover:border-rose-500/50"><span className="block text-2xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">{critical.length}</span><span className="text-xs text-muted-foreground">{L("P1 · Critical", "P1 · Critique")}</span></Link></div>
          <div className="mb-5 space-y-1">{open.slice(0, 3).map((alert) => <Link key={alert.id} to={`/alerts?q=${encodeURIComponent(alert.id)}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-muted"><div className="min-w-0"><p className="truncate text-xs font-medium">{alertTypeLabel(alert.alert_type, lang)}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{alert.location}</p></div><span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-medium ${priorityStyle(alert.priority)}`}>{alert.priority}</span></Link>)}{!open.length && <p className="py-3 text-sm text-muted-foreground">{L("No open observations in the register.", "Aucune observation ouverte dans le registre.")}</p>}</div>
        </>}
      <Button asChild variant="outline" className="mt-auto w-full justify-between rounded-lg"><Link to="/alerts">{L("Open Alert Center", "Ouvrir le centre d'alertes")}<ArrowRight className="h-4 w-4" /></Link></Button>
    </section>
  );
}
