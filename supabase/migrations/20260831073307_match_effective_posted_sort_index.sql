DROP INDEX IF EXISTS public.idx_jobs_effective_posted_at;

CREATE INDEX idx_jobs_effective_posted_at
ON public.jobs (effective_posted_at DESC NULLS LAST, job_id ASC);
