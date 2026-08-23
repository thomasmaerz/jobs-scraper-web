import assert from "node:assert/strict";
import test from "node:test";

import type { Job, ListingInstance } from "../../types.ts";
import {
  getListingRecruiters,
  getPostingWaveGroups,
  getDistinctListingLocations,
  getSortedListingInstances,
  hasListingVariants,
} from "./repost.ts";

function job(overrides: Partial<Job> = {}): Job {
  return {
    job_id: "job-1",
    company: null,
    job_title: null,
    level: null,
    location: null,
    description: null,
    status: null,
    is_active: true,
    application_date: null,
    resume_score: null,
    notes: null,
    scraped_at: null,
    last_checked: null,
    job_state: "new",
    resume_score_stage: "initial",
    is_interested: null,
    customized_resume_id: null,
    provider: "linkedin",
    posted_at: null,
    last_seen_posted_at: null,
    posted_relative_text: null,
    applicant_count: null,
    salary_text: null,
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    recruiter_name: null,
    recruiter_profile_url: null,
    recruiter_identifier: null,
    original_job_id: null,
    latest_job_id: null,
    canonical_key: null,
    first_seen_at: null,
    last_seen_at: null,
    seen_count: 1,
    posting_wave_count: 1,
    repost_count: 0,
    search_query: null,
    archetype: null,
    filter_profile: null,
    is_filtered: false,
    filter_reason: null,
    is_entry_level_filtered: false,
    description_fingerprint: null,
    insights_analyzed_at: null,
    insights_reanalyzed_at: null,
    listing_instances: null,
    ...overrides,
  };
}

test("listing variants are detected without inferring chronology", () => {
  assert.equal(hasListingVariants(job()), false);
  assert.equal(hasListingVariants(job({ seen_count: 8, repost_count: 7 })), true);
});

test("posting waves group simultaneous variants without losing source IDs", () => {
  const instances = [
    { job_id: "1", location: "Toronto", scraped_at: "2026-08-20", posted_at: "2026-08-20", posted_relative_text: null, applicant_count: null, salary_text: null, recruiter_name: null, recruiter_profile_url: null, recruiter_identifier: null, posting_wave_key: "toronto|posted:2026-08-20", posting_wave_index: 1, variant_type: "original" },
    { job_id: "2", location: "Toronto", scraped_at: "2026-08-20", posted_at: "2026-08-20", posted_relative_text: null, applicant_count: null, salary_text: null, recruiter_name: "Jane", recruiter_profile_url: null, recruiter_identifier: null, posting_wave_key: "toronto|posted:2026-08-20", posting_wave_index: 1, variant_type: "simultaneous_variant" },
    { job_id: "3", location: "Calgary", scraped_at: "2026-08-20", posted_at: "2026-08-20", posted_relative_text: null, applicant_count: null, salary_text: null, recruiter_name: null, recruiter_profile_url: null, recruiter_identifier: null, posting_wave_key: "calgary|posted:2026-08-20", posting_wave_index: 1, variant_type: "location_variant" },
  ] satisfies ListingInstance[];

  const waves = getPostingWaveGroups(job({ listing_instances: instances }));

  assert.equal(waves.length, 2);
  assert.equal(waves.find((wave) => wave.location === "Toronto")?.instances.length, 2);
  assert.deepEqual(getDistinctListingLocations(job({ listing_instances: instances })), ["Calgary", "Toronto"]);
});

test("listing recruiters are deduplicated and retain profile links", () => {
  const recruiters = getListingRecruiters(job({
    recruiter_name: "Seerat Mahajan",
    recruiter_identifier: "seerat",
    recruiter_profile_url: "https://example.com/seerat",
    listing_instances: [
      {
        job_id: "one",
        scraped_at: "2026-08-20T10:00:00Z",
        posted_at: null,
        posted_relative_text: null,
        applicant_count: null,
        salary_text: null,
        recruiter_name: "Seerat Mahajan",
        recruiter_identifier: "seerat",
        recruiter_profile_url: "https://example.com/seerat",
      },
      {
        job_id: "two",
        scraped_at: "2026-08-21T10:00:00Z",
        posted_at: null,
        posted_relative_text: null,
        applicant_count: null,
        salary_text: null,
        recruiter_name: "Vijay Kumar",
        recruiter_identifier: "vijay",
        recruiter_profile_url: "https://example.com/vijay",
      },
    ],
  }));

  assert.deepEqual(recruiters, [
    { name: "Seerat Mahajan", profileUrl: "https://example.com/seerat" },
    { name: "Vijay Kumar", profileUrl: "https://example.com/vijay" },
  ]);
});

test("listing history retains location and sorts newest scrape first", () => {
  const instances: ListingInstance[] = [
    {
      job_id: "old",
      location: "Calgary, Alberta, Canada",
      scraped_at: "2026-08-20T10:00:00Z",
      posted_at: null,
      posted_relative_text: null,
      applicant_count: null,
      salary_text: null,
      recruiter_name: null,
      recruiter_profile_url: null,
      recruiter_identifier: null,
    },
    {
      job_id: "new",
      location: "Edmonton, Alberta, Canada",
      scraped_at: "2026-08-21T10:00:00Z",
      posted_at: null,
      posted_relative_text: null,
      applicant_count: null,
      salary_text: null,
      recruiter_name: null,
      recruiter_profile_url: null,
      recruiter_identifier: null,
    },
  ];

  const sorted = getSortedListingInstances(job({ listing_instances: instances }));
  assert.deepEqual(sorted.map((instance) => instance.job_id), ["new", "old"]);
  assert.equal(sorted[0].location, "Edmonton, Alberta, Canada");
});
