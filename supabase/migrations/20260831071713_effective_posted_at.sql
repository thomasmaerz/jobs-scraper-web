ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS effective_posted_at timestamptz
GENERATED ALWAYS AS (GREATEST(posted_at, last_seen_posted_at)) STORED;

CREATE INDEX IF NOT EXISTS idx_jobs_effective_posted_at
ON public.jobs (effective_posted_at DESC);
