import test from "node:test";
import assert from "node:assert/strict";

import { normalizeInsightsArchetype } from "./normalizeArchetype.ts";

test("normalizeInsightsArchetype trims strings and falls back to software_tpm for empty values", () => {
  assert.equal(normalizeInsightsArchetype(" software_tpm "), "software_tpm");
  assert.equal(normalizeInsightsArchetype("   "), "software_tpm");
  assert.equal(normalizeInsightsArchetype([" data_pm ", "software_tpm"]), "data_pm");
  assert.equal(normalizeInsightsArchetype(["   ", "software_tpm"]), "software_tpm");
  assert.equal(normalizeInsightsArchetype(undefined), "software_tpm");
});
