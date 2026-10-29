import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Clock, History, RefreshCw } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { useI18n } from "@/contexts/I18nContext";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/integrations/supabase/types";
import { parseDateOnly } from "@/lib/scheduleDates";

type LogRow = Pick<Tables<"maintenance_logs">["Row"], "id" | "test_date" | "test_type" | "result" | "technician_name" | "test_pressure_shell" | "test_pressure_tube" | "notes">;

export function MaintenanceTimeline({ tag }: { tag: string }) {
  const { lang } = useI18n();
  const L = (en: string, fr: string) => lang === "fr" ? fr : en;
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) { setLoading(false); setError(true); return; }
    setLoading(true); setError(false);
    void (async () => {
      try {
        const { data, error: queryError } = await supabase.from("maintenance_logs")
          .select("id, test_date, test_type, result, technician_name, test_pressure_shell, test_pressure_tube, notes")
          .eq("tag", tag).order("test_date", { ascending: false }).order("created_at", { ascending: false }).limit(20);
        if (!active) return;
        if (queryError) setError(true); else setLogs(data ?? []);
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [tag, version]);

  return <section className="rounded-xl border border-border bg-card p-5 text-card-foreground">
    <h3 className="mb-4 flex items-center gap-2 font-display font-semibold"><History className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />{L("Maintenance history", "Historique de maintenance")}<span className="ml-auto text-xs font-normal text-muted-foreground">{L("Latest 20 records", "20 derniers dossiers")}</span></h3>
    {loading ? <p role="status" className="text-sm text-muted-foreground">{L("Loading history…", "Chargement de l'historique…")}</p>
      : error ? <div role="alert" className="text-sm text-muted-foreground"><p>{L("History unavailable. Existing records cannot be verified.", "Historique indisponible. Les dossiers existants ne peuvent être vérifiés.")}</p><Button variant="outline" size="sm" className="mt-3" onClick={() => setVersion((value) => value + 1)}><RefreshCw className="h-4 w-4" />{L("Retry", "Réessayer")}</Button></div>
      : !logs.length ? <p className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">{L("No maintenance records in the connected register.", "Aucun dossier de maintenance dans le registre connecté.")}</p>
      : <ol className="ml-2 space-y-5 border-l border-border">{logs.map((log) => <li key={log.id} className="relative ml-5">
        <span className="absolute -left-[27px] top-0.5 rounded-full bg-card">{log.result === "PASS" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : log.result === "FAIL" ? <XCircle className="h-3.5 w-3.5 text-destructive" /> : <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />}</span>
        <div className="flex flex-wrap items-center gap-2"><time dateTime={log.test_date} className="font-mono text-sm font-semibold">{parseDateOnly(log.test_date) ? log.test_date : L("Invalid date", "Date invalide")}</time><span className={`rounded px-2 py-0.5 text-xs font-medium ${log.result === "PASS" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : log.result === "FAIL" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>{log.result}</span><span className="text-xs text-muted-foreground">{log.test_type}</span></div>
        <p className="mt-1 text-xs text-muted-foreground">{log.test_pressure_shell != null && `${L("Shell", "Calandre")} ${log.test_pressure_shell} bar · `}{log.test_pressure_tube != null && `${L("Tube", "Faisceau")} ${log.test_pressure_tube} bar · `}{log.technician_name}</p>
        {log.notes && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/80">{log.notes}</p>}
      </li>)}</ol>}
  </section>;
}
