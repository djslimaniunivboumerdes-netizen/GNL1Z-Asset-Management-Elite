// src/components/EquipmentTestStatus.tsx
// Drop-in widget for EquipmentDetail.tsx — shows Last Test / Next Due / Remaining Days
// for a single equipment tag. Add it inside TechInfoTab, right above or below
// the existing <TestDatesEditor /> block.

import { useEffect, useState } from "react";
import { CalendarClock, AlertTriangle } from "lucide-react";
import { buildSchedule } from "@/lib/alertEngine";
import type { ScheduleItem } from "@/types/alerts";
import { Badge } from "@/components/ui/badge";

export function EquipmentTestStatus({ tag }: { tag: string }) {
  const [item, setItem] = useState<ScheduleItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    buildSchedule().then((all) => {
      if (!active) return;
      setItem(all.find((i) => i.tag === tag) ?? null);
      setLoading(false);
    });
    return () => { active = false; };
  }, [tag]);

  if (loading) {
    return (
      <div className="border border-border rounded-lg bg-card p-5">
        <div className="text-xs text-muted-foreground">Loading test schedule…</div>
      </div>
    );
  }

  if (!item || (!item.last_test && !item.next_due)) {
    return null; // nothing recorded yet — don't clutter the page
  }

  const statusColor =
    item.status === "OVERDUE"  ? "text-red-500"
    : item.status === "DUE_SOON" ? "text-amber-500"
    : "text-emerald-500";

  return (
    <div className="border border-border rounded-lg bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <CalendarClock className="h-4 w-4 text-accent" />
        <h3 className="font-display font-semibold">Test Schedule</h3>
        {item.status === "OVERDUE" && (
          <Badge className="bg-red-600 text-white text-[10px] ml-1">OVERDUE</Badge>
        )}
        {item.status === "DUE_SOON" && (
          <Badge className="bg-amber-500 text-white text-[10px] ml-1">DUE SOON</Badge>
        )}
        {item.status === "OK" && (
          <Badge variant="outline" className="text-emerald-500 border-emerald-500/40 text-[10px] ml-1">OK</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-border rounded bg-secondary/40 p-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Last Test</div>
          <div className="font-mono font-bold text-lg">{item.last_test ?? "—"}</div>
        </div>
        <div className="border border-border rounded bg-secondary/40 p-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Next Due</div>
          <div className="font-mono font-bold text-lg">{item.next_due ?? "—"}</div>
        </div>
        <div className="border border-border rounded bg-secondary/40 p-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1">
            {item.status === "OVERDUE" && <AlertTriangle className="h-3 w-3 text-red-500" />}
            Remaining Days
          </div>
          <div className={`font-mono font-bold text-lg ${statusColor}`}>
            {item.days_left === null
              ? "—"
              : item.days_left < 0
              ? `−${Math.abs(item.days_left)}d`
              : `${item.days_left}d`}
          </div>
        </div>
      </div>
    </div>
  );
}
