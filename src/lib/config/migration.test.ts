import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../../../supabase/migrations/202609010001_configurable_career_lanes.sql", import.meta.url),
  "utf8",
);

test("career lane migration preserves legacy jobs while backfilling memberships", () => {
  assert.doesNotMatch(migration, /update\s+public\.jobs\s+set[\s\S]{0,500}archetype\s*=/i);
  assert.match(migration, /case when j\.archetype = 'software_tpm' then 'technology_delivery'/i);
  assert.match(migration, /primary key \(job_id, archetype\)/i);
  assert.match(migration, /where job_id = new\.job_id[\s\S]+archetype in \('technology_delivery', 'software_tpm'\)/i);
});

test("scraper configuration RPCs are restricted to service_role", () => {
  assert.match(
    migration,
    /revoke all on function public\.get_scraper_configuration\(\) from public, anon, authenticated;/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.get_scraper_configuration\(\) to service_role;/i,
  );
  assert.match(
    migration,
    /revoke all on function public\.replace_career_lane_configuration\(jsonb, bigint, uuid, text\) from public, anon, authenticated;/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.record_job_archetype_membership\([^)]+\) to service_role;/i,
  );
  assert.match(
    migration,
    /revoke all on function public\.record_job_archetype_membership\([^)]+\) from public, anon, authenticated;/i,
  );
  assert.match(
    migration,
    /revoke all on function public\.project_technology_delivery_membership_state\(\) from public, anon, authenticated;/i,
  );
  for (const signature of [
    "get_lane_jobs_to_score\\(text,integer,text,integer\\)",
    "get_lane_jobs_for_analysis\\(text,integer,boolean,boolean\\)",
    "get_lane_jobs_for_resume_generation\\(text,integer,text,integer\\)",
    "get_lane_jobs_for_rescore\\(text,integer,text,integer\\)",
  ]) {
    assert.match(
      migration,
      new RegExp(`revoke all on function public\\.${signature} from public, anon, authenticated;`, "i"),
    );
  }
});

test("configuration replacement serializes and rejects stale revisions before writes", () => {
  const replacement = migration.slice(migration.indexOf("create or replace function public.replace_career_lane_configuration"));
  assert.match(replacement, /p_expected_revision bigint/i);
  assert.match(replacement, /pg_advisory_xact_lock/i);
  assert.match(replacement, /select max\(revision_id\) into current_revision_id/i);
  assert.match(replacement, /current_revision_id is distinct from p_expected_revision/i);
  assert.match(replacement, /message = 'configuration_revision_conflict'/i);
  assert.ok(replacement.indexOf("configuration_revision_conflict") < replacement.indexOf("insert into public.scrape_settings"));
});

test("two sequential admins can save only from the current revision", () => {
  const canReplace = (expected: number | null, current: number | null) => expected === current;
  let currentRevision: number | null = 7;
  const adminARevision = currentRevision;
  const adminBRevision = currentRevision;

  assert.equal(canReplace(adminARevision, currentRevision), true);
  currentRevision = 8;
  assert.equal(canReplace(adminBRevision, currentRevision), false);
  assert.equal(canReplace(currentRevision, currentRevision), true);
  assert.equal(canReplace(null, null), true);
  assert.equal(canReplace(null, currentRevision), false);
});

test("two workers skip already claimed memberships and expired leases recover", () => {
  const scoringClaim = migration.slice(
    migration.indexOf("create or replace function public.get_lane_jobs_to_score"),
    migration.indexOf("create or replace function public.get_lane_jobs_for_analysis"),
  );
  const resumeClaim = migration.slice(
    migration.indexOf("create or replace function public.get_lane_jobs_for_resume_generation"),
    migration.indexOf("create or replace function public.complete_lane_score_claim"),
  );
  assert.match(scoringClaim, /score_claimed_by is null or m\.score_claim_expires_at is null\s+or m\.score_claim_expires_at <= pg_catalog\.clock_timestamp\(\)/i);
  assert.match(scoringClaim, /limit greatest\(p_limit, 0\) for update of m skip locked/i);
  assert.match(scoringClaim, /score_claimed_by = p_worker_id/i);
  assert.match(resumeClaim, /resume_claimed_by is null or m\.resume_claim_expires_at is null\s+or m\.resume_claim_expires_at <= pg_catalog\.clock_timestamp\(\)/i);
  assert.match(resumeClaim, /limit greatest\(p_limit, 0\) for update of m skip locked/i);
  assert.match(resumeClaim, /resume_claimed_by = p_worker_id/i);
});

test("score and resume completion/failure release only their independently owned claims", () => {
  assert.match(migration, /score_claimed_by text[\s\S]+resume_claimed_by text/i);
  assert.match(migration, /complete_lane_score_claim[\s\S]+score_claimed_by = null, score_claim_expires_at = null[\s\S]+score_claimed_by = p_worker_id/i);
  assert.match(migration, /fail_lane_score_claim[\s\S]+release_lane_score_claim\(p_job_id, p_archetype, p_worker_id\)/i);
  assert.match(migration, /complete_lane_resume_claim[\s\S]+resume_claimed_by = null, resume_claim_expires_at = null[\s\S]+resume_claimed_by = p_worker_id/i);
  assert.match(migration, /fail_lane_resume_claim[\s\S]+resume_state = 'failed'[\s\S]+resume_claimed_by = p_worker_id/i);
});

test("configuration RPC nests query archetype and returns the post-write document", () => {
  assert.match(migration, /to_jsonb\(q\) - 'id' - 'created_at' - 'updated_at'/i);
  assert.match(migration, /return public\.get_scraper_configuration\(\);/i);
  assert.match(migration, /returning revision_id into new_revision_id;/i);
  assert.match(migration, /set configuration = public\.get_scraper_configuration\(\)/i);
  assert.doesNotMatch(migration, /return\s+new_revision_id/i);
});

