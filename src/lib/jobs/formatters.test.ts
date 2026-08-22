import assert from "node:assert/strict";
import test from "node:test";

import {
  formatFilterReason,
  formatLevel,
  formatRepostCount,
  formatSeenCount,
} from "./formatters.ts";

test("formatLevel supports exact database values", () => {
  assert.equal(formatLevel("Not Applicable"), "Not Applicable");
  assert.equal(formatLevel("Mid-Senior level"), "Mid-Senior");
  assert.equal(formatLevel("Entry level"), "Entry");
  assert.equal(formatLevel("Associate"), "Associate");
  assert.equal(formatLevel("Director"), "Director");
  assert.equal(formatLevel("Executive"), "Executive");
  assert.equal(formatLevel("Internship"), "Internship");
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

test("seen, filter, and repost helpers suppress empty values", () => {
  assert.equal(formatSeenCount(3), "Seen 3x");
  assert.equal(formatSeenCount(0), "");
  assert.equal(formatFilterReason("title:construction"), "filtered: title:construction");
  assert.equal(formatFilterReason(null), "");
  assert.equal(formatRepostCount(1), "Reposted 1 time");
  assert.equal(formatRepostCount(2), "Reposted 2 times");
  assert.equal(formatRepostCount(0), "");
});
