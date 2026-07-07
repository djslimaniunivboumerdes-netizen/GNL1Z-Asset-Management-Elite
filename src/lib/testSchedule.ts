// src/lib/testSchedule.ts (new file)
import { differenceInDays, addDays, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

const DEFAULT_INTERVALS = {
  HYDROSTATIC: 365,
  PSV: 180,
  PREVENTIVE: 90,
};

export async function computeNextTestForTag(tag: string) {
  // Get latest log
  const { data: logs } = await supabase
    .from('maintenance_logs')
    .select('*')
    .eq('tag', tag)
    .order('test_date', { ascending: false })
    .limit(1);

  const latest = logs?.[0];
  if (!latest) return null;

  let intervalDays = DEFAULT_INTERVALS.PREVENTIVE;
  if (latest.test_type?.includes('HYDRO')) intervalDays = DEFAULT_INTERVALS.HYDROSTATIC;
  if (latest.test_type?.includes('PSV') || latest.test_type?.includes('VALVE')) intervalDays = DEFAULT_INTERVALS.PSV;

  const lastDate = parseISO(latest.test_date);
  const nextDue = addDays(lastDate, intervalDays);

  // NOTE: equipment_test_dates upsert has been shifted to PostgreSQL database triggers
  // to avoid client-side write amplification and RLS exceptions.

  return {
    lastTest: latest.test_date,
    nextDue: nextDue.toISOString().split('T')[0],
    daysRemaining: differenceInDays(nextDue, new Date()),
    status: getTestStatus(nextDue),
  };
}

function getTestStatus(dueDate: Date) {
  const days = differenceInDays(dueDate, new Date());
  if (days < 0) return 'OVERDUE';
  if (days <= 30) return 'DUE SOON';
  return 'OK';
}
