-- supabase/migrations/20260626000001_ai_responses_cache.sql
-- Sub-second AI caching and self-learning engine for GNL1Z AI Expert

CREATE TABLE IF NOT EXISTS public.ai_responses_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_hash text UNIQUE NOT NULL,
  prompt_text text NOT NULL,
  ai_response text NOT NULL,
  model text DEFAULT 'gemini-1.5-flash',
  hit_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for lightning-fast lookups
CREATE INDEX IF NOT EXISTS ai_cache_hash_idx ON public.ai_responses_cache(prompt_hash);
CREATE INDEX IF NOT EXISTS ai_cache_hits_idx ON public.ai_responses_cache(hit_count desc);
CREATE INDEX IF NOT EXISTS ai_cache_created_idx ON public.ai_responses_cache(created_at desc);

-- RLS Policies
ALTER TABLE public.ai_responses_cache ENABLE ROW LEVEL SECURITY;

-- Anyone can read cached responses
CREATE POLICY "Public read ai_responses_cache" ON public.ai_responses_cache FOR SELECT USING (true);

-- Authenticated / Service Role can insert and update
CREATE POLICY "Auth insert ai_responses_cache" ON public.ai_responses_cache FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update ai_responses_cache" ON public.ai_responses_cache FOR UPDATE TO authenticated USING (true);

-- Trigger to update timestamp
CREATE OR REPLACE FUNCTION update_ai_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ai_cache_updated_at ON public.ai_responses_cache;
CREATE TRIGGER trigger_update_ai_cache_updated_at
  BEFORE UPDATE ON public.ai_responses_cache
  FOR EACH ROW EXECUTE FUNCTION update_ai_cache_updated_at();
