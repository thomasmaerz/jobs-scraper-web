create or replace function public.get_filtered_keyword_insights(
  p_providers text[] default null,
  p_archetypes text[] default null,
  p_levels text[] default null,
  p_filter_status text default null,
  p_companies text[] default null,
  p_job_titles text[] default null,
  p_category text default null,
  p_min_count integer default 2,
  p_limit integer default 1000,
  p_offset integer default 0
)
returns table (
  keyword text,
  category text,
  count bigint,
  total_count bigint,
  last_updated timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with aggregated as (
    select
      jki.keyword,
      jki.category,
      count(distinct jki.job_id)::bigint as count,
      max(jki.analyzed_at) as last_updated
    from public.job_keyword_insights as jki
    join public.jobs as j on j.job_id = jki.job_id
    where j.is_active is true
      and (p_providers is null or j.provider = any(p_providers))
      and (p_archetypes is null or j.archetype = any(p_archetypes))
      and (p_levels is null or j.level = any(p_levels))
      and (
        p_filter_status is null or p_filter_status = 'all'
        or (p_filter_status = 'filtered' and j.is_filtered is true)
        or (p_filter_status = 'unfiltered' and coalesce(j.is_filtered, false) is false)
        or (p_filter_status = 'entry_level' and j.is_entry_level_filtered is true)
      )
      and (p_companies is null or j.company = any(p_companies))
      and (p_job_titles is null or j.job_title = any(p_job_titles))
      and (p_category is null or p_category = 'all' or jki.category = p_category)
    group by jki.keyword, jki.category
    having count(distinct jki.job_id) >= greatest(coalesce(p_min_count, 2), 0)
  )
  select
    aggregated.keyword,
    aggregated.category,
    aggregated.count,
    count(*) over()::bigint as total_count,
    aggregated.last_updated
  from aggregated
  order by aggregated.count desc, aggregated.keyword asc, aggregated.category asc
  limit least(greatest(coalesce(p_limit, 1000), 1), 1000)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.search_job_filter_suggestions(
  p_field text,
  p_query text default '',
  p_limit integer default 20
)
returns table (value text)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  normalized_query text := left(trim(coalesce(p_query, '')), 100);
  result_limit integer := least(greatest(coalesce(p_limit, 5000), 1), 5000);
begin
  if p_field = 'company' then
    return query
      select distinct j.company
      from public.jobs as j
      where j.is_active is true
        and j.company is not null
        and (normalized_query = '' or j.company ilike '%' || normalized_query || '%')
      order by j.company
      limit result_limit;
  elsif p_field = 'jobTitle' then
    return query
      select distinct j.job_title
      from public.jobs as j
      where j.is_active is true
        and j.job_title is not null
        and (normalized_query = '' or j.job_title ilike '%' || normalized_query || '%')
      order by j.job_title
      limit result_limit;
  else
    raise exception 'Unsupported suggestion field' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.get_filtered_keyword_insights(text[], text[], text[], text, text[], text[], text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.get_filtered_keyword_insights(text[], text[], text[], text, text[], text[], text, integer, integer, integer) to service_role;
revoke all on function public.search_job_filter_suggestions(text, text, integer) from public, anon, authenticated;
grant execute on function public.search_job_filter_suggestions(text, text, integer) to service_role;
