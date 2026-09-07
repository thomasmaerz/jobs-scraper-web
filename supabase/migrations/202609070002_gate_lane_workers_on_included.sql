-- Keep review and pending memberships visible without spending downstream LLM work.

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
    where m.archetype = p_archetype and m.filter_status = 'included' and m.match_score is null
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
  from claimed c join public.jobs j on j.job_id = c.job_id;
end $$;

create or replace function public.get_lane_jobs_to_analyze(p_archetype text, p_limit integer)
returns setof public.jobs language sql security definer set search_path = '' as $$
  select j.* from public.jobs j join public.job_archetype_memberships m on m.job_id = j.job_id
  where m.archetype = p_archetype and m.filter_status = 'included' and j.description is not null
    and (m.insights->'keywords' is null or m.insights_reanalyzed_at is null)
  order by j.scraped_at asc limit greatest(p_limit,0)
$$;

create or replace function public.get_lane_jobs_for_custom_resume(
  p_archetype text, p_limit integer, p_min_score numeric default 70,
  p_worker_id text default null, p_lease_seconds integer default 900
)
returns table(job_id text, job_title text, company text, description text, level text, match_score numeric, archetype text)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service_role required' using errcode = '42501'; end if;
  if nullif(pg_catalog.btrim(p_worker_id), '') is null then raise exception 'p_worker_id is required'; end if;
  return query
  with candidates as materialized (
    select m.job_id, m.archetype
    from public.job_archetype_memberships m join public.jobs j on j.job_id = m.job_id
    where m.archetype = p_archetype and m.filter_status = 'included' and m.match_score is not null
      and m.match_score >= p_min_score and m.resume_state in ('not_started','failed','stale')
      and j.is_active is true
      and (m.resume_claimed_by is null or m.resume_claim_expires_at is null
        or m.resume_claim_expires_at <= pg_catalog.clock_timestamp())
    order by m.match_score desc, j.scraped_at asc
    limit greatest(p_limit,0) for update of m skip locked
  ), claimed as (
    update public.job_archetype_memberships m set
      resume_state = 'generating', resume_claimed_by = p_worker_id,
      resume_claim_expires_at = pg_catalog.clock_timestamp() + pg_catalog.make_interval(secs => least(greatest(p_lease_seconds,30),3600)),
      updated_at = pg_catalog.clock_timestamp()
    from candidates c where (m.job_id,m.archetype) = (c.job_id,c.archetype)
    returning m.job_id,m.archetype,m.match_score
  )
  select j.job_id,j.job_title,j.company,j.description,j.level,c.match_score,c.archetype
  from claimed c join public.jobs j on j.job_id = c.job_id;
end $$;

revoke all on function public.get_lane_jobs_to_score(text,integer,text,integer) from public, anon, authenticated;
revoke all on function public.get_lane_jobs_to_analyze(text,integer) from public, anon, authenticated;
revoke all on function public.get_lane_jobs_for_custom_resume(text,integer,numeric,text,integer) from public, anon, authenticated;
grant execute on function public.get_lane_jobs_to_score(text,integer,text,integer) to service_role;
grant execute on function public.get_lane_jobs_to_analyze(text,integer) to service_role;
grant execute on function public.get_lane_jobs_for_custom_resume(text,integer,numeric,text,integer) to service_role;
