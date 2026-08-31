CREATE OR REPLACE FUNCTION public.job_search_eval(
  p_job public.jobs,
  p_node jsonb
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_type text;
  v_term text;
  v_value boolean;
  v_child jsonb;
BEGIN
  IF p_node IS NULL OR jsonb_typeof(p_node) <> 'object' OR length(p_node::text) > 10000 THEN RETURN false; END IF;
  v_type := p_node->>'type';
  IF v_type = 'term' THEN
    v_term := p_node->>'term';
    IF v_term IS NULL OR length(v_term) = 0 OR length(v_term) > 200 THEN RETURN false; END IF;
    v_value := strpos(lower(concat_ws(' ', p_job.job_title, p_job.company, p_job.description)), lower(v_term)) > 0;
    RETURN CASE WHEN coalesce((p_node->>'negated')::boolean, false) THEN NOT v_value ELSE v_value END;
  ELSIF v_type = 'and' THEN
    IF jsonb_typeof(p_node->'children') <> 'array' OR jsonb_array_length(p_node->'children') = 0 THEN RETURN false; END IF;
    FOR v_child IN SELECT value FROM jsonb_array_elements(p_node->'children') LOOP
      IF NOT public.job_search_eval(p_job, v_child) THEN RETURN false; END IF;
    END LOOP;
    RETURN true;
  ELSIF v_type = 'or' THEN
    IF jsonb_typeof(p_node->'children') <> 'array' OR jsonb_array_length(p_node->'children') = 0 THEN RETURN false; END IF;
    FOR v_child IN SELECT value FROM jsonb_array_elements(p_node->'children') LOOP
      IF public.job_search_eval(p_job, v_child) THEN RETURN true; END IF;
    END LOOP;
    RETURN false;
  END IF;
  RETURN false;
END;
$$;
