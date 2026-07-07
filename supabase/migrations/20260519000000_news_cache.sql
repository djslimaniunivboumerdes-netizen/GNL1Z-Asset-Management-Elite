-- News cache table: shared across all users, refreshed every 5 days
CREATE TABLE IF NOT EXISTS public.news_cache (
  id text PRIMARY KEY DEFAULT 'singleton',
  data jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.news_cache ENABLE ROW LEVEL SECURITY;

-- Anyone can read (public news data)
CREATE POLICY "Public read news_cache" ON public.news_cache FOR SELECT USING (true);

-- Only authenticated or service role can insert / upsert
CREATE POLICY "Auth insert news_cache" ON public.news_cache FOR INSERT TO authenticated WITH CHECK (true);

-- Only authenticated or service role can update
CREATE POLICY "Auth update news_cache" ON public.news_cache FOR UPDATE TO authenticated USING (true);
