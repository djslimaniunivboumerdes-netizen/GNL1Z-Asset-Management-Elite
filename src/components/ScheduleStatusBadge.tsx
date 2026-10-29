import { AlertTriangle, CircleHelp, Clock, CheckCircle2 } from "lucide-react";
import type { ScheduleStatus } from "@/types/alerts";
import { useI18n } from "@/contexts/I18nContext";

const styles: Record<ScheduleStatus, string> = {
  OVERDUE: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  DUE_SOON: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  OK: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  UNKNOWN: "border-border bg-muted text-muted-foreground",
};
export function ScheduleStatusBadge({ status }: { status: ScheduleStatus }) {
  const { lang } = useI18n();
  const labels = {
    OVERDUE: ["Overdue", "En retard"], DUE_SOON: ["Due soon", "Bientôt dû"],
    OK: ["Up to date", "À jour"], UNKNOWN: ["Not scheduled", "Non planifié"],
  };
  const Icon = status === "OVERDUE" ? AlertTriangle : status === "DUE_SOON" ? Clock : status === "OK" ? CheckCircle2 : CircleHelp;
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1 text-xs font-medium ${styles[status]}`}>
    <Icon className="h-3 w-3" aria-hidden="true" />{labels[status][lang === "fr" ? 1 : 0]}
  </span>;
}
