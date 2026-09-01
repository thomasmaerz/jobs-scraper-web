import assert from "node:assert/strict";
import test from "node:test";

import {
  formatFilterReason,
  formatLevel,
  formatPostedRelative,
  formatRepostCount,
  formatSourcePostedDate,
  formatArchetype,
  getLinkedInListingUrl,
  getJobDisplayDate,
  getLatestPostedAt,
  hasSpecifiedLevel,
} from "./formatters.ts";
import type { Job } from "../../types.ts";

function jobWithDates(
  postedAt: string | null,
  lastSeenPostedAt: string | null,
  effectivePostedAt?: string | null,
): Job {
  return {
    posted_at: postedAt,
    last_seen_posted_at: lastSeenPostedAt,
    effective_posted_at: effectivePostedAt,
  } as Job;
}

test("latest posted date prefers the newest canonical listing timestamp", () => {
  assert.equal(
    getLatestPostedAt(jobWithDates("2026-04-26", "2026-08-26")),
    "2026-08-26",
  );
  assert.equal(
    getLatestPostedAt(jobWithDates("2026-08-30", null)),
    "2026-08-30",
  );
  assert.equal(
    getLatestPostedAt(jobWithDates("2026-08-30", "2026-08-26")),
    "2026-08-30",
  );
  assert.equal(
    getLatestPostedAt(jobWithDates("2026-04-26", "2026-08-26", "2026-08-27")),
    "2026-08-27",
  );
  assert.equal(getLatestPostedAt(jobWithDates(null, null)), null);
});

test("source posting dates retain their calendar day", () => {
  assert.equal(formatSourcePostedDate("2026-08-30T00:00:00+00:00"), "Aug 30, 2026");
  assert.equal(formatSourcePostedDate("2026-08-30"), "Aug 30, 2026");
});

test("job display dates preserve scraped fallback when posting time is unknown", () => {
  assert.deepEqual(
    getJobDisplayDate({
      ...jobWithDates(null, null),
      scraped_at: "2026-06-04T12:39:15Z",
    }),
    { label: "Scraped", value: "2026-06-04T12:39:15Z" },
  );
  assert.deepEqual(
    getJobDisplayDate({
      ...jobWithDates("2026-08-30", null),
      scraped_at: "2026-08-31T12:00:00Z",
    }),
    { label: "Posted", value: "2026-08-30" },
  );
});

test("builds safe LinkedIn listing URLs from source IDs", () => {
  assert.equal(
    getLinkedInListingUrl("4430494163"),
    "https://www.linkedin.com/jobs/view/4430494163",
  );
  assert.equal(getLinkedInListingUrl("javascript:alert(1)"), null);
  assert.equal(getLinkedInListingUrl(null), null);
});

test("formatLevel supports exact database values", () => {
  assert.equal(formatLevel("Not Applicable"), "Seniority unspecified");
  assert.equal(formatLevel("Mid-Senior level"), "Mid-Senior");
  assert.equal(formatLevel("Entry level"), "Entry");
  assert.equal(formatLevel("Associate"), "Associate");
  assert.equal(formatLevel("Director"), "Director");
  assert.equal(formatLevel("Executive"), "Executive");
  assert.equal(formatLevel("Internship"), "Internship");
});

test("unspecified seniority can be omitted without hiding real levels", () => {
  assert.equal(hasSpecifiedLevel("Not Applicable"), false);
  assert.equal(hasSpecifiedLevel("not_applicable"), false);
  assert.equal(hasSpecifiedLevel(null), false);
  assert.equal(hasSpecifiedLevel("Mid-Senior level"), true);
});

test("archetype labels are human readable", () => {
  assert.equal(formatArchetype("software_tpm"), "Technology Delivery");
  assert.equal(formatArchetype("technology_delivery"), "Technology Delivery");
  assert.equal(formatArchetype("network_infrastructure"), "Network Infrastructure");
  assert.equal(formatArchetype("data_pm"), "data pm");
});

test("formatLevel supports common canonical aliases and preserves unknown values", () => {
  assert.equal(formatLevel("entry_level"), "Entry");
  assert.equal(formatLevel("mid_senior"), "Mid-Senior");
  assert.equal(formatLevel("mid-senior"), "Mid-Senior");
  assert.equal(formatLevel("director_level"), "Director");
  assert.equal(formatLevel("senior_level"), "Senior");
  assert.equal(formatLevel("intern"), "Internship");
  assert.equal(formatLevel("Graduate"), "Graduate");
  assert.equal(formatLevel(null), "");
});

test("repost count helper suppresses empty values", () => {
  assert.equal(formatRepostCount(1), "Repost count: 1");
  assert.equal(formatRepostCount(2), "Repost count: 2");
  assert.equal(formatRepostCount(0), "");
});

test("relative posting time is framed against scrape time", () => {
  assert.equal(formatPostedRelative("19 hours ago"), "Listed 19 hours before scrape");
  assert.equal(formatPostedRelative("2 days ago"), "Listed 2 days before scrape");
  assert.equal(formatPostedRelative(null), "");
});

test("filter reasons describe exclusions without exposing raw regex", () => {
  assert.equal(
    formatFilterReason("title:\\baccount manager\\b"),
    "Filtered: account management",
  );
  assert.equal(
    formatFilterReason(
      "desc:(?s)\\bsubcontractor.{0,3000}\\b(?:general contractor|construction management)",
    ),
    "Filtered: construction",
  );
  assert.equal(
    formatFilterReason("title_entry_level:\\bcoordinator\\b"),
    "Filtered: entry-level",
  );
  assert.equal(
    formatFilterReason("desc:an unknown internal expression"),
    "Filtered: description matched an exclusion rule",
  );
  assert.equal(formatFilterReason(null), "");
});
