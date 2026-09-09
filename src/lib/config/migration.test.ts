import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../../../supabase/migrations/202609010001_configurable_career_lanes.sql", import.meta.url),
  "utf8",
);
const discoveryMigration = readFileSync(
  new URL("../../../supabase/migrations/202609050001_resume_exhaustive_linkedin_discovery.sql", import.meta.url),
  "utf8",
);
const statusFixMigration = readFileSync(
  new URL("../../../supabase/migrations/202609060001_fix_linkedin_discovery_status.sql", import.meta.url),
  "utf8",
);
const sealedDrainMigration = readFileSync(
  new URL("../../../supabase/migrations/202609060002_drain_sealed_linkedin_discovery.sql", import.meta.url),
  "utf8",
);
const freehireBatchMigration = readFileSync(
  new URL("../../../supabase/migrations/202609060003_batch_freehire_compatibility.sql", import.meta.url),
  "utf8",
);
const freehireReclassificationMigration = readFileSync(
  new URL("../../../supabase/migrations/202609070001_allow_freehire_compatibility_reclassification.sql", import.meta.url),
  "utf8",
);
const laneWorkerGateMigration = readFileSync(
  new URL("../../../supabase/migrations/202609070002_gate_lane_workers_on_included.sql", import.meta.url),
  "utf8",
);
const queryNoiseMigration = readFileSync(
  new URL("../../../supabase/migrations/202609070003_reduce_linkedin_query_noise.sql", import.meta.url),
  "utf8",
);
const refinedProfilesMigration = readFileSync(
  new URL("../../../supabase/migrations/20260909083410_apply_refined_target_profiles.sql", import.meta.url),
  "utf8",
);
const refinedProfilesCorrectionMigration = readFileSync(
  new URL("../../../supabase/migrations/20260909084057_correct_refined_target_profiles_exact_content.sql", import.meta.url),
  "utf8",
);

function profileFilterHashes(sql: string, archetype: string) {
  const laneBlock = Array.from(
    sql.matchAll(
      /update\s+public\.career_lane_definitions\s+set([\s\S]*?)where archetype = '([^']+)';/gi,
    ),
  ).find((match) => match[2] === archetype);
  assert.ok(laneBlock);

  return Object.fromEntries(
    ["title_include", "title_exclude", "description_include", "description_exclude"].map(
      (filter) => {
        const assignment = new RegExp(
          `\\b${filter}\\s*=\\s*array\\[([\\s\\S]*?)\\]::text\\[\\]`,
          "i",
        ).exec(laneBlock[1]);
        assert.ok(assignment);
        const values = Array.from(
          assignment[1].matchAll(/\$([A-Za-z0-9_]+)\$([\s\S]*?)\$\1\$/g),
          (match) => match[2],
        );
        const postgresJson = `[${values.map((value) => JSON.stringify(value)).join(", ")}]`;

        return [
          filter,
          {
            count: values.length,
            md5: createHash("md5").update(postgresJson).digest("hex"),
          },
        ];
      },
    ),
  );
}

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

test("lane workers process only included memberships", () => {
  assert.equal(
    (laneWorkerGateMigration.match(/m\.filter_status = 'included'/g) ?? []).length,
    3,
  );
  assert.doesNotMatch(laneWorkerGateMigration, /m\.is_filtered is false/i);
  assert.match(
    laneWorkerGateMigration,
    /revoke all on function public\.get_lane_jobs_to_score\(text,integer,text,integer\) from public, anon, authenticated/i,
  );
});

