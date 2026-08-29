create or replace function public.job_listing_location_province_codes(instances jsonb)
returns text[] language sql immutable set search_path = '' as $$
  select coalesce(array_agg(distinct code order by code), '{}'::text[])
  from (
    select public.classify_job_location_province(instance->>'location') as code
    from jsonb_array_elements(coalesce(instances, '[]'::jsonb)) instance
  ) classified
  where code is not null;
$$;

create or replace function public.job_listing_location_scopes(instances jsonb)
returns text[] language sql immutable set search_path = '' as $$
  select coalesce(array_agg(distinct scope order by scope), '{}'::text[])
  from (
    select public.classify_job_location_scope(instance->>'location') as scope
    from jsonb_array_elements(coalesce(instances, '[]'::jsonb)) instance
  ) classified
  where scope is not null;
$$;

alter table public.jobs
  add column if not exists listing_location_province_codes text[]
    generated always as (public.job_listing_location_province_codes(listing_instances)) stored,
  add column if not exists listing_location_scopes text[]
    generated always as (public.job_listing_location_scopes(listing_instances)) stored;

create index if not exists idx_jobs_listing_location_province_codes
  on public.jobs using gin (listing_location_province_codes);
create index if not exists idx_jobs_listing_location_scopes
  on public.jobs using gin (listing_location_scopes);
