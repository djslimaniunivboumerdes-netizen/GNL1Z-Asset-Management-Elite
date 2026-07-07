// src/pages/TestSchedule.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, AlertTriangle, ArrowUpDown } from "lucide-react";
import { buildSchedule } from "@/lib/alertEngine";
import type { ScheduleItem, ScheduleStatus } from "@/types/alerts";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type SortKey = "days_left" | "status" | "tag";

const STATUS_ORDER: Record<ScheduleStatus, number> = { OVERDUE: 0, DUE_SOON: 1, OK: 2 };

function StatusBadge({ status }: { status: ScheduleStatus }) {
  if (status === "OVERDUE")
    return <Badge className="bg-red-600 text-white font-mono text-[10px]">OVERDUE</Badge>;
  if (status === "DUE_SOON")
    return <Badge className="bg-amber-500 text-white font-mono text-[10px]">DUE SOON</Badge>;
  return <Badge variant="outline" className="text-emerald-500 border-emerald-500/40 font-mono text-[10px]">OK</Badge>;
}

export default function TestSchedule() {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("days_left");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ScheduleStatus | "ALL">("ALL");

  useEffect(() => {
    buildSchedule().then(setItems).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = items;
    if (statusFilter !== "ALL") list = list.filter((i) => i.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.tag.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      if (sortKey === "tag") return a.tag.localeCompare(b.tag);
      if (sortKey === "status") {
        const diff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        return diff !== 0 ? diff : (a.days_left ?? 9999) - (b.days_left ?? 9999);
      }
      return (a.days_left ?? 9999) - (b.days_left ?? 9999);
    });
  }, [items, sortKey, search, statusFilter]);

  const overdueCount = items.filter((i) => i.status === "OVERDUE").length;
  const dueSoonCount  = items.filter((i) => i.status === "DUE_SOON").length;

  return (
    <div className="px-4 md:px-8 py-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <CalendarClock className="h-5 w-5 text-accent" />
        <h1 className="text-2xl font-display font-bold">Next Test Schedule</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        {items.length} equipment tracked · {overdueCount} overdue · {dueSoonCount} due within 30 days
      </p>

      {/* Filters */}
      <div className="border border-border rounded-lg bg-card p-4 mb-4 flex flex-col md:flex-row gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tag…"
          className="md:max-w-xs"
        />
        <div className="flex gap-1.5 flex-wrap">
          {(["ALL", "OVERDUE", "DUE_SOON", "OK"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs px-3 py-1.5 rounded border font-mono transition ${
                statusFilter === s
                  ? "bg-accent text-accent-foreground border-accent"
                  : "border-border text-muted-foreground hover:border-accent/50"
              }`}
            >
              {s === "ALL" ? "All" : s.replace("_", " ")}
            </button>
          ))}
        </div>
        <div className="md:ml-auto flex gap-1.5 items-center">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Sort:</span>
          {(["days_left", "status", "tag"] as SortKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setSortKey(k)}
              className={`text-[11px] px-2 py-1 rounded border font-mono transition ${
                sortKey === k
                  ? "bg-accent text-accent-foreground border-accent"
                  : "border-border text-muted-foreground hover:border-accent/50"
              }`}
            >
              {k === "days_left" ? "Days" : k === "status" ? "Status" : "Tag"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <div className="hidden md:grid grid-cols-[1fr_140px_140px_120px_120px] bg-secondary/60 text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-2.5 font-semibold gap-2">
          <div className="flex items-center gap-1"><ArrowUpDown className="h-3 w-3" /> Tag</div>
          <div>Last Test</div>
          <div>Next Due</div>
          <div>Remaining</div>
          <div>Status</div>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground text-center py-12">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-12">No equipment matches the filters</div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((item) => (
              <Link
                key={item.tag}
                to={`/equipment/${encodeURIComponent(item.tag)}`}
                className="flex md:grid md:grid-cols-[1fr_140px_140px_120px_120px] items-center gap-2 px-4 py-3 hover:bg-secondary/40 transition text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {item.status === "OVERDUE" && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                  <span className="font-mono font-semibold text-accent truncate">{item.tag}</span>
                </div>
                <div className="hidden md:block text-xs text-muted-foreground font-mono">{item.last_test ?? "—"}</div>
                <div className="hidden md:block text-xs font-mono">{item.next_due ?? "—"}</div>
                <div className={`hidden md:block text-xs font-bold font-mono ${
                  item.status === "OVERDUE" ? "text-red-500" : item.status === "DUE_SOON" ? "text-amber-500" : "text-foreground"
                }`}>
                  {item.days_left === null ? "—" : item.days_left < 0 ? `−${Math.abs(item.days_left)}d` : `${item.days_left}d`}
                </div>
                <div className="ml-auto md:ml-0"><StatusBadge status={item.status} /></div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
