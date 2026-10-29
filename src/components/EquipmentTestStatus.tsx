import { CalendarClock } from "lucide-react";
import { useSchedule } from "@/hooks/useSchedule";
import { useI18n } from "@/contexts/I18nContext";
import { ScheduleStatusBadge } from "./ScheduleStatusBadge";

export function EquipmentTestStatus({ tag }: { tag: string }) {
  const { items, loading, errorMessage, isReference } = useSchedule();
  const { lang } = useI18n();
  const L = (en: string, fr: string) => lang === "fr" ? fr : en;
  const item = items.find((entry) => entry.tag === tag);
  return (
    <section className="rounded-xl border border-border bg-card p-5 text-card-foreground">
      <div className="mb-4 flex flex-wrap items-center gap-2"><CalendarClock className="h-4 w-4 text-cyan-600 dark:text-cyan-400" /><h3 className="font-semibold">{L("Test schedule", "Calendrier des essais")}</h3>{item && <ScheduleStatusBadge status={item.status} />}</div>
      {loading ? <p role="status" className="text-sm text-muted-foreground">{L("Loading test dates…", "Chargement des dates…")}</p>
        : errorMessage ? <p role="alert" className="text-sm text-muted-foreground">{L("Test dates are unavailable. Please retry from the schedule.", "Dates indisponibles. Réessayez depuis le calendrier.")}</p>
        : item ? <>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[[L("Last passed test", "Dernier essai réussi"), item.last_test], [L("Next due", "Prochaine échéance"), item.next_due], [L("Days remaining", "Jours restants"), item.days_left]].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-muted/60 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-mono text-base font-medium">{value ?? "—"}</dd></div>)}
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">{isReference ? L("Source: local equipment register", "Source : référentiel local") : item.source === "register" ? L("Source: equipment register; no newer passed test or override found.", "Source : référentiel ; aucun essai réussi récent ni remplacement trouvé.") : item.source === "override" ? L("Source: manually confirmed schedule", "Source : calendrier confirmé manuellement") : L("Source: latest passed maintenance log and planning interval", "Source : dernier essai réussi et intervalle de planification")}</p>
        </> : null}
    </section>
  );
}
