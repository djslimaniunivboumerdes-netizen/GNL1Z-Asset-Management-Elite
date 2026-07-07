import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { CheckCircle2, XCircle, Clock, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LogRow {
  id: string;
  test_date: string;
  test_type: string;
  result: string;
  technician_name: string | null;
  test_pressure_shell: number | null;
  test_pressure_tube: number | null;
  notes: string | null;
}

export function MaintenanceTimeline({ tag }: { tag: string }) {
  const [logs, setLogs] = useState<LogRow[] | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from("maintenance_logs" as never)
      .select("id, test_date, test_type, result, technician_name, test_pressure_shell, test_pressure_tube, notes")
      .eq("tag", tag)
      .order("test_date", { ascending: false })
      .limit(20)
      .then(({ data }) => { if (active) setLogs((data as unknown as LogRow[]) ?? []); });
    return () => { active = false; };
  }, [tag]);

  if (logs === null) return <div className="text-xs text-muted-foreground">Loading history…</div>;
  if (logs.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
        No maintenance records yet.
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <History className="h-4 w-4 text-accent" />
        <h3 className="font-display font-semibold">Maintenance history</h3>
        <span className="text-xs text-muted-foreground ml-auto font-mono">{logs.length} entries</span>
      </div>
      <ol className="relative border-l border-border ml-2 space-y-4">
        {logs.map((l) => (
          <li key={l.id} className="ml-4">
            <span className="absolute -left-1.5 flex items-center justify-center w-3 h-3 rounded-full bg-card border border-border">
              {l.result === "PASS" && <CheckCircle2 className="h-3 w-3 text-green-500" />}
              {l.result === "FAIL" && <XCircle className="h-3 w-3 text-destructive" />}
              {l.result === "PENDING" && <Clock className="h-3 w-3 text-amber-500" />}
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-semibold">{format(parseISO(l.test_date), "yyyy-MM-dd")}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                l.result === "PASS" ? "bg-green-500/10 text-green-600 dark:text-green-400" :
                l.result === "FAIL" ? "bg-destructive/10 text-destructive" :
                "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              }`}>{l.result}</span>
              <span className="text-[10px] font-mono text-muted-foreground">{l.test_type}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1 font-mono">
              {l.test_pressure_shell != null && <span>Shell {l.test_pressure_shell} bar</span>}
              {l.test_pressure_tube != null && <span> · Tube {l.test_pressure_tube} bar</span>}
              {l.technician_name && <span> · {l.technician_name}</span>}
            </div>
            {l.notes && <div className="text-sm text-foreground/80 mt-1">{l.notes}</div>}
          </li>
        ))}
      </ol>
    </div>
  );
}
