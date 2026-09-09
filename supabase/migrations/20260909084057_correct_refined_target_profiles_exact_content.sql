-- The initial remote application accidentally made three existing creat(...) regex groups optional during transcription; restore the exact source profile text.
begin;

do $correction$
declare
  current_revision_id bigint;
  lane_exists boolean;
  replacement_count bigint;
  revision_snapshot_exists boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('public.replace_career_lane_configuration', 0)
  );

  select max(revision_id)
  into current_revision_id
  from public.career_lane_config_revisions;

  if current_revision_id is distinct from 10 then
    raise exception 'Expected configuration revision 10 but received %', current_revision_id;
  end if;

  select exists (
    select 1
    from public.career_lane_definitions
    where archetype = 'ai_workflow_automation'
  )
  into lane_exists;

  if not lane_exists then
    raise exception 'Missing career lane: ai_workflow_automation';
  end if;

  select exists (
    select 1
    from public.career_lane_config_revisions
    where revision_id = 10
      and source = 'migration'
      and actor_email = 'profile-refinement-2026-09-08'
  )
  into revision_snapshot_exists;

  if not revision_snapshot_exists then
    raise exception 'Missing configuration revision 10 snapshot';
  end if;

  select coalesce(
    sum(
      (length(value) - length(replace(value, 'creat(?:e|es|ed|ing)?', '')))
      / length('creat(?:e|es|ed|ing)?')
    ),
    0
  )
  into replacement_count
  from public.career_lane_definitions d
  cross join lateral unnest(d.description_include) value
  where d.archetype = 'ai_workflow_automation';

  if replacement_count = 0 then
    return;
  end if;

  if replacement_count <> 3 then
    raise exception 'Expected 0 or 3 exact-content corrections but found %', replacement_count;
  end if;

  update public.career_lane_definitions d
  set description_include = (
    select array_agg(replace(value, 'creat(?:e|es|ed|ing)?', 'creat(?:e|es|ed|ing)') order by ordinality)
    from unnest(d.description_include) with ordinality as u(value, ordinality)
  )
  where d.archetype = 'ai_workflow_automation';

  update public.career_lane_config_revisions
  set configuration = public.get_scraper_configuration()
  where revision_id = 10
    and source = 'migration'
    and actor_email = 'profile-refinement-2026-09-08';

  if not found then
    raise exception 'Missing configuration revision 10 snapshot';
  end if;
end
$correction$;

commit;
