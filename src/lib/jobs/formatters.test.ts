import assert from "node:assert/strict";
import test from "node:test";

import {
  formatFilterReason,
  formatLevel,
  formatAdditionalListingCount,
  formatArchetype,
  hasSpecifiedLevel,
  formatSeenCount,
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

test("listing count helpers suppress empty values", () => {
  assert.equal(formatSeenCount(1), "1 listing ID");
  assert.equal(formatSeenCount(3), "3 listing IDs");
  assert.equal(formatSeenCount(0), "");
  assert.equal(formatAdditionalListingCount(1), "1 additional listing ID");
  assert.equal(formatAdditionalListingCount(2), "2 additional listing IDs");
  assert.equal(formatAdditionalListingCount(0), "");
});

test("filter reasons describe exclusions without exposing raw regex", () => {
  assert.equal(
    formatFilterReason("title:\\baccount manager\\b"),
    "Filtered: account management role",
  );
  assert.equal(
    formatFilterReason(
      "desc:(?s)\\bsubcontractor.{0,3000}\\b(?:general contractor|construction management)",
    ),
    "Filtered: construction-related role",
  );
  assert.equal(
    formatFilterReason("title_entry_level:\\bcoordinator\\b"),
    "Filtered: entry-level title",
  );
  assert.equal(
    formatFilterReason("desc:an unknown internal expression"),
    "Filtered: description matched an exclusion rule",
  );
  assert.equal(formatFilterReason(null), "");
});
