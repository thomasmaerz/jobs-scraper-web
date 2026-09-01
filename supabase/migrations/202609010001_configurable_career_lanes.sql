-- Database-backed career-lane and scraper configuration.
-- The legacy jobs.archetype column is intentionally not rewritten.

-- init.sql may already have created these names as ordinary columns, causing
-- the earlier ADD COLUMN IF NOT EXISTS generated definitions to be skipped.
-- Trigger-maintaining only ordinary columns preserves column OIDs, indexes,
-- views, and RPC dependencies. Already-generated columns keep their expressions.
create or replace function public.maintain_job_location_province_code()
returns trigger language plpgsql set search_path = '' as $$ begin
  new.location_province_code := public.classify_job_location_province(new.location);
  return new;
end $$;
create or replace function public.maintain_job_location_scope()
returns trigger language plpgsql set search_path = '' as $$ begin
  new.location_scope := public.classify_job_location_scope(new.location);
  return new;
end $$;
create or replace function public.maintain_job_location_metro()
returns trigger language plpgsql set search_path = '' as $$ begin
  new.location_metro := public.classify_job_location_metro(new.location);
  return new;
end $$;
create or replace function public.maintain_job_listing_location_province_codes()
returns trigger language plpgsql set search_path = '' as $$ begin
  new.listing_location_province_codes := public.job_listing_location_province_codes(new.listing_instances);
  return new;
end $$;
create or replace function public.maintain_job_listing_location_scopes()
returns trigger language plpgsql set search_path = '' as $$ begin
  new.listing_location_scopes := public.job_listing_location_scopes(new.listing_instances);
  return new;
end $$;

do $$
declare
  facet record;
  generation_kind "char";
begin
  for facet in
    select * from (values
      ('location_province_code', 'location', 'public.classify_job_location_province(location)', 'public.maintain_job_location_province_code'),
      ('location_scope', 'location', 'public.classify_job_location_scope(location)', 'public.maintain_job_location_scope'),
      ('location_metro', 'location', 'public.classify_job_location_metro(location)', 'public.maintain_job_location_metro'),
      ('listing_location_province_codes', 'listing_instances', 'public.job_listing_location_province_codes(listing_instances)', 'public.maintain_job_listing_location_province_codes'),
      ('listing_location_scopes', 'listing_instances', 'public.job_listing_location_scopes(listing_instances)', 'public.maintain_job_listing_location_scopes')
    ) as facets(column_name, source_column, expression_sql, function_name)
  loop
    execute pg_catalog.format('drop trigger if exists %I on public.jobs', 'maintain_jobs_' || facet.column_name);
    select a.attgenerated into generation_kind
    from pg_catalog.pg_attribute a
    join pg_catalog.pg_class c on c.oid = a.attrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'jobs'
      and a.attname = facet.column_name and a.attnum > 0 and not a.attisdropped;

    if generation_kind = '' then
      execute pg_catalog.format(
        'update public.jobs set %I = %s where %I is distinct from %s',
        facet.column_name, facet.expression_sql, facet.column_name, facet.expression_sql
      );
      execute pg_catalog.format(
        'create trigger %I before insert or update of %I on public.jobs for each row execute function %s()',
        'maintain_jobs_' || facet.column_name, facet.source_column, facet.function_name
      );
    end if;
  end loop;
end
$$;

create table if not exists public.career_lane_definitions (
  archetype text primary key check (archetype ~ '^[a-z][a-z0-9_]*$'),
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  description text not null default '',
  routing_guidance text not null default '',
  title_include text[] not null default '{}',
  title_exclude text[] not null default '{}',
  description_include text[] not null default '{}',
  description_exclude text[] not null default '{}',
  enabled boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.career_lane_aliases (
  alias text primary key check (alias ~ '^[a-z][a-z0-9_]*$'),
  archetype text not null references public.career_lane_definitions(archetype) on update cascade on delete cascade,
  created_at timestamptz not null default now(),
  check (alias <> archetype)
);

create table if not exists public.career_lane_search_queries (
  id bigint generated always as identity primary key,
  archetype text not null references public.career_lane_definitions(archetype) on update cascade on delete cascade,
  query text not null check (length(trim(query)) between 1 and 2000),
  query_type text not null check (query_type in ('precision', 'recall')),
  language text not null default 'en' check (language ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  sort_order integer not null default 0 check (sort_order >= 0),
  enabled boolean not null default true,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (archetype, query, language)
);
alter table public.career_lane_search_queries add column if not exists retired_at timestamptz;

create table if not exists public.career_lane_locations (
  archetype text not null references public.career_lane_definitions(archetype) on update cascade on delete cascade,
  geography text not null check (geography in ('canada', 'usa', 'eea')),
  enabled boolean not null default true,
  primary key (archetype, geography)
);

create table if not exists public.scrape_settings (
  singleton boolean primary key default true check (singleton),
  scraping_enabled boolean not null default true,
  lookback_days integer not null default 14 check (lookback_days between 1 and 365),
  max_jobs_per_query integer not null default 250 check (max_jobs_per_query between 1 and 10000),
  max_pages_per_query integer not null default 10 check (max_pages_per_query between 1 and 100),
  request_delay_ms integer not null default 1000 check (request_delay_ms between 0 and 60000),
  concurrent_queries integer not null default 3 check (concurrent_queries between 1 and 50),
  deduplicate_jobs boolean not null default true,
  fetch_descriptions boolean not null default true,
  score_jobs boolean not null default true,
  options jsonb not null default '{}'::jsonb check (jsonb_typeof(options) = 'object'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.career_lane_config_revisions (
  revision_id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  source text not null check (source in ('migration', 'admin_api', 'service')),
  configuration jsonb not null check (jsonb_typeof(configuration) = 'object'),
  created_at timestamptz not null default now()
);

create or replace function public.is_jsonb_object_array(p_value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_value) <> 'array' then false
    else not exists (
      select 1
      from jsonb_array_elements(p_value) as item(value)
      where jsonb_typeof(item.value) <> 'object'
    )
  end;
$$;

create table if not exists public.job_archetype_memberships (
  job_id text not null references public.jobs(job_id) on update cascade on delete cascade,
  archetype text not null references public.career_lane_definitions(archetype) on update cascade on delete cascade,
  matched_queries jsonb not null default '[]'::jsonb check (public.is_jsonb_object_array(matched_queries)),
  first_matched_at timestamptz not null default now(),
  last_matched_at timestamptz not null default now(),
  filter_status text not null default 'pending' check (filter_status in ('pending', 'included', 'filtered', 'review')),
  is_filtered boolean not null default false,
  filter_reason text,
  match_score numeric(6, 3) check (match_score is null or match_score between 0 and 100),
  score_stage text check (score_stage is null or score_stage in ('initial', 'custom')),
  analyzed_at timestamptz,
  insights_reanalyzed_at timestamptz,
  insights jsonb not null default '{}'::jsonb check (jsonb_typeof(insights) = 'object'),
  resume_state text not null default 'not_started' check (resume_state in ('not_started', 'queued', 'generating', 'ready', 'failed', 'stale')),
  resume_data jsonb not null default '{}'::jsonb check (jsonb_typeof(resume_data) = 'object'),
  customized_resume_id uuid,
  base_resume_id uuid,
  score_claimed_by text,
  score_claim_expires_at timestamptz,
  resume_claimed_by text,
  resume_claim_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (first_matched_at <= last_matched_at),
  primary key (job_id, archetype)
);

-- The resume tables predate migrations in this repository. Keep their existing
-- shape while adding lane identity to newly generated resumes.
alter table public.customized_resumes add column if not exists archetype text;
alter table public.customized_resumes add column if not exists base_resume_id uuid;
alter table public.customized_resumes add column if not exists job_id text;
drop index if exists public.customized_resumes_job_lane_unique_idx;
create index if not exists customized_resumes_job_lane_idx
  on public.customized_resumes (job_id, archetype) where job_id is not null and archetype is not null;
create unique index if not exists customized_resumes_identity_job_lane_idx
  on public.customized_resumes (id, job_id, archetype);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'customized_resumes_archetype_fkey') then
    alter table public.customized_resumes add constraint customized_resumes_archetype_fkey
      foreign key (archetype) references public.career_lane_definitions(archetype)
      on update cascade on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'customized_resumes_base_resume_id_fkey') then
    alter table public.customized_resumes add constraint customized_resumes_base_resume_id_fkey
      foreign key (base_resume_id) references public.base_resume(id)
      on update cascade on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'customized_resumes_job_id_fkey') then
    alter table public.customized_resumes add constraint customized_resumes_job_id_fkey
      foreign key (job_id) references public.jobs(job_id)
      on update cascade on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'job_archetype_memberships_customized_resume_id_fkey') then
    alter table public.job_archetype_memberships add constraint job_archetype_memberships_customized_resume_id_fkey
      foreign key (customized_resume_id) references public.customized_resumes(id)
      on update cascade on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'job_archetype_memberships_base_resume_id_fkey') then
    alter table public.job_archetype_memberships add constraint job_archetype_memberships_base_resume_id_fkey
      foreign key (base_resume_id) references public.base_resume(id)
      on update cascade on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'job_archetype_memberships_customized_resume_identity_fkey') then
    alter table public.job_archetype_memberships add constraint
      job_archetype_memberships_customized_resume_identity_fkey
      foreign key (customized_resume_id, job_id, archetype)
      references public.customized_resumes(id, job_id, archetype) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'customized_resumes_canonical_storage_path_check') then
    alter table public.customized_resumes add constraint customized_resumes_canonical_storage_path_check check (
      archetype is null or job_id is null or
      resume_link = archetype || '/' || job_id || '/' || id::text || '.pdf'
    ) not valid;
  end if;
