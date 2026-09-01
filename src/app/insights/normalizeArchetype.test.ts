import test from "node:test";
import assert from "node:assert/strict";

import { normalizeInsightsArchetype } from "./normalizeArchetype.ts";

test("normalizeInsightsArchetype canonicalizes aliases and defaults to technology_delivery", () => {
  assert.equal(normalizeInsightsArchetype(" software_tpm "), "technology_delivery");
  assert.equal(normalizeInsightsArchetype("   "), "technology_delivery");
  assert.equal(normalizeInsightsArchetype([" data_pm ", "software_tpm"]), "data_pm");
  assert.equal(normalizeInsightsArchetype(["   ", "software_tpm"]), "technology_delivery");
  assert.equal(normalizeInsightsArchetype(undefined), "technology_delivery");
});
