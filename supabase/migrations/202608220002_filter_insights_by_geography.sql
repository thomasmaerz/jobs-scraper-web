drop function if exists public.get_filtered_keyword_insights(text[], text[], text[], text, text[], text[], text, integer, integer, integer);

create function public.get_filtered_keyword_insights(
  p_providers text[] default null,
  p_archetypes text[] default null,
  p_levels text[] default null,
  p_filter_status text default null,
  p_companies text[] default null,
  p_job_titles text[] default null,
  p_provinces text[] default null,
  p_location_scopes text[] default null,
  p_exclude_metros text[] default null,
  p_category text default null,
  p_min_count integer default 2,
  p_limit integer default 1000,
  p_offset integer default 0
)
returns table (keyword text, category text, count bigint, total_count bigint, last_updated timestamptz)
language sql stable security invoker set search_path = '' as $$
  with aggregated as (
    select jki.keyword, jki.category, count(distinct jki.job_id)::bigint as count,
      max(jki.analyzed_at) as last_updated
    from public.job_keyword_insights as jki
    join public.jobs as j on j.job_id = jki.job_id
    where j.is_active is true
      and (p_providers is null or j.provider = any(p_providers))
      and (p_archetypes is null or j.archetype = any(p_archetypes))
      and (p_levels is null or j.level = any(p_levels))
      and (p_filter_status is null or p_filter_status = 'all'
        or (p_filter_status = 'filtered' and j.is_filtered is true)
        or (p_filter_status = 'unfiltered' and coalesce(j.is_filtered, false) is false)
        or (p_filter_status = 'entry_level' and j.is_entry_level_filtered is true))
      and (p_companies is null or j.company = any(p_companies))
      and (p_job_titles is null or j.job_title = any(p_job_titles))
      and (
        (p_provinces is null and p_location_scopes is null)
        or (p_provinces is null and j.location_scope = any(p_location_scopes))
        or (p_location_scopes is null and j.location_province_code = any(p_provinces))
        or ('country' = any(p_location_scopes) and j.location_scope = 'country')
        or (
          j.location_province_code = any(p_provinces)
          and j.location_scope = any(array_remove(p_location_scopes, 'country'))
        )
      )
      and (p_exclude_metros is null or j.location_metro is null or not (j.location_metro = any(p_exclude_metros)))
      and (p_category is null or p_category = 'all' or jki.category = p_category)
    group by jki.keyword, jki.category
    having count(distinct jki.job_id) >= greatest(coalesce(p_min_count, 2), 0)
  )
  select aggregated.keyword, aggregated.category, aggregated.count,
    count(*) over()::bigint, aggregated.last_updated
  from aggregated
  order by aggregated.count desc, aggregated.keyword asc, aggregated.category asc
  limit least(greatest(coalesce(p_limit, 1000), 1), 1000)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.get_filtered_keyword_insights(text[], text[], text[], text, text[], text[], text[], text[], text[], text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.get_filtered_keyword_insights(text[], text[], text[], text, text[], text[], text[], text[], text[], text, integer, integer, integer) to service_role;
