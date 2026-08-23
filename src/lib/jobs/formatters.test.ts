import assert from "node:assert/strict";
import test from "node:test";

import {
  formatFilterReason,
  formatLevel,
  formatPostedRelative,
  formatRepostCount,
  formatArchetype,
  hasSpecifiedLevel,
} from "./formatters.ts";

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
  assert.equal(formatArchetype("software_tpm"), "Software TPM");
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
