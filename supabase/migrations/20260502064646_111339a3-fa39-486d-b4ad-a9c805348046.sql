-- Create equipment_test_dates table
CREATE TABLE IF NOT EXISTS public.equipment_test_dates (
  tag text PRIMARY KEY,
  last_tested date,
  next_test_due date,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment_test_dates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read equipment_test_dates" ON public.equipment_test_dates FOR SELECT USING (true);
CREATE POLICY "Auth insert equipment_test_dates" ON public.equipment_test_dates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update equipment_test_dates" ON public.equipment_test_dates FOR UPDATE TO authenticated USING (true);

-- Create equipment_notes table
CREATE TABLE IF NOT EXISTS public.equipment_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS equipment_notes_tag_idx ON public.equipment_notes(tag);
ALTER TABLE public.equipment_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read equipment_notes" ON public.equipment_notes FOR SELECT USING (true);
CREATE POLICY "Auth insert equipment_notes" ON public.equipment_notes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update equipment_notes" ON public.equipment_notes FOR UPDATE TO authenticated USING (true);