end $$;

-- Only the transition lane projects membership state into singular jobs
-- columns. This trigger deliberately never changes jobs.archetype.
create or replace function public.project_technology_delivery_membership_state()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.archetype = 'technology_delivery' then
    update public.jobs set
      is_filtered = case when new.filter_status <> 'pending' then new.is_filtered else is_filtered end,
      filter_reason = case when new.filter_status <> 'pending' then new.filter_reason else filter_reason end,
      resume_score = case when new.match_score is not null then new.match_score else resume_score end,
      resume_score_stage = case when new.match_score is not null then new.score_stage else resume_score_stage end,
      insights_analyzed_at = coalesce(new.analyzed_at, insights_analyzed_at),
      insights_reanalyzed_at = coalesce(new.insights_reanalyzed_at, insights_reanalyzed_at),
      customized_resume_id = coalesce(new.customized_resume_id, customized_resume_id)
    where job_id = new.job_id
      and archetype in ('technology_delivery', 'software_tpm');
  end if;
  return new;
end;
$$;

drop trigger if exists project_technology_delivery_membership_state on public.job_archetype_memberships;
create trigger project_technology_delivery_membership_state
after insert or update of is_filtered, filter_reason, match_score, score_stage,
  analyzed_at, insights_reanalyzed_at, customized_resume_id
on public.job_archetype_memberships for each row
execute function public.project_technology_delivery_membership_state();
revoke all on function public.project_technology_delivery_membership_state() from public, anon, authenticated;

