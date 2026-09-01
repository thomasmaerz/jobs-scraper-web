import assert from "node:assert/strict";
import test from "node:test";

import { jobDetailHref } from "./detailLink.ts";

test("lane-filtered list links preserve selected membership context", () => {
  const params = new URLSearchParams();
  params.append("archetype", "network_infrastructure");
  params.append("archetype", "systems_platform_ops");
  params.set("page", "2");
  assert.equal(
    jobDetailHref("job/1", params),
    "/jobs/job%2F1?archetype=network_infrastructure&archetype=systems_platform_ops",
  );
});

test("unfiltered list links do not guess a membership", () => {
  assert.equal(jobDetailHref("job-1", new URLSearchParams("page=2")), "/jobs/job-1");
});
