import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./[job_id]/page.tsx", import.meta.url), "utf8");

test("job detail passes its explicit archetype to details and keyword insights", () => {
  assert.match(source, /getJobById\(job_id, archetype\)/);
  assert.match(source, /getJobKeywordInsights\(job_id, archetype\)/);
});
