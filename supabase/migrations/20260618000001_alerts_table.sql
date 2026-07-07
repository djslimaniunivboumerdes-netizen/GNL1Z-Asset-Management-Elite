-- supabase/migrations/20260618000001_alerts_table.sql
-- New table for Alerts & Fast Alerts as per spec

CREATE TABLE IF NOT EXISTS public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag text NOT NULL,
  alert_type text NOT NULL,           -- e.g. 'FAILED_TEST', 'OVERDUE_TEST', 'UPCOMING_TEST', 'NOTE_KEYWORD'
  priority text NOT NULL CHECK (priority in ('HIGH', 'MEDIUM', 'LOW')),
  message text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status in ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')),
  source_log_id uuid REFERENCES public.maintenance_logs(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS alerts_tag_idx ON public.alerts(tag);
CREATE INDEX IF NOT EXISTS alerts_status_idx ON public.alerts(status);
CREATE INDEX IF NOT EXISTS alerts_priority_idx ON public.alerts(priority);
CREATE INDEX IF NOT EXISTS alerts_created_idx ON public.alerts(created_at desc);

-- RLS
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts_read_all" ON public.alerts FOR SELECT USING (true);
CREATE POLICY "alerts_insert_auth" ON public.alerts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "alerts_update_auth" ON public.alerts FOR UPDATE TO authenticated USING (true);

-- Trigger to update timestamp
CREATE OR REPLACE FUNCTION update_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_alerts_updated_at
  BEFORE UPDATE ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION update_alerts_updated_at();

-- Fast Alerts table (used by AlertCenter UI and Dashboard Widgets)
CREATE TABLE IF NOT EXISTS public.fast_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  priority text NOT NULL,
  location text NOT NULL,
  description text NOT NULL,
  photo_url text,
  status text NOT NULL DEFAULT 'OPEN',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fast_alerts_status_idx ON public.fast_alerts(status);
CREATE INDEX IF NOT EXISTS fast_alerts_created_idx ON public.fast_alerts(created_at desc);

ALTER TABLE public.fast_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fast_alerts_read_all" ON public.fast_alerts FOR SELECT USING (true);
CREATE POLICY "fast_alerts_insert_auth" ON public.fast_alerts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fast_alerts_update_auth" ON public.fast_alerts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "fast_alerts_delete_auth" ON public.fast_alerts FOR DELETE TO authenticated USING (true);
