import { useQuery } from "@tanstack/react-query";
import { buildSchedule } from "@/lib/alertEngine";
import { isSupabaseConfigured } from "@/integrations/supabase/client";

export function useSchedule() {
  const query = useQuery({ queryKey: ["maintenance-schedule"], queryFn: () => buildSchedule() });
  return {
    ...query,
    items: query.data ?? [],
    loading: query.isPending,
    errorMessage: query.error?.message ?? null,
    isReference: !isSupabaseConfigured,
  };
}