test("migration repairs ordinary geography columns without dropping dependencies", () => {
  for (const column of [
    "location_province_code",
    "location_scope",
    "location_metro",
    "listing_location_province_codes",
    "listing_location_scopes",
  ]) {
    assert.match(migration, new RegExp(`'${column}'`));
  }
  assert.match(migration, /attgenerated/i);
  assert.match(migration, /before insert or update of %I on public\.jobs/i);
  assert.match(migration, /update public\.jobs set %I = %s where %I is distinct from %s/i);
  assert.doesNotMatch(migration, /drop\s+column\s+(?:if\s+exists\s+)?(?:location_|listing_location_)/i);
});

test("server replacement requires precision and recall for every enabled lane", () => {
  assert.match(migration, /Each enabled lane must contain at least one enabled precision query/i);
  assert.match(migration, /Each enabled lane must contain at least one enabled recall query/i);
});

test("resume profile relation is created before functions reference it", () => {
  assert.ok(
    migration.indexOf("create table if not exists public.archetype_resume_profiles") <
      migration.indexOf("create or replace function public.get_lane_jobs_for_resume_generation"),
  );
});

test("technology delivery resume readiness is safely seeded without disabling lanes", () => {
  assert.match(
    migration,
    /insert into public\.archetype_resume_profiles[\s\S]+select 'technology_delivery', b\.id[\s\S]+from public\.base_resume b[\s\S]+order by coalesce\(b\.updated_at, b\.created_at\) desc nulls last, b\.id desc[\s\S]+limit 1[\s\S]+enabled = true/i,
  );
  assert.match(migration, /'resume_profile_ready', exists/i);
  assert.doesNotMatch(migration, /update public\.career_lane_definitions[\s\S]{0,200}enabled\s*=\s*false/i);
});

test("customized resume identity and storage path are lane isolated", () => {
  assert.match(migration, /customized_resumes_identity_job_lane_idx[\s\S]+\(id, job_id, archetype\)/i);
  assert.match(migration, /foreign key \(customized_resume_id, job_id, archetype\)[\s\S]+references public\.customized_resumes\(id, job_id, archetype\)/i);
  assert.match(migration, /resume_link = archetype \|\| '\/' \|\| job_id \|\| '\/' \|\| id::text \|\| '\.pdf'/i);
});

test("entry-level keyword insights use membership filter parity", () => {
  assert.match(
    migration,
    /p_filter_status = 'entry_level' and m\.is_filtered is true\s+and m\.filter_reason like 'title_entry_level:%'/i,
  );
  assert.doesNotMatch(
    migration,
    /p_filter_status in \('unfiltered','entry_level'\) and m\.is_filtered is false/i,
  );
});

test("security definer writers enforce service role and replacement avoids global pre-delete", () => {
  assert.ok((migration.match(/auth\.role\(\) <> 'service_role'/g) ?? []).length >= 8);
  assert.doesNotMatch(migration, /delete from public\.career_lane_(?:search_queries|locations)/i);
  assert.match(migration, /create temporary table desired_lane_queries/i);
  assert.match(migration, /on conflict \(archetype, query, language\) do update/i);
  assert.match(migration, /set enabled = false, retired_at = now\(\), updated_at = now\(\)/i);
  assert.match(migration, /pg_advisory_xact_lock/i);
});

test("membership filtering uses per-lane filter state", () => {
  assert.match(
    migration,
    /p_filter_status = 'entry_level' and m\.is_filtered is true and m\.filter_reason like 'title_entry_level:%'/i,
  );
  assert.match(
    migration,
    /p_filter_status is null and \(p_kind = 'all' or m\.is_filtered is false\)/i,
  );
  const membershipFunction = migration.slice(
    migration.indexOf("create or replace function public.get_job_ids_by_membership_v1"),
    migration.indexOf("revoke all on function public.get_job_ids_by_membership_v1"),
  );
  assert.doesNotMatch(membershipFunction, /j\.is_filtered|j\.is_entry_level_filtered/i);
  assert.match(
    migration,
    /p_filter_status not in \('filtered','all','show_filtered','entry_level'\) and m\.is_filtered is false/i,
  );
});

test("membership RPC atomically unions object provenance without replacing lane state", () => {
  assert.match(migration, /matched_queries jsonb not null default '\[\]'::jsonb/i);
  assert.match(migration, /check \(public\.is_jsonb_object_array\(matched_queries\)\)/i);
  assert.match(migration, /jsonb_array_elements\(membership\.matched_queries \|\| excluded\.matched_queries\)/i);
  assert.match(migration, /'matched_queries', jsonb_build_array\(provenance\)/i);
  assert.match(migration, /first_matched_at = least\(/i);
  assert.match(migration, /last_matched_at = greatest\(/i);
  assert.doesNotMatch(
    migration.match(/on conflict \(job_id, archetype\) do update set[\s\S]+?returning to_jsonb\(membership\.\*\)/i)?.[0] ?? "",
    /filter_status\s*=|is_filtered\s*=|match_score\s*=|resume_state\s*=/i,
  );
});

test("migration enables RLS and revokes public configuration table access", () => {
  for (const table of [
    "career_lane_definitions",
    "career_lane_search_queries",
    "career_lane_locations",
    "scrape_settings",
    "career_lane_config_revisions",
    "job_archetype_memberships",
  ]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    assert.match(migration, new RegExp(`revoke all on public\\.${table} from public, anon, authenticated`, "i"));
  }
});
