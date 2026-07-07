CREATE TABLE IF NOT EXISTS public.dcs_detected_instruments (
  panel_id text PRIMARY KEY,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  detected_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.dcs_detected_instruments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read dcs detections" ON public.dcs_detected_instruments FOR SELECT USING (true);
CREATE POLICY "Auth insert dcs detections" ON public.dcs_detected_instruments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update dcs detections" ON public.dcs_detected_instruments FOR UPDATE TO authenticated USING (true);
