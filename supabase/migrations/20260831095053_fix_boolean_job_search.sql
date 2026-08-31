CREATE OR REPLACE FUNCTION public.search_job_ids_v1(
  p_search_ast jsonb, p_kind text, p_provider text DEFAULT NULL, p_levels text[] DEFAULT NULL,
  p_archetypes text[] DEFAULT NULL, p_interest text DEFAULT NULL, p_application_status text DEFAULT NULL,
  p_filter_status text DEFAULT NULL, p_min_score numeric DEFAULT NULL, p_max_score numeric DEFAULT NULL,
  p_provinces text[] DEFAULT NULL, p_location_scopes text[] DEFAULT NULL, p_exclude_metros text[] DEFAULT NULL,
  p_has_salary boolean DEFAULT false, p_salary_min numeric DEFAULT NULL, p_salary_max numeric DEFAULT NULL,
  p_min_repost_count integer DEFAULT NULL, p_min_seen_count integer DEFAULT NULL,
  p_posted_after timestamptz DEFAULT NULL, p_sort_by text DEFAULT 'posted_at', p_sort_order text DEFAULT 'desc',
  p_limit integer DEFAULT 25, p_offset integer DEFAULT 0
) RETURNS TABLE(job_id text, total_count bigint, row_number bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  WITH matched AS (
    SELECT j.* FROM public.jobs j
    WHERE public.job_search_eval(j, p_search_ast)
      AND (p_kind = 'all' OR (j.is_active IS TRUE AND j.job_state = 'new'))
      AND (((p_kind = 'applied') AND (CASE WHEN p_application_status IS NOT NULL THEN j.status = p_application_status ELSE j.status = ANY (ARRAY['applied','interviewing','offer']) END)) OR (p_kind NOT IN ('all','applied') AND j.status = 'new') OR p_kind = 'all')
      AND (p_min_score IS NULL OR j.resume_score >= p_min_score) AND (p_max_score IS NULL OR j.resume_score <= p_max_score)
      AND (p_provider IS NULL OR j.provider = p_provider) AND (p_levels IS NULL OR j.level = ANY(p_levels)) AND (p_archetypes IS NULL OR j.archetype = ANY(p_archetypes))
      AND (p_provinces IS NULL OR p_location_scopes IS NULL OR ('country' = ANY(p_location_scopes) AND ('country' = j.location_scope OR ARRAY['country'] && j.listing_location_scopes)) OR (j.location_province_code = ANY(p_provinces) AND j.location_scope = ANY(p_location_scopes)) OR (p_provinces && j.listing_location_province_codes AND p_location_scopes && j.listing_location_scopes))
      AND (p_provinces IS NULL OR p_location_scopes IS NOT NULL OR j.location_province_code = ANY(p_provinces) OR p_provinces && j.listing_location_province_codes)
      AND (p_location_scopes IS NULL OR p_provinces IS NOT NULL OR j.location_scope = ANY(p_location_scopes) OR p_location_scopes && j.listing_location_scopes)
      AND (p_exclude_metros IS NULL OR j.location_metro IS NULL OR NOT (j.location_metro = ANY(p_exclude_metros)))
      AND (CASE WHEN p_interest = 'true' THEN j.is_interested IS TRUE WHEN p_interest = 'false' THEN j.is_interested IS FALSE WHEN p_interest = 'null' THEN j.is_interested IS NULL WHEN p_kind = 'new' AND p_filter_status IS DISTINCT FROM 'entry_level' THEN j.is_interested IS NULL OR j.is_interested IS TRUE ELSE true END)
      AND (p_filter_status IS DISTINCT FROM 'entry_level' OR j.is_entry_level_filtered IS TRUE)
      AND (p_filter_status = 'entry_level' OR p_filter_status = 'show_filtered' OR p_kind = 'all' OR coalesce(j.is_filtered, false) IS FALSE)
      AND (NOT p_has_salary OR j.salary_min IS NOT NULL) AND (NOT p_has_salary OR p_salary_min IS NULL OR j.salary_min >= p_salary_min) AND (NOT p_has_salary OR p_salary_max IS NULL OR j.salary_min <= p_salary_max)
      AND (p_sort_by <> 'salary_min' OR j.salary_min <= 1000000) AND (p_min_repost_count IS NULL OR j.repost_count >= p_min_repost_count) AND (p_min_seen_count IS NULL OR j.seen_count >= p_min_seen_count)
      AND (p_posted_after IS NULL OR j.effective_posted_at >= p_posted_after)
  ), ranked AS (
    SELECT matched.job_id, row_number() OVER (ORDER BY
      CASE WHEN p_sort_by='posted_at' AND p_sort_order='asc' THEN effective_posted_at END ASC NULLS LAST,
      CASE WHEN p_sort_by='posted_at' AND p_sort_order='desc' THEN effective_posted_at END DESC NULLS LAST,
      CASE WHEN p_sort_by='resume_score' AND p_sort_order='asc' THEN resume_score END ASC, CASE WHEN p_sort_by='resume_score' AND p_sort_order='desc' THEN resume_score END DESC,
      CASE WHEN p_sort_by='application_date' AND p_sort_order='asc' THEN application_date END ASC, CASE WHEN p_sort_by='application_date' AND p_sort_order='desc' THEN application_date END DESC,
      CASE WHEN p_sort_by='salary_min' AND p_sort_order='asc' THEN salary_min END ASC NULLS LAST, CASE WHEN p_sort_by='salary_min' AND p_sort_order='desc' THEN salary_min END DESC NULLS LAST,
      CASE WHEN p_sort_by='repost_count' AND p_sort_order='asc' THEN repost_count END ASC, CASE WHEN p_sort_by='repost_count' AND p_sort_order='desc' THEN repost_count END DESC,
      CASE WHEN p_sort_by='seen_count' AND p_sort_order='asc' THEN seen_count END ASC, CASE WHEN p_sort_by='seen_count' AND p_sort_order='desc' THEN seen_count END DESC, job_id ASC) AS row_number
    FROM matched
  ), total AS (SELECT count(*)::bigint AS total_count FROM matched), paged AS (
    SELECT ranked.job_id, ranked.row_number FROM ranked
    WHERE ranked.row_number > greatest(p_offset,0) AND ranked.row_number <= greatest(p_offset,0)+least(greatest(p_limit,1),1000)
  )
  SELECT paged.job_id::text, total.total_count, paged.row_number FROM total LEFT JOIN paged ON true ORDER BY paged.row_number;
$$;