test("relevance audit retires broad queries and stores the reduced set", () => {
  assert.match(
    queryNoiseMigration,
    /update public\.career_lane_search_queries\s+set enabled = false, retired_at = coalesce\(retired_at, now\(\)\)/i,
  );
  assert.equal(
    (queryNoiseMigration.match(/\('(?:technology_delivery|systems_platform_ops|network_infrastructure|datacenter_operations|ai_workflow_automation|building_controls)'\s*,/g) ?? []).length,
    13,
  );
  assert.doesNotMatch(queryNoiseMigration, / OR | AND /);
  assert.match(queryNoiseMigration, /relevance-audit-2026-09-07/);
});

test("refined profile migration is guarded, target-only, and audited", () => {
  const updatedLanes = Array.from(
    refinedProfilesMigration.matchAll(
      /update\s+public\.career_lane_definitions[\s\S]*?where archetype = '([^']+)';/gi,
    ),
    (match) => match[1],
  );

  assert.deepEqual(updatedLanes, ["technology_delivery", "ai_workflow_automation"]);
  assert.doesNotMatch(refinedProfilesMigration, /career_lane_search_queries/i);
  assert.match(
    refinedProfilesMigration,
    /\(\?=\.\*\\b\(\?:professional\\s\+services[\s\S]+\(\?=\.\*\\b\(\?:software\|cloud\|technology/,
  );
  assert.match(
    refinedProfilesMigration,
    /production \.\{0,30\}\(\?:LLM\|agentic\|AI\)[\s\S]+\(\?=\.\*\\b\(\?:tasks\?\|real users\?/,
  );

  const revisionGuard = refinedProfilesMigration.indexOf(
    "if current_revision_id is distinct from 9 then",
  );
  const firstLaneUpdate = refinedProfilesMigration.indexOf(
    "update public.career_lane_definitions",
  );
  assert.ok(revisionGuard >= 0 && revisionGuard < firstLaneUpdate);
  assert.match(refinedProfilesMigration, /if new_revision_id is distinct from 10 then/i);
  assert.match(
    refinedProfilesMigration,
    /insert into public\.career_lane_config_revisions \(source, actor_email, configuration\)\s+values \('migration', 'profile-refinement-2026-09-08', public\.get_scraper_configuration\(\)\)/i,
  );
  assert.match(
    refinedProfilesMigration,
    /returning revision_id into new_revision_id;[\s\S]+update public\.career_lane_config_revisions\s+set configuration = public\.get_scraper_configuration\(\)/i,
  );
});

test("exact local refined profiles replay without a second revision or correction", () => {
  const accidentalPattern = "creat(?:e|es|ed|ing)?";
  const exactPattern = "creat(?:e|es|ed|ing)";
  const revisionGuard = refinedProfilesCorrectionMigration.indexOf(
    "if current_revision_id is distinct from 10 then",
  );
  const laneExistenceGuard = refinedProfilesCorrectionMigration.indexOf(
    "if not lane_exists then",
  );
  const snapshotExistenceGuard = refinedProfilesCorrectionMigration.indexOf(
    "if not revision_snapshot_exists then",
  );
  const noCorrectionBranch = refinedProfilesCorrectionMigration.indexOf(
    "if replacement_count = 0 then",
  );
  const invalidCountGuard = refinedProfilesCorrectionMigration.indexOf(
    "if replacement_count <> 3 then",
  );
  const laneUpdate = refinedProfilesCorrectionMigration.indexOf(
    "update public.career_lane_definitions d",
  );
  const correctedLanes = Array.from(
    refinedProfilesCorrectionMigration.matchAll(
      /update\s+public\.career_lane_definitions[\s\S]*?where d\.archetype = '([^']+)';/gi,
    ),
    (match) => match[1],
  );

  assert.ok(revisionGuard >= 0 && revisionGuard < laneUpdate);
  assert.ok(laneExistenceGuard > revisionGuard && laneExistenceGuard < noCorrectionBranch);
  assert.ok(snapshotExistenceGuard > laneExistenceGuard && snapshotExistenceGuard < noCorrectionBranch);
  assert.ok(noCorrectionBranch > snapshotExistenceGuard && noCorrectionBranch < invalidCountGuard);
  assert.ok(invalidCountGuard < laneUpdate);
  assert.deepEqual(correctedLanes, ["ai_workflow_automation"]);
  assert.equal(refinedProfilesMigration.split(accidentalPattern).length - 1, 0);
  assert.equal(refinedProfilesMigration.split(exactPattern).length - 1, 5);
  assert.match(
    refinedProfilesCorrectionMigration,
    /if replacement_count = 0 then\s+return;\s+end if;/i,
  );
  assert.match(refinedProfilesCorrectionMigration, /select coalesce\(\s+sum\(/i);
  assert.match(
    refinedProfilesCorrectionMigration,
    /if replacement_count <> 3 then\s+raise exception 'Expected 0 or 3 exact-content corrections but found %'/i,
  );
  assert.match(
    refinedProfilesCorrectionMigration,
    /replace\(value, 'creat\(\?:e\|es\|ed\|ing\)\?', 'creat\(\?:e\|es\|ed\|ing\)'\)/,
  );
  assert.match(
    refinedProfilesCorrectionMigration,
    /where d\.archetype = 'ai_workflow_automation'/i,
  );
  assert.doesNotMatch(refinedProfilesCorrectionMigration, /career_lane_search_queries/i);
  assert.doesNotMatch(
    refinedProfilesCorrectionMigration,
    /insert\s+into\s+public\.career_lane_config_revisions/i,
  );
  assert.match(
    refinedProfilesCorrectionMigration,
    /update public\.career_lane_config_revisions\s+set configuration = public\.get_scraper_configuration\(\)\s+where revision_id = 10/i,
  );
  assert.equal(
    (
      `${refinedProfilesMigration}\n${refinedProfilesCorrectionMigration}`.match(
        /insert\s+into\s+public\.career_lane_config_revisions/gi,
      ) ?? []
    ).length,
    1,
  );
  assert.deepEqual(profileFilterHashes(refinedProfilesMigration, "technology_delivery"), {
    title_include: { count: 4, md5: "9413e1809eeafd1e13813bce40e53c44" },
    title_exclude: { count: 4, md5: "ecd1d7bd76b68ed48c9e1701fb0fbd24" },
    description_include: { count: 4, md5: "3f6014eeb4be3f103e1518302a2ddd4a" },
    description_exclude: { count: 0, md5: "d751713988987e9331980363e24189ce" },
  });
  assert.deepEqual(profileFilterHashes(refinedProfilesMigration, "ai_workflow_automation"), {
    title_include: { count: 3, md5: "2987c57cbdbad69fc819551cce86626e" },
    title_exclude: { count: 2, md5: "c4a536818bfb890329d7b55bd8d8dc5a" },
    description_include: { count: 14, md5: "63a465823ddc8e5d21f08c93bc763363" },
    description_exclude: { count: 0, md5: "d751713988987e9331980363e24189ce" },
  });
});

test("discovery status migration is private and terminal-evidence based", () => {
  assert.match(discoveryMigration, /create or replace function public\.get_linkedin_discovery_status\(\)/i);
  assert.match(discoveryMigration, /run\.coverage_status <> 'exhausted'/i);
  assert.match(
    discoveryMigration,
    /revoke all on function[\s\S]+get_linkedin_discovery_status\(\)[\s\S]+from public, anon, authenticated;/i,
  );
  assert.match(
    discoveryMigration,
    /grant execute on function[\s\S]+get_linkedin_discovery_status\(\)[\s\S]+to service_role;/i,
  );
  assert.match(discoveryMigration, /reviewed_cross_lane_false_positive/i);
});

test("status hotfix counts committed pages for running scopes", () => {
  assert.match(statusFixMigration, /from public\.linkedin_ingestion_pages/i);
  assert.match(statusFixMigration, /sum\(page\.pages\)/i);
  assert.match(statusFixMigration, /run\.coverage_status <> 'exhausted'/i);
});

test("sealed discovery drains canonical work before another search", () => {
  assert.match(sealedDrainMigration, /cycle\.search_status = 'sealed'/i);
  assert.match(sealedDrainMigration, /cycle\.canonical_status = 'pending'/i);
  assert.match(
    sealedDrainMigration,
    /case when cycle\.search_status = 'sealed' then cycle\.discovery_sequence end desc/i,
  );
});

test("Freehire compatibility batches fenced claims and persistence", () => {
  for (const functionName of [
    "claim_freehire_compat_jobs",
    "persist_freehire_compat_results",
    "apply_freehire_compat_metadata_batch",
  ]) {
    assert.match(freehireBatchMigration, new RegExp(`create or replace function public\\.${functionName}`, "i"));
    assert.match(freehireBatchMigration, new RegExp(`revoke all on function public\\.${functionName}`, "i"));
  }
  assert.match(freehireBatchMigration, /public\.claim_freehire_compat_job\(/i);
  assert.match(freehireBatchMigration, /public\.persist_freehire_compat_result\(/i);
});

test("Freehire claims replace obsolete hashes under the source fence", () => {
  assert.match(freehireReclassificationMigration, /p_expected_source_snapshot <@ to_jsonb\(j\)/i);
  assert.doesNotMatch(
    freehireReclassificationMigration,
    /freehire_compat_input_hash is null or freehire_compat_input_hash = p_expected_input_hash/i,
  );
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
