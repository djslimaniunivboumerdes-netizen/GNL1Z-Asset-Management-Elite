import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import type { FastAlert } from "@/integrations/supabase/types";

export const ALERT_TYPES = [
  ["accident", "Accident", "Accident"],
  ["almost_accident", "Near miss", "Presque accident"],
  ["leakage", "Leakage", "Fuite"],
  ["dangerous", "Dangerous situation", "Situation dangereuse"],
  ["fire", "Fire / explosion risk", "Risque incendie / explosion"],
  ["equipment_failure", "Equipment failure", "Défaillance équipement"],
  ["safety_violation", "Safety violation", "Violation sécurité"],
  ["other", "Other", "Autre"],
] as const;
export const PRIORITIES = [["P1", "Critical", "Critique"], ["P2", "High", "Haute"], ["P3", "Medium", "Moyenne"]] as const;
export const TRAINS = ["T100", "T200", "T300", "T400", "T500", "T600"];
export const alertTypeLabel = (value: string, lang: string) => {
  const type = ALERT_TYPES.find(([id]) => id === value);
  return type ? type[lang === "fr" ? 2 : 1] : value;
};
export const priorityLabel = (value: string, lang: string) => {
  const priority = PRIORITIES.find(([id]) => id === value);
  return priority ? `${value} · ${priority[lang === "fr" ? 2 : 1]}` : value;
};
export const priorityStyle = (value: string) => value === "P1" ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25"
  : value === "P2" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25"
  : "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25";

export function useFastAlerts() {
  return useQuery({
    queryKey: ["fast-alerts"],
    enabled: isSupabaseConfigured,
    queryFn: async (): Promise<FastAlert[]> => {
      const { data, error } = await supabase.from("fast_alerts").select("*").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}