-- SQL-language function bodies resolve referenced relations when created.
create table if not exists public.archetype_resume_profiles (
  archetype text primary key references public.career_lane_definitions(archetype)
    on update cascade on delete cascade,
  base_resume_id uuid not null references public.base_resume(id)
    on update cascade on delete restrict,
  profile_data jsonb not null default '{}'::jsonb check (jsonb_typeof(profile_data) = 'object'),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Membership-filtered direct list/count reads return canonical IDs rather than
-- joining membership rows, so overlapping selected lanes cannot duplicate jobs.
create or replace function public.get_job_ids_by_membership_v1(
  p_kind text, p_provider text default null, p_levels text[] default null,
  p_archetypes text[] default null, p_interest text default null,
  p_application_status text default null, p_filter_status text default null,
  p_min_score numeric default null, p_max_score numeric default null,
  p_provinces text[] default null, p_location_scopes text[] default null,
  p_exclude_metros text[] default null, p_has_salary boolean default false,
  p_salary_min numeric default null, p_salary_max numeric default null,
  p_min_repost_count integer default null, p_min_seen_count integer default null,
  p_posted_after timestamptz default null, p_sort_by text default 'posted_at',
  p_sort_order text default 'desc', p_limit integer default 25, p_offset integer default 0
) returns table(job_id text, total_count bigint, row_number bigint)
language sql stable security invoker set search_path = '' as $$
  with matched as (
    select j.*,
      (select max(m.match_score) from public.job_archetype_memberships m
       where m.job_id = j.job_id and m.archetype = any(p_archetypes)
         and (p_min_score is null or m.match_score >= p_min_score)
         and (p_max_score is null or m.match_score <= p_max_score)
         and (p_filter_status in ('all','show_filtered')
           or (p_filter_status = 'entry_level' and m.is_filtered is true and m.filter_reason like 'title_entry_level:%')
           or (p_filter_status = 'filtered' and m.is_filtered is true)
           or (p_filter_status is null and (p_kind = 'all' or m.is_filtered is false))
           or (p_filter_status not in ('filtered','all','show_filtered','entry_level') and m.is_filtered is false))) as lane_score
    from public.jobs j
    where p_archetypes is not null
      and (p_kind = 'all' or (j.is_active is true and j.job_state = 'new'))
      and (((p_kind = 'applied') and (case when p_application_status is not null then j.status = p_application_status else j.status = any(array['applied','interviewing','offer']) end)) or (p_kind not in ('all','applied') and j.status = 'new') or p_kind = 'all')
      and (p_provider is null or j.provider = p_provider)
      and (p_levels is null or j.level = any(p_levels))
      and exists (
        select 1 from public.job_archetype_memberships m
        where m.job_id = j.job_id and m.archetype = any(p_archetypes)
          and (p_min_score is null or m.match_score >= p_min_score)
          and (p_max_score is null or m.match_score <= p_max_score)
          and (p_filter_status in ('all','show_filtered')
            or (p_filter_status = 'entry_level' and m.is_filtered is true and m.filter_reason like 'title_entry_level:%')
            or (p_filter_status = 'filtered' and m.is_filtered is true)
            or (p_filter_status is null and (p_kind = 'all' or m.is_filtered is false))
            or (p_filter_status not in ('filtered','all','show_filtered','entry_level') and m.is_filtered is false))
      )
      and (p_provinces is null or p_location_scopes is null or ('country' = any(p_location_scopes) and ('country' = j.location_scope or array['country'] && j.listing_location_scopes)) or (j.location_province_code = any(p_provinces) and j.location_scope = any(p_location_scopes)) or (p_provinces && j.listing_location_province_codes and p_location_scopes && j.listing_location_scopes))
      and (p_provinces is null or p_location_scopes is not null or j.location_province_code = any(p_provinces) or p_provinces && j.listing_location_province_codes)
      and (p_location_scopes is null or p_provinces is not null or j.location_scope = any(p_location_scopes) or p_location_scopes && j.listing_location_scopes)
      and (p_exclude_metros is null or j.location_metro is null or not (j.location_metro = any(p_exclude_metros)))
      and (case when p_interest = 'true' then j.is_interested is true when p_interest = 'false' then j.is_interested is false when p_interest = 'null' then j.is_interested is null when p_interest is null and p_kind = 'new' and p_filter_status is distinct from 'entry_level' then (j.is_interested is null or j.is_interested is true) else true end)
      and (not p_has_salary or j.salary_min is not null)
      and (p_salary_min is null or j.salary_min >= p_salary_min)
      and (p_salary_max is null or j.salary_min <= p_salary_max)
      and (p_min_repost_count is null or j.repost_count >= p_min_repost_count)
      and (p_min_seen_count is null or j.seen_count >= p_min_seen_count)
      and (p_posted_after is null or j.effective_posted_at >= p_posted_after)
  ), ranked as (
    select m.job_id, count(*) over()::bigint total_count,
      row_number() over(order by
        case when p_sort_by = 'resume_score' and p_sort_order = 'asc' then m.lane_score end asc nulls last,
        case when p_sort_by = 'resume_score' and p_sort_order <> 'asc' then m.lane_score end desc nulls last,
        case when p_sort_by = 'salary_min' and p_sort_order = 'asc' then m.salary_min end asc nulls last,
        case when p_sort_by = 'salary_min' and p_sort_order <> 'asc' then m.salary_min end desc nulls last,
        case when p_sort_by = 'application_date' and p_sort_order = 'asc' then m.application_date end asc nulls last,
        case when p_sort_by = 'application_date' and p_sort_order <> 'asc' then m.application_date end desc nulls last,
        case when p_sort_by = 'repost_count' and p_sort_order = 'asc' then m.repost_count end asc,
        case when p_sort_by = 'repost_count' and p_sort_order <> 'asc' then m.repost_count end desc,
        case when p_sort_by = 'seen_count' and p_sort_order = 'asc' then m.seen_count end asc,
        case when p_sort_by = 'seen_count' and p_sort_order <> 'asc' then m.seen_count end desc,
        case when p_sort_by not in ('resume_score','salary_min','application_date','repost_count','seen_count') and p_sort_order = 'asc' then m.effective_posted_at end asc nulls last,
        case when p_sort_by not in ('resume_score','salary_min','application_date','repost_count','seen_count') and p_sort_order <> 'asc' then m.effective_posted_at end desc nulls last,
        m.job_id asc) row_number
    from matched m
  ), page as (
    select r.job_id, r.total_count, r.row_number from ranked r
    where r.row_number > greatest(p_offset, 0)
      and r.row_number <= greatest(p_offset, 0) + least(greatest(p_limit, 0), 500)
  ), metadata as (
    select count(*)::bigint total_count from matched
  )
  select p.job_id, p.total_count, p.row_number from page p
  union all
  select null::text, m.total_count, null::bigint from metadata m
  where not exists (select 1 from page)
  order by row_number nulls last;
$$;

revoke all on function public.get_job_ids_by_membership_v1(text,text,text[],text[],text,text,text,numeric,numeric,text[],text[],text[],boolean,numeric,numeric,integer,integer,timestamptz,text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.get_job_ids_by_membership_v1(text,text,text[],text[],text,text,text,numeric,numeric,text[],text[],text[],boolean,numeric,numeric,integer,integer,timestamptz,text,text,integer,integer) to service_role;

-- Preserve the existing Boolean-search API and replace only lane predicates.
create or replace function public.search_job_ids_v1(
  p_search_ast jsonb, p_kind text, p_provider text default null, p_levels text[] default null,
  p_archetypes text[] default null, p_interest text default null, p_application_status text default null,
  p_filter_status text default null, p_min_score numeric default null, p_max_score numeric default null,
  p_provinces text[] default null, p_location_scopes text[] default null, p_exclude_metros text[] default null,
  p_has_salary boolean default false, p_salary_min numeric default null, p_salary_max numeric default null,
  p_min_repost_count integer default null, p_min_seen_count integer default null,
  p_posted_after timestamptz default null, p_sort_by text default 'posted_at', p_sort_order text default 'desc',
  p_limit integer default 25, p_offset integer default 0
) returns table(job_id text, total_count bigint, row_number bigint)
language sql stable security invoker set search_path = '' as $$
  with matched as (
    select j.*,
      case when p_archetypes is null then j.resume_score else
        (select max(m.match_score) from public.job_archetype_memberships m
         where m.job_id = j.job_id and m.archetype = any(p_archetypes)
           and (p_min_score is null or m.match_score >= p_min_score)
           and (p_max_score is null or m.match_score <= p_max_score)
           and (p_filter_status in ('all','show_filtered')
             or (p_filter_status = 'entry_level' and m.is_filtered is true and m.filter_reason like 'title_entry_level:%')
             or (p_filter_status = 'filtered' and m.is_filtered is true)
             or (p_filter_status is null and (p_kind = 'all' or m.is_filtered is false))
             or (p_filter_status not in ('filtered','all','show_filtered','entry_level') and m.is_filtered is false))) end as lane_score
    from public.jobs j
    where public.job_search_eval(j, p_search_ast)
      and (p_kind = 'all' or (j.is_active is true and j.job_state = 'new'))
      and (((p_kind = 'applied') and (case when p_application_status is not null then j.status = p_application_status else j.status = any(array['applied','interviewing','offer']) end)) or (p_kind not in ('all','applied') and j.status = 'new') or p_kind = 'all')
      and (p_provider is null or j.provider = p_provider) and (p_levels is null or j.level = any(p_levels))
      and ((p_archetypes is null and (p_min_score is null or j.resume_score >= p_min_score) and (p_max_score is null or j.resume_score <= p_max_score))
        or (p_archetypes is not null and exists (
          select 1 from public.job_archetype_memberships m
          where m.job_id = j.job_id and m.archetype = any(p_archetypes)
            and (p_min_score is null or m.match_score >= p_min_score)
            and (p_max_score is null or m.match_score <= p_max_score)
            and (p_filter_status in ('all','show_filtered')
              or (p_filter_status = 'entry_level' and m.is_filtered is true and m.filter_reason like 'title_entry_level:%')
              or (p_filter_status = 'filtered' and m.is_filtered is true)
              or (p_filter_status is null and (p_kind = 'all' or m.is_filtered is false))
              or (p_filter_status not in ('filtered','all','show_filtered','entry_level') and m.is_filtered is false)))))
      and (p_provinces is null or p_location_scopes is null or ('country' = any(p_location_scopes) and ('country' = j.location_scope or array['country'] && j.listing_location_scopes)) or (j.location_province_code = any(p_provinces) and j.location_scope = any(p_location_scopes)) or (p_provinces && j.listing_location_province_codes and p_location_scopes && j.listing_location_scopes))
      and (p_provinces is null or p_location_scopes is not null or j.location_province_code = any(p_provinces) or p_provinces && j.listing_location_province_codes)
      and (p_location_scopes is null or p_provinces is not null or j.location_scope = any(p_location_scopes) or p_location_scopes && j.listing_location_scopes)
      and (p_exclude_metros is null or j.location_metro is null or not (j.location_metro = any(p_exclude_metros)))
      and (case when p_interest = 'true' then j.is_interested is true when p_interest = 'false' then j.is_interested is false when p_interest = 'null' then j.is_interested is null when p_interest is null and p_kind = 'new' and p_filter_status is distinct from 'entry_level' then (j.is_interested is null or j.is_interested is true) else true end)
      and (p_archetypes is not null or p_filter_status is distinct from 'entry_level' or j.is_entry_level_filtered is true)
      and (p_archetypes is not null or p_filter_status is null or p_filter_status in ('all','show_filtered','entry_level') or (p_filter_status = 'filtered' and j.is_filtered is true) or (p_filter_status not in ('filtered','all','show_filtered','entry_level') and coalesce(j.is_filtered,false) is false))
      and (not p_has_salary or j.salary_min is not null) and (p_salary_min is null or j.salary_min >= p_salary_min) and (p_salary_max is null or j.salary_min <= p_salary_max)
      and (p_min_repost_count is null or j.repost_count >= p_min_repost_count) and (p_min_seen_count is null or j.seen_count >= p_min_seen_count)
      and (p_posted_after is null or j.effective_posted_at >= p_posted_after)
  ), ranked as (
    select m.job_id, count(*) over()::bigint total_count,
      row_number() over(order by
        case when p_sort_by = 'resume_score' and p_sort_order = 'asc' then m.lane_score end asc nulls last,
        case when p_sort_by = 'resume_score' and p_sort_order <> 'asc' then m.lane_score end desc nulls last,
        case when p_sort_by = 'salary_min' and p_sort_order = 'asc' then m.salary_min end asc nulls last,
        case when p_sort_by = 'salary_min' and p_sort_order <> 'asc' then m.salary_min end desc nulls last,
        case when p_sort_by = 'application_date' and p_sort_order = 'asc' then m.application_date end asc nulls last,
        case when p_sort_by = 'application_date' and p_sort_order <> 'asc' then m.application_date end desc nulls last,
        case when p_sort_by = 'repost_count' and p_sort_order = 'asc' then m.repost_count end asc,
        case when p_sort_by = 'repost_count' and p_sort_order <> 'asc' then m.repost_count end desc,
        case when p_sort_by = 'seen_count' and p_sort_order = 'asc' then m.seen_count end asc,
        case when p_sort_by = 'seen_count' and p_sort_order <> 'asc' then m.seen_count end desc,
        case when p_sort_by not in ('resume_score','salary_min','application_date','repost_count','seen_count') and p_sort_order = 'asc' then m.effective_posted_at end asc nulls last,
        case when p_sort_by not in ('resume_score','salary_min','application_date','repost_count','seen_count') and p_sort_order <> 'asc' then m.effective_posted_at end desc nulls last,
        m.job_id asc) row_number from matched m
  ), page as (
    select r.job_id, r.total_count, r.row_number from ranked r
    where r.row_number > greatest(p_offset,0) and r.row_number <= greatest(p_offset,0) + least(greatest(p_limit,0),500)
  ), metadata as (
    select count(*)::bigint total_count from matched
  )
  select p.job_id, p.total_count, p.row_number from page p
  union all
  select null::text, m.total_count, null::bigint from metadata m
  where not exists (select 1 from page)
  order by row_number nulls last;
$$;

revoke all on function public.search_job_ids_v1(jsonb,text,text,text[],text[],text,text,text,numeric,numeric,text[],text[],text[],boolean,numeric,numeric,integer,integer,timestamptz,text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.search_job_ids_v1(jsonb,text,text,text[],text[],text,text,text,numeric,numeric,text[],text[],text[],boolean,numeric,numeric,integer,integer,timestamptz,text,text,integer,integer) to service_role;

-- Hydration projection for lane-filtered lists and explicitly lane-scoped details.
-- Exactly one qualifying membership is returned per canonical job. For multiple
-- requested lanes, selection prefers highest match_score (NULL last), then the
-- configured lane sort_order, then archetype. This is also the state exposed by
-- the web row; jobs.* remains the global/technology-delivery compatibility view.
create or replace function public.get_job_membership_projection_v1(
  p_job_ids text[], p_archetypes text[], p_kind text default 'all',
  p_filter_status text default null, p_min_score numeric default null,
  p_max_score numeric default null
) returns table(
  job_id text, archetype text, resume_score numeric, resume_score_stage text,
  is_filtered boolean, filter_reason text, customized_resume_id uuid,
  resume_link text
)
language sql stable security invoker set search_path = '' as $$
  select ids.job_id, selected.archetype, selected.match_score,
    selected.score_stage, selected.is_filtered, selected.filter_reason,
    selected.customized_resume_id, cr.resume_link
  from unnest(p_job_ids) with ordinality as ids(job_id, ordinal)
  cross join lateral (
    select m.*
    from public.job_archetype_memberships m
    left join public.career_lane_definitions lane on lane.archetype = m.archetype
    where m.job_id = ids.job_id and m.archetype = any(p_archetypes)
      and (p_min_score is null or m.match_score >= p_min_score)
      and (p_max_score is null or m.match_score <= p_max_score)
      and (p_filter_status in ('all','show_filtered')
        or (p_filter_status = 'entry_level' and m.is_filtered is true and m.filter_reason like 'title_entry_level:%')
        or (p_filter_status = 'filtered' and m.is_filtered is true)
        or (p_filter_status is null and (p_kind = 'all' or m.is_filtered is false))
        or (p_filter_status not in ('filtered','all','show_filtered','entry_level') and m.is_filtered is false))
    order by m.match_score desc nulls last, lane.sort_order, m.archetype
    limit 1
  ) selected
  left join public.customized_resumes cr on cr.id = selected.customized_resume_id
  order by ids.ordinal;
$$;
revoke all on function public.get_job_membership_projection_v1(text[],text[],text,text,numeric,numeric) from public, anon, authenticated;
grant execute on function public.get_job_membership_projection_v1(text[],text[],text,text,numeric,numeric) to service_role;

create or replace function public.get_filtered_keyword_insights(
  p_providers text[] default null, p_archetypes text[] default null, p_levels text[] default null,
  p_filter_status text default null, p_companies text[] default null, p_job_titles text[] default null,
  p_provinces text[] default null, p_location_scopes text[] default null, p_exclude_metros text[] default null,
  p_category text default null, p_min_count integer default 2, p_limit integer default 1000, p_offset integer default 0
) returns table(keyword text, category text, count bigint, total_count bigint, last_updated timestamptz)
language sql stable security invoker set search_path = '' as $$
  with aggregated as (
    select jki.keyword, jki.category, count(distinct jki.job_id)::bigint as insight_count, max(jki.analyzed_at) last_updated
    from public.job_keyword_insights jki join public.jobs j on j.job_id = jki.job_id
    where j.is_active is true
      and (p_providers is null or j.provider = any(p_providers))
      and (p_archetypes is null or (jki.archetype = any(p_archetypes) and exists (
        select 1 from public.job_archetype_memberships m
        where m.job_id = j.job_id
          and (m.archetype = jki.archetype
            or (m.archetype = 'technology_delivery' and jki.archetype = 'software_tpm')
            or (m.archetype = 'technology_delivery' and jki.archetype = 'technology_delivery'))
          and (p_filter_status = 'all'
            or (p_filter_status = 'filtered' and m.is_filtered is true)
            or (p_filter_status = 'unfiltered' and m.is_filtered is false)
            or (p_filter_status = 'entry_level' and m.is_filtered is true
              and m.filter_reason like 'title_entry_level:%')))))
      and (p_archetypes is not null or p_filter_status is null or p_filter_status = 'all'
        or (p_filter_status = 'filtered' and j.is_filtered is true)
        or (p_filter_status = 'unfiltered' and coalesce(j.is_filtered,false) is false)
        or (p_filter_status = 'entry_level' and j.is_entry_level_filtered is true))
      and (p_levels is null or j.level = any(p_levels)) and (p_companies is null or j.company = any(p_companies))
      and (p_job_titles is null or j.job_title = any(p_job_titles)) and (p_category is null or jki.category = p_category)
      and (p_provinces is null or p_location_scopes is null or ('country' = any(p_location_scopes) and ('country' = j.location_scope or array['country'] && j.listing_location_scopes)) or (j.location_province_code = any(p_provinces) and j.location_scope = any(p_location_scopes)) or (p_provinces && j.listing_location_province_codes and p_location_scopes && j.listing_location_scopes))
      and (p_provinces is null or p_location_scopes is not null or j.location_province_code = any(p_provinces) or p_provinces && j.listing_location_province_codes)
      and (p_location_scopes is null or p_provinces is not null or j.location_scope = any(p_location_scopes) or p_location_scopes && j.listing_location_scopes)
      and (p_exclude_metros is null or j.location_metro is null or not (j.location_metro = any(p_exclude_metros)))
    group by jki.keyword, jki.category having count(distinct jki.job_id) >= greatest(p_min_count,0)
  ), ranked as (
    select a.*, count(*) over()::bigint total_count from aggregated a
  )
  select r.keyword, r.category, r.insight_count as count, r.total_count, r.last_updated from ranked r
  order by r.insight_count desc, r.keyword asc limit greatest(p_limit,0) offset greatest(p_offset,0);
$$;

revoke all on function public.get_filtered_keyword_insights(text[],text[],text[],text,text[],text[],text[],text[],text[],text,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.get_filtered_keyword_insights(text[],text[],text[],text,text[],text[],text[],text[],text[],text,integer,integer,integer) to service_role;

drop function if exists public.get_lane_jobs_to_score(text, integer);
create or replace function public.get_lane_jobs_to_score(
  p_archetype text, p_limit integer, p_worker_id text, p_lease_seconds integer default 900
)
returns table(job_id text, job_title text, company text, description text, level text, archetype text)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service_role required' using errcode = '42501'; end if;
  if nullif(pg_catalog.btrim(p_worker_id), '') is null then raise exception 'p_worker_id is required'; end if;
  return query
  with candidates as materialized (
    select m.job_id, m.archetype
    from public.job_archetype_memberships m join public.jobs j on j.job_id = m.job_id
    where m.archetype = p_archetype and m.is_filtered is false and m.match_score is null
      and j.is_active is true and j.description is not null
      and (m.score_claimed_by is null or m.score_claim_expires_at is null
        or m.score_claim_expires_at <= pg_catalog.clock_timestamp())
    order by j.scraped_at asc
    limit greatest(p_limit, 0) for update of m skip locked
  ), claimed as (
    update public.job_archetype_memberships m set
      score_claimed_by = p_worker_id,
      score_claim_expires_at = pg_catalog.clock_timestamp() + pg_catalog.make_interval(secs => least(greatest(p_lease_seconds, 30), 3600)),
      updated_at = pg_catalog.clock_timestamp()
    from candidates c where (m.job_id, m.archetype) = (c.job_id, c.archetype)
    returning m.job_id, m.archetype
  )
  select j.job_id, j.job_title, j.company, j.description, j.level, c.archetype
  from claimed c join public.jobs j on j.job_id = c.job_id order by j.scraped_at asc;
end;
$$;

create or replace function public.get_lane_jobs_for_analysis(
  p_archetype text, p_limit integer default 100, p_backfill_all boolean default false,
  p_replacement_backfill boolean default false
) returns table(job_id text, job_title text, description text, archetype text, provider text)
language sql stable security invoker set search_path = '' as $$
  select j.job_id, j.job_title, j.description, m.archetype, j.provider
  from public.job_archetype_memberships m join public.jobs j on j.job_id = m.job_id
  where m.archetype = p_archetype and m.is_filtered is false and j.description is not null
    and (p_backfill_all or (j.is_active is true and j.job_state = 'new'))
    and ((p_replacement_backfill and m.analyzed_at is not null and m.insights_reanalyzed_at is null)
      or (not p_replacement_backfill and m.analyzed_at is null))
  order by j.scraped_at asc limit greatest(p_limit,0);
$$;

drop function if exists public.get_lane_jobs_for_resume_generation(text, integer);
create or replace function public.get_lane_jobs_for_resume_generation(
  p_archetype text, p_limit integer, p_worker_id text, p_lease_seconds integer default 900
)
returns table(job_id text, job_title text, company text, description text, level text,
  archetype text, match_score numeric, base_resume_id uuid)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service_role required' using errcode = '42501'; end if;
  if nullif(pg_catalog.btrim(p_worker_id), '') is null then raise exception 'p_worker_id is required'; end if;
  return query
  with candidates as materialized (
    select m.job_id, m.archetype
    from public.job_archetype_memberships m join public.jobs j on j.job_id = m.job_id
    where m.archetype = p_archetype and m.is_filtered is false and m.match_score is not null
      and m.customized_resume_id is null and m.resume_state in ('not_started','queued','failed','stale')
      and j.is_active is true
      and (m.resume_claimed_by is null or m.resume_claim_expires_at is null
        or m.resume_claim_expires_at <= pg_catalog.clock_timestamp())
    order by m.match_score desc nulls last, j.effective_posted_at desc nulls last
    limit greatest(p_limit, 0) for update of m skip locked
  ), claimed as (
    update public.job_archetype_memberships m set
      resume_claimed_by = p_worker_id,
      resume_claim_expires_at = pg_catalog.clock_timestamp() + pg_catalog.make_interval(secs => least(greatest(p_lease_seconds, 30), 3600)),
      resume_state = 'generating', updated_at = pg_catalog.clock_timestamp()
    from candidates c where (m.job_id, m.archetype) = (c.job_id, c.archetype)
    returning m.*
  )
  select j.job_id, j.job_title, j.company, j.description, j.level, c.archetype,
    c.match_score, coalesce(c.base_resume_id, arp.base_resume_id)
  from claimed c join public.jobs j on j.job_id = c.job_id
  left join public.archetype_resume_profiles arp on arp.archetype = c.archetype and arp.enabled is true
  order by c.match_score desc nulls last, j.effective_posted_at desc nulls last;
end;
$$;

create or replace function public.complete_lane_score_claim(
  p_job_id text, p_archetype text, p_worker_id text, p_score numeric, p_score_stage text default 'initial'
) returns boolean language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role required' using errcode = '42501'; end if;
  if p_score < 0 or p_score > 100 or p_score_stage not in ('initial','custom') then raise exception 'invalid score completion'; end if;
  update public.job_archetype_memberships set match_score = p_score, score_stage = p_score_stage,
    score_claimed_by = null, score_claim_expires_at = null, updated_at = pg_catalog.clock_timestamp()
  where job_id = p_job_id and archetype = p_archetype and score_claimed_by = p_worker_id;
  get diagnostics affected = row_count; return affected = 1;
end; $$;

create or replace function public.release_lane_score_claim(
  p_job_id text, p_archetype text, p_worker_id text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role required' using errcode = '42501'; end if;
  update public.job_archetype_memberships set score_claimed_by = null, score_claim_expires_at = null,
    updated_at = pg_catalog.clock_timestamp()
  where job_id = p_job_id and archetype = p_archetype and score_claimed_by = p_worker_id;
  get diagnostics affected = row_count; return affected = 1;
end; $$;

create or replace function public.fail_lane_score_claim(
  p_job_id text, p_archetype text, p_worker_id text
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service_role required' using errcode = '42501'; end if;
  return public.release_lane_score_claim(p_job_id, p_archetype, p_worker_id);
end; $$;

create or replace function public.complete_lane_resume_claim(
  p_job_id text, p_archetype text, p_worker_id text, p_customized_resume_id uuid, p_base_resume_id uuid default null
) returns boolean language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role required' using errcode = '42501'; end if;
  update public.job_archetype_memberships set customized_resume_id = p_customized_resume_id,
    base_resume_id = coalesce(p_base_resume_id, base_resume_id), resume_state = 'ready',
    resume_claimed_by = null, resume_claim_expires_at = null, updated_at = pg_catalog.clock_timestamp()
  where job_id = p_job_id and archetype = p_archetype and resume_claimed_by = p_worker_id;
  get diagnostics affected = row_count; return affected = 1;
end; $$;

create or replace function public.release_lane_resume_claim(
  p_job_id text, p_archetype text, p_worker_id text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role required' using errcode = '42501'; end if;
  update public.job_archetype_memberships set resume_state = 'queued', resume_claimed_by = null,
    resume_claim_expires_at = null, updated_at = pg_catalog.clock_timestamp()
  where job_id = p_job_id and archetype = p_archetype and resume_claimed_by = p_worker_id;
  get diagnostics affected = row_count; return affected = 1;
end; $$;

create or replace function public.fail_lane_resume_claim(
  p_job_id text, p_archetype text, p_worker_id text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role required' using errcode = '42501'; end if;
  update public.job_archetype_memberships set resume_state = 'failed', resume_claimed_by = null,
    resume_claim_expires_at = null, updated_at = pg_catalog.clock_timestamp()
  where job_id = p_job_id and archetype = p_archetype and resume_claimed_by = p_worker_id;
  get diagnostics affected = row_count; return affected = 1;
end; $$;

drop function if exists public.get_lane_jobs_for_rescore(text, integer);
create or replace function public.get_lane_jobs_for_rescore(
  p_archetype text, p_limit integer, p_worker_id text, p_lease_seconds integer default 900
)
returns table(
  job_id text, job_title text, company text, description text, level text,
  resume_score numeric, resume_link text, customized_resume_id uuid, archetype text
)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service_role required' using errcode = '42501'; end if;
  if nullif(pg_catalog.btrim(p_worker_id), '') is null then raise exception 'p_worker_id is required'; end if;
  return query
  with candidates as materialized (
    select m.job_id, m.archetype
    from public.job_archetype_memberships m join public.jobs j on j.job_id = m.job_id
    where m.archetype = p_archetype and j.is_active is true
      and m.customized_resume_id is not null and m.score_stage = 'initial'
      and (m.score_claimed_by is null or m.score_claim_expires_at is null
        or m.score_claim_expires_at <= pg_catalog.clock_timestamp())
    order by m.match_score desc nulls last, j.job_id
    limit greatest(p_limit, 0) for update of m skip locked
  ), claimed as (
    update public.job_archetype_memberships m set
      score_claimed_by = p_worker_id,
      score_claim_expires_at = pg_catalog.clock_timestamp() + pg_catalog.make_interval(secs => least(greatest(p_lease_seconds, 30), 3600)),
      updated_at = pg_catalog.clock_timestamp()
    from candidates c where (m.job_id, m.archetype) = (c.job_id, c.archetype)
    returning m.*
  )
  select j.job_id, j.job_title, j.company, j.description, j.level,
    c.match_score, cr.resume_link, c.customized_resume_id, c.archetype
  from claimed c join public.jobs j on j.job_id = c.job_id
  join public.customized_resumes cr on cr.id = c.customized_resume_id
  order by c.match_score desc nulls last, j.job_id;
end;
$$;

revoke all on function public.get_lane_jobs_to_score(text,integer,text,integer) from public, anon, authenticated;
revoke all on function public.get_lane_jobs_for_analysis(text,integer,boolean,boolean) from public, anon, authenticated;
revoke all on function public.get_lane_jobs_for_resume_generation(text,integer,text,integer) from public, anon, authenticated;
revoke all on function public.get_lane_jobs_for_rescore(text,integer,text,integer) from public, anon, authenticated;
grant execute on function public.get_lane_jobs_to_score(text,integer,text,integer) to service_role;
grant execute on function public.get_lane_jobs_for_analysis(text,integer,boolean,boolean) to service_role;
grant execute on function public.get_lane_jobs_for_resume_generation(text,integer,text,integer) to service_role;
grant execute on function public.get_lane_jobs_for_rescore(text,integer,text,integer) to service_role;
revoke all on function public.complete_lane_score_claim(text,text,text,numeric,text) from public, anon, authenticated;
revoke all on function public.release_lane_score_claim(text,text,text) from public, anon, authenticated;
revoke all on function public.fail_lane_score_claim(text,text,text) from public, anon, authenticated;
revoke all on function public.complete_lane_resume_claim(text,text,text,uuid,uuid) from public, anon, authenticated;
revoke all on function public.release_lane_resume_claim(text,text,text) from public, anon, authenticated;
revoke all on function public.fail_lane_resume_claim(text,text,text) from public, anon, authenticated;
grant execute on function public.complete_lane_score_claim(text,text,text,numeric,text) to service_role;
grant execute on function public.release_lane_score_claim(text,text,text) to service_role;
grant execute on function public.fail_lane_score_claim(text,text,text) to service_role;
grant execute on function public.complete_lane_resume_claim(text,text,text,uuid,uuid) to service_role;
grant execute on function public.release_lane_resume_claim(text,text,text) to service_role;
grant execute on function public.fail_lane_resume_claim(text,text,text) to service_role;

create index if not exists career_lane_search_queries_lane_order_idx
  on public.career_lane_search_queries (archetype, enabled, sort_order, id);
create index if not exists job_archetype_memberships_lane_score_idx
  on public.job_archetype_memberships (archetype, is_filtered, match_score desc nulls last);
create index if not exists job_archetype_memberships_score_claim_idx
  on public.job_archetype_memberships (archetype, score_claim_expires_at) where match_score is null;
create index if not exists job_archetype_memberships_resume_claim_idx
  on public.job_archetype_memberships (archetype, resume_claim_expires_at) where customized_resume_id is null;
create index if not exists job_archetype_memberships_lane_last_match_idx
  on public.job_archetype_memberships (archetype, last_matched_at desc);
create index if not exists job_archetype_memberships_matched_queries_idx
  on public.job_archetype_memberships using gin (matched_queries jsonb_path_ops);

create or replace function public.record_job_archetype_membership(
  p_job_id text,
  p_archetype text,
  p_query_scope jsonb,
  p_query_id text default null,
  p_query text default null,
  p_query_type text default null,
  p_language text default null,
  p_location_scope text default null,
  p_geography_id text default null,
  p_first_matched_at timestamptz default now(),
  p_last_matched_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  provenance jsonb;
  result jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if p_job_id is null or trim(p_job_id) = '' then
    raise exception 'p_job_id must be non-empty';
  end if;
  if p_archetype is null or trim(p_archetype) = '' then
    raise exception 'p_archetype must be non-empty';
  end if;
  if coalesce(jsonb_typeof(p_query_scope), 'null') <> 'object' then
    raise exception 'p_query_scope must be a JSON object';
  end if;
  if p_query_type is not null and p_query_type not in ('precision', 'recall') then
    raise exception 'p_query_type must be precision or recall';
  end if;
  if p_language is not null and p_language !~ '^[a-z]{2}(-[A-Z]{2})?$' then
    raise exception 'p_language is invalid';
  end if;
  if p_first_matched_at is null or p_last_matched_at is null or p_first_matched_at > p_last_matched_at then
    raise exception 'membership timestamps are invalid';
  end if;

  provenance := jsonb_strip_nulls(
    coalesce(p_query_scope, '{}'::jsonb)
    || jsonb_build_object(
      'lane', p_archetype,
      'archetype', p_archetype,
      'query_id', coalesce(p_query_id, p_query_scope->>'query_id'),
      'query', coalesce(p_query, p_query_scope->>'query', p_query_scope->>'search_query'),
      'query_type', coalesce(p_query_type, p_query_scope->>'query_type', p_query_scope->>'query_kind'),
      'language', coalesce(p_language, p_query_scope->>'language'),
      'location_scope', coalesce(p_location_scope, p_query_scope->>'location_scope'),
      'geography_id', coalesce(p_geography_id, p_query_scope->>'geography_id')
    )
  );

  insert into public.job_archetype_memberships as membership (
    job_id, archetype, matched_queries, first_matched_at, last_matched_at, insights
  ) values (
    p_job_id,
    p_archetype,
    jsonb_build_array(provenance),
    p_first_matched_at,
    p_last_matched_at,
    jsonb_build_object(
      'matched_queries', jsonb_build_array(provenance),
      'matched_query_provenance', jsonb_build_array(provenance),
      'query_scopes', jsonb_build_array(provenance),
      'last_matched_at', to_jsonb(p_last_matched_at)
    )
  )
  on conflict (job_id, archetype) do update set
    matched_queries = (
      select coalesce(jsonb_agg(item.value order by item.value::text), '[]'::jsonb)
      from (
        select distinct value
        from jsonb_array_elements(membership.matched_queries || excluded.matched_queries)
      ) as item
    ),
    first_matched_at = least(membership.first_matched_at, excluded.first_matched_at),
    last_matched_at = greatest(membership.last_matched_at, excluded.last_matched_at),
    insights = membership.insights || jsonb_build_object(
      'matched_queries', (
        select coalesce(jsonb_agg(item.value order by item.value::text), '[]'::jsonb)
        from (
          select distinct value
          from jsonb_array_elements(membership.matched_queries || excluded.matched_queries)
        ) as item
      ),
      'matched_query_provenance', (
        select coalesce(jsonb_agg(item.value order by item.value::text), '[]'::jsonb)
        from (
          select distinct value
          from jsonb_array_elements(membership.matched_queries || excluded.matched_queries)
        ) as item
      ),
      'query_scopes', (
        select coalesce(jsonb_agg(item.value order by item.value::text), '[]'::jsonb)
        from (
          select distinct value
          from jsonb_array_elements(membership.matched_queries || excluded.matched_queries)
        ) as item
      ),
      'last_matched_at', to_jsonb(greatest(membership.last_matched_at, excluded.last_matched_at))
    ),
    updated_at = now()
  returning to_jsonb(membership.*) into result;

  return result;
end;
$$;

alter table public.career_lane_definitions enable row level security;
alter table public.career_lane_aliases enable row level security;
alter table public.career_lane_search_queries enable row level security;
alter table public.career_lane_locations enable row level security;
alter table public.scrape_settings enable row level security;
alter table public.career_lane_config_revisions enable row level security;
alter table public.job_archetype_memberships enable row level security;
alter table public.archetype_resume_profiles enable row level security;

revoke all on public.career_lane_definitions from public, anon, authenticated;
revoke all on public.career_lane_aliases from public, anon, authenticated;
revoke all on public.career_lane_search_queries from public, anon, authenticated;
revoke all on public.career_lane_locations from public, anon, authenticated;
revoke all on public.scrape_settings from public, anon, authenticated;
revoke all on public.career_lane_config_revisions from public, anon, authenticated;
revoke all on public.job_archetype_memberships from public, anon, authenticated;
revoke all on public.archetype_resume_profiles from public, anon, authenticated;
revoke all on function public.is_jsonb_object_array(jsonb) from public, anon, authenticated;
revoke all on function public.record_job_archetype_membership(text, text, jsonb, text, text, text, text, text, text, timestamptz, timestamptz) from public, anon, authenticated;

grant select, insert, update, delete on public.career_lane_definitions to service_role;
grant select, insert, update, delete on public.archetype_resume_profiles to service_role;
grant select, insert, update, delete on public.career_lane_aliases to service_role;
grant select, insert, update, delete on public.career_lane_search_queries to service_role;
grant select, insert, update, delete on public.career_lane_locations to service_role;
grant select, insert, update, delete on public.scrape_settings to service_role;
grant select, insert on public.career_lane_config_revisions to service_role;
grant select, insert, update, delete on public.job_archetype_memberships to service_role;
grant execute on function public.is_jsonb_object_array(jsonb) to service_role;
grant execute on function public.record_job_archetype_membership(text, text, jsonb, text, text, text, text, text, text, timestamptz, timestamptz) to service_role;
grant usage, select on sequence public.career_lane_search_queries_id_seq to service_role;
grant usage, select on sequence public.career_lane_config_revisions_revision_id_seq to service_role;

insert into public.career_lane_definitions
  (archetype, display_name, description, routing_guidance, title_include, title_exclude, description_include, description_exclude, sort_order)
values
  ('technology_delivery', 'Technology Delivery', 'Technology project, program, delivery, and implementation management.', 'Use when schedule, budget, risk, vendors, governance, stakeholders, or cross-functional delivery is the primary accountability.', array['project manager','program manager','delivery manager','implementation manager','chef de projet','gestionnaire de projet'], array['construction','civil','land development','clinical'], array['implementation','transformation','roadmap','governance','stakeholder','vendor','risk','budget','enterprise systems'], array['marketing operations','sales operations','product manager','scrum master'], 10),
  ('systems_platform_ops', 'Systems & Platform Operations', 'Systems, compute, virtualization, identity, storage, operating-system, and container-platform operations.', 'Use when operating infrastructure is primary; connectivity-first roles belong in network infrastructure.', array['systems administrator','system administrator','infrastructure engineer','virtualization engineer','platform operations'], array['backend engineer','full stack','product manager','sales engineer'], array['VMware','vSphere','ESXi','Active Directory','Linux','Windows Server','storage','backup','Kubernetes','OpenShift'], array['data platform','ML platform'], 20),
  ('network_infrastructure', 'Network Infrastructure', 'Routing, switching, wireless, WAN/VPN, firewall, network operations, and NOC work.', 'Use when connectivity, topology, or network availability dominates.', array['network engineer','network administrator','network operations','network infrastructure','NOC engineer'], array['network software','telecom sales','product manager'], array['Cisco','Aruba','Juniper','Meraki','routing','switching','WAN','VPN','firewall','wireless'], array['backend developer','full stack'], 30),
  ('datacenter_operations', 'Datacenter Operations', 'Physical datacenter, server-hardware, rack/stack, cabling, break/fix, deployment, and lifecycle work.', 'Use when hands-on facility or hardware operations dominate.', array['data center technician','datacenter technician','data center operations','hardware deployment'], array['data center sales','construction manager','software engineer'], array['rack','stack','cabling','server hardware','break/fix','asset lifecycle','smart hands'], array['real estate','facility design'], 40),
  ('ai_workflow_automation', 'AI Workflow Automation', 'Applied AI, LLM, agentic, and low-code workflow automation roles centered on business process outcomes.', 'Use when building and integrating AI-enabled workflows is primary, not ML research or platform ownership.', array['AI automation','workflow automation','AI solutions','agentic','LLM engineer','automation architect'], array['research scientist','data scientist','product manager'], array['LLM','RAG','agent','prompt','n8n','Zapier','Make.com','Power Automate','API integration','workflow'], array['model training','computer vision research'], 50),
  ('building_controls', 'Building Controls', 'Industrial and building controls, PLC/HMI/SCADA, BAS/BMS, commissioning, and controls integration.', 'Use when controls implementation, troubleshooting, or commissioning dominates.', array['controls engineer','controls specialist','automation engineer','BAS','BMS','SCADA','PLC'], array['software automation','QA automation','sales engineer'], array['PLC','HMI','SCADA','BACnet','Modbus','commissioning','control panel','building automation'], array['test automation','marketing automation'], 60)
on conflict (archetype) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  routing_guidance = excluded.routing_guidance,
  title_include = excluded.title_include,
  title_exclude = excluded.title_exclude,
  description_include = excluded.description_include,
  description_exclude = excluded.description_exclude,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.career_lane_aliases (alias, archetype)
values ('software_tpm', 'technology_delivery')
on conflict (alias) do update set archetype = excluded.archetype;

-- Seed the transition lane from the newest parsed resume when one exists.
-- Other enabled lanes may intentionally remain scrape-ready without profiles.
insert into public.archetype_resume_profiles (
  archetype, base_resume_id, profile_data, enabled, updated_at
)
select 'technology_delivery', b.id, '{}'::jsonb, true, now()
from public.base_resume b
order by coalesce(b.updated_at, b.created_at) desc nulls last, b.id desc
limit 1
on conflict (archetype) do update set
  base_resume_id = excluded.base_resume_id,
  enabled = true,
  updated_at = excluded.updated_at;

insert into public.career_lane_search_queries (archetype, query, query_type, language, sort_order)
values
  ('technology_delivery', '"Technical Project Manager"', 'precision', 'en', 10),
  ('technology_delivery', '"Technical Program Manager"', 'precision', 'en', 20),
  ('technology_delivery', '"IT Project Manager"', 'precision', 'en', 30),
  ('technology_delivery', '"Information Technology Project Manager"', 'precision', 'en', 40),
  ('technology_delivery', '"Technology Delivery Manager"', 'precision', 'en', 50),
  ('technology_delivery', '"gestionnaire de projet"', 'precision', 'fr', 60),
  ('technology_delivery', '"gestionnaire de programme"', 'precision', 'fr', 70),
  ('technology_delivery', '"chef de projet"', 'precision', 'fr', 80),
  ('technology_delivery', '"directeur de projet"', 'precision', 'fr', 90),
  ('technology_delivery', '("project manager" OR "program manager" OR "project delivery") AND (SaaS OR ERP OR cloud OR infrastructure OR security OR AI OR data)', 'recall', 'en', 100),
  ('systems_platform_ops', '"Systems Administrator"', 'precision', 'en', 10),
  ('systems_platform_ops', '"System Administrator"', 'precision', 'en', 20),
  ('systems_platform_ops', '"Infrastructure Engineer"', 'precision', 'en', 30),
  ('systems_platform_ops', '"VMware Administrator"', 'precision', 'en', 40),
  ('systems_platform_ops', '"Virtualization Engineer"', 'precision', 'en', 50),
  ('systems_platform_ops', '"Platform Operations Engineer"', 'precision', 'en', 60),
  ('systems_platform_ops', '(VMware OR vSphere OR ESXi OR virtualization OR Kubernetes OR OpenShift) AND (infrastructure OR operations OR administrator)', 'recall', 'en', 70),
  ('network_infrastructure', '"Network Engineer"', 'precision', 'en', 10),
  ('network_infrastructure', '"Network Administrator"', 'precision', 'en', 20),
  ('network_infrastructure', '"Network Operations Engineer"', 'precision', 'en', 30),
  ('network_infrastructure', '"Network Infrastructure Engineer"', 'precision', 'en', 40),
  ('network_infrastructure', '"NOC Engineer"', 'precision', 'en', 50),
  ('network_infrastructure', '(Cisco OR Aruba OR Juniper OR Meraki) AND (routing OR switching OR WAN OR VPN OR firewall OR wireless)', 'recall', 'en', 60),
  ('datacenter_operations', '"Data Center Technician"', 'precision', 'en', 10),
  ('datacenter_operations', '"Data Centre Technician"', 'precision', 'en', 20),
  ('datacenter_operations', '"Data Center Operations Technician"', 'precision', 'en', 30),
  ('datacenter_operations', '"Data Center Hardware Technician"', 'precision', 'en', 40),
  ('datacenter_operations', '("rack and stack" OR cabling OR "server hardware" OR "break fix") AND ("data center" OR datacenter)', 'recall', 'en', 50),
  ('ai_workflow_automation', '"AI Automation Engineer"', 'precision', 'en', 10),
  ('ai_workflow_automation', '"AI Workflow Engineer"', 'precision', 'en', 20),
  ('ai_workflow_automation', '"AI Solutions Engineer"', 'precision', 'en', 30),
  ('ai_workflow_automation', '"Agentic AI Engineer"', 'precision', 'en', 40),
  ('ai_workflow_automation', '"LLM Engineer"', 'precision', 'en', 50),
  ('ai_workflow_automation', '((LLM OR RAG OR agentic OR "generative AI") AND (workflow OR automation OR integration))', 'recall', 'en', 60),
  ('building_controls', '"Controls Engineer"', 'precision', 'en', 10),
  ('building_controls', '"Controls Specialist"', 'precision', 'en', 20),
  ('building_controls', '"Building Automation Specialist"', 'precision', 'en', 30),
  ('building_controls', '"BAS Technician"', 'precision', 'en', 40),
  ('building_controls', '"SCADA Engineer"', 'precision', 'en', 50),
  ('building_controls', '(PLC OR HMI OR SCADA OR BACnet OR Modbus) AND (controls OR automation OR commissioning)', 'recall', 'en', 60)
on conflict (archetype, query, language) do nothing;

insert into public.career_lane_locations (archetype, geography)
select archetype, 'canada' from public.career_lane_definitions
on conflict (archetype, geography) do nothing;

insert into public.scrape_settings (singleton) values (true)
on conflict (singleton) do nothing;

-- Canonical memberships coexist with untouched legacy jobs.archetype values.
insert into public.job_archetype_memberships
  (job_id, archetype, matched_queries, first_matched_at, last_matched_at,
   filter_status, is_filtered, filter_reason, match_score, score_stage,
   analyzed_at, insights_reanalyzed_at, insights, resume_state, customized_resume_id)
select
  j.job_id,
  case when j.archetype = 'software_tpm' then 'technology_delivery' else j.archetype end,
  '[]'::jsonb,
  coalesce(j.first_seen_at, j.scraped_at, now()),
  greatest(coalesce(j.last_seen_at, j.scraped_at, now()), coalesce(j.first_seen_at, j.scraped_at, now())),
  case when coalesce(j.is_filtered, false) then 'filtered' else 'included' end,
  coalesce(j.is_filtered, false),
  j.filter_reason,
  case when j.resume_score is null then null else least(100, greatest(0, j.resume_score)) end,
  j.resume_score_stage,
  j.insights_analyzed_at,
  j.insights_reanalyzed_at,
  '{}'::jsonb,
  case
    when exists (
      select 1
      from public.customized_resumes cr
      where cr.id = j.customized_resume_id
        and cr.job_id = j.job_id
        and cr.archetype = case
          when j.archetype = 'software_tpm' then 'technology_delivery'
          else j.archetype
        end
    ) then 'ready'
    else 'not_started'
  end,
  case
    when exists (
      select 1
      from public.customized_resumes cr
      where cr.id = j.customized_resume_id
        and cr.job_id = j.job_id
        and cr.archetype = case
          when j.archetype = 'software_tpm' then 'technology_delivery'
          else j.archetype
        end
    ) then j.customized_resume_id
    else null
  end
from public.jobs j
where j.archetype in ('software_tpm', 'technology_delivery', 'systems_platform_ops', 'network_infrastructure', 'datacenter_operations', 'ai_workflow_automation', 'building_controls')
on conflict (job_id, archetype) do nothing;

create or replace function public.get_scraper_configuration()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'version', 1,
    'revision', (select max(r.revision_id) from public.career_lane_config_revisions r),
    'aliases', coalesce((select jsonb_object_agg(a.alias, a.archetype) from public.career_lane_aliases a), '{}'::jsonb),
    'settings', coalesce((select to_jsonb(s) - 'singleton' - 'updated_by' from public.scrape_settings s where s.singleton), '{}'::jsonb),
    'lanes', coalesce((
      select jsonb_agg(
        (to_jsonb(l) - 'created_at' - 'updated_at') || jsonb_build_object(
          'resume_profile_ready', exists (
            select 1 from public.archetype_resume_profiles arp
            join public.base_resume br on br.id = arp.base_resume_id
            where arp.archetype = l.archetype and arp.enabled is true
          ),
          'locations', coalesce((select jsonb_agg(x.geography order by x.geography) from public.career_lane_locations x where x.archetype = l.archetype and x.enabled), '[]'::jsonb),
          'queries', coalesce((select jsonb_agg((to_jsonb(q) - 'id' - 'created_at' - 'updated_at' - 'retired_at') order by q.sort_order, q.id) from public.career_lane_search_queries q where q.archetype = l.archetype and q.retired_at is null), '[]'::jsonb)
        ) order by l.sort_order, l.archetype
      ) from public.career_lane_definitions l
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_scraper_configuration() from public, anon, authenticated;
grant execute on function public.get_scraper_configuration() to service_role;

drop function if exists public.replace_career_lane_configuration(jsonb, uuid, text);
create or replace function public.replace_career_lane_configuration(
  p_configuration jsonb,
  p_expected_revision bigint,
  p_actor_id uuid default null,
  p_actor_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  lane jsonb;
  search_query jsonb;
  geography_value text;
  settings_value jsonb;
  new_revision_id bigint;
  current_revision_id bigint;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('public.replace_career_lane_configuration', 0)
  );
  select max(revision_id) into current_revision_id from public.career_lane_config_revisions;
  if current_revision_id is distinct from p_expected_revision then
    raise exception using
      errcode = 'P0001',
      message = 'configuration_revision_conflict',
      detail = pg_catalog.format('Expected revision %s but current revision is %s',
        coalesce(p_expected_revision::text, 'null'), coalesce(current_revision_id::text, 'null'));
  end if;
  if jsonb_typeof(p_configuration->'lanes') <> 'array' or jsonb_array_length(p_configuration->'lanes') = 0 then
    raise exception 'configuration.lanes must be a non-empty array';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_configuration->'lanes') configured_lane
    where coalesce((configured_lane->>'enabled')::boolean, true)
      and not exists (
        select 1 from jsonb_array_elements(
          case when jsonb_typeof(configured_lane->'queries') = 'array'
            then configured_lane->'queries' else '[]'::jsonb end
        ) query
        where (query->>'enabled')::boolean is true
          and query->>'query_type' = 'precision'
      )
  ) then
    raise exception 'Each enabled lane must contain at least one enabled precision query';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_configuration->'lanes') configured_lane
    where coalesce((configured_lane->>'enabled')::boolean, true)
      and not exists (
        select 1 from jsonb_array_elements(
          case when jsonb_typeof(configured_lane->'queries') = 'array'
            then configured_lane->'queries' else '[]'::jsonb end
        ) query
        where (query->>'enabled')::boolean is true
          and query->>'query_type' = 'recall'
      )
  ) then
    raise exception 'Each enabled lane must contain at least one enabled recall query';
  end if;

  settings_value := coalesce(p_configuration->'settings', '{}'::jsonb);
  insert into public.scrape_settings (
    singleton, scraping_enabled, lookback_days, max_jobs_per_query, max_pages_per_query,
    request_delay_ms, concurrent_queries, deduplicate_jobs, fetch_descriptions,
    score_jobs, options, updated_at, updated_by
  ) values (
    true,
    coalesce((settings_value->>'scraping_enabled')::boolean, true),
    coalesce((settings_value->>'lookback_days')::integer, 14),
    coalesce((settings_value->>'max_jobs_per_query')::integer, 250),
    coalesce((settings_value->>'max_pages_per_query')::integer, 10),
    coalesce((settings_value->>'request_delay_ms')::integer, 1000),
    coalesce((settings_value->>'concurrent_queries')::integer, 3),
    coalesce((settings_value->>'deduplicate_jobs')::boolean, true),
    coalesce((settings_value->>'fetch_descriptions')::boolean, true),
    coalesce((settings_value->>'score_jobs')::boolean, true),
    coalesce(settings_value->'options', '{}'::jsonb),
    now(), p_actor_id
  ) on conflict (singleton) do update set
    scraping_enabled = excluded.scraping_enabled,
    lookback_days = excluded.lookback_days,
    max_jobs_per_query = excluded.max_jobs_per_query,
    max_pages_per_query = excluded.max_pages_per_query,
    request_delay_ms = excluded.request_delay_ms,
    concurrent_queries = excluded.concurrent_queries,
    deduplicate_jobs = excluded.deduplicate_jobs,
    fetch_descriptions = excluded.fetch_descriptions,
    score_jobs = excluded.score_jobs,
    options = excluded.options,
    updated_at = now(),
    updated_by = excluded.updated_by;

  for lane in select value from jsonb_array_elements(p_configuration->'lanes') loop
    if not exists (select 1 from public.career_lane_definitions d where d.archetype = lane->>'archetype') then
      raise exception 'Unknown canonical archetype: %', lane->>'archetype';
    end if;
    update public.career_lane_definitions set
      display_name = lane->>'display_name',
      description = coalesce(lane->>'description', ''),
      routing_guidance = coalesce(lane->>'routing_guidance', ''),
      title_include = coalesce(array(select jsonb_array_elements_text(lane->'title_include')), '{}'),
      title_exclude = coalesce(array(select jsonb_array_elements_text(lane->'title_exclude')), '{}'),
      description_include = coalesce(array(select jsonb_array_elements_text(lane->'description_include')), '{}'),
      description_exclude = coalesce(array(select jsonb_array_elements_text(lane->'description_exclude')), '{}'),
      enabled = coalesce((lane->>'enabled')::boolean, true),
      sort_order = coalesce((lane->>'sort_order')::integer, 0),
      updated_at = now()
    where archetype = lane->>'archetype';
  end loop;

  -- Build and validate a complete desired set before deleting stale rows.
  -- Upsert keeps stable query IDs for unchanged configuration and avoids FK
  -- breakage in tables that may reference those identities.
  create temporary table desired_lane_queries (
    archetype text not null, query text not null, query_type text not null,
    language text not null, sort_order integer not null, enabled boolean not null,
    primary key (archetype, query, language)
  ) on commit drop;
  create temporary table desired_lane_locations (
    archetype text not null, geography text not null,
    primary key (archetype, geography)
  ) on commit drop;
  for lane in select value from jsonb_array_elements(p_configuration->'lanes') loop
    for search_query in select value from jsonb_array_elements(coalesce(lane->'queries', '[]'::jsonb)) loop
      if search_query->>'archetype' is distinct from lane->>'archetype' then
        raise exception 'Query archetype must match parent lane %', lane->>'archetype';
      end if;
      insert into pg_temp.desired_lane_queries (archetype, query, query_type, language, sort_order, enabled)
      values (lane->>'archetype', search_query->>'query', search_query->>'query_type', coalesce(search_query->>'language', 'en'), coalesce((search_query->>'sort_order')::integer, 0), coalesce((search_query->>'enabled')::boolean, true));
    end loop;
    for geography_value in select value #>> '{}' from jsonb_array_elements(coalesce(lane->'locations', '[]'::jsonb)) loop
      insert into pg_temp.desired_lane_locations (archetype, geography) values (lane->>'archetype', geography_value);
    end loop;
  end loop;

  insert into public.career_lane_search_queries
    (archetype, query, query_type, language, sort_order, enabled)
  select archetype, query, query_type, language, sort_order, enabled
  from pg_temp.desired_lane_queries
  on conflict (archetype, query, language) do update set
    query_type = excluded.query_type, sort_order = excluded.sort_order,
    enabled = excluded.enabled, retired_at = null, updated_at = now();
  update public.career_lane_search_queries q
  set enabled = false, retired_at = now(), updated_at = now()
  where not exists (
    select 1 from pg_temp.desired_lane_queries d
    where (d.archetype, d.query, d.language) = (q.archetype, q.query, q.language)
  );

  insert into public.career_lane_locations (archetype, geography, enabled)
  select archetype, geography, true from pg_temp.desired_lane_locations
  on conflict (archetype, geography) do update set enabled = true;
  update public.career_lane_locations l set enabled = false
  where not exists (
    select 1 from pg_temp.desired_lane_locations d
    where (d.archetype, d.geography) = (l.archetype, l.geography)
  );

  insert into public.career_lane_config_revisions (actor_id, actor_email, source, configuration)
  values (p_actor_id, p_actor_email, 'admin_api', public.get_scraper_configuration())
  returning revision_id into new_revision_id;

  -- Capture the post-write document with the revision just allocated above.
  update public.career_lane_config_revisions
  set configuration = public.get_scraper_configuration()
  where revision_id = new_revision_id;

  return public.get_scraper_configuration();
end;
$$;

revoke all on function public.replace_career_lane_configuration(jsonb, bigint, uuid, text) from public, anon, authenticated;
grant execute on function public.replace_career_lane_configuration(jsonb, bigint, uuid, text) to service_role;

do $$
declare
  seed_revision_id bigint;
begin
  insert into public.career_lane_config_revisions (source, configuration)
  values ('migration', public.get_scraper_configuration())
  returning revision_id into seed_revision_id;

  update public.career_lane_config_revisions
  set configuration = public.get_scraper_configuration()
  where revision_id = seed_revision_id;
end;
$$;
