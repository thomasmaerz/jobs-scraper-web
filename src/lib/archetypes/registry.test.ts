import assert from "node:assert/strict";
import test from "node:test";

import {
  ARCHETYPE_REGISTRY,
  CANONICAL_ARCHETYPES,
  archetypeLabel,
  canonicalizeArchetype,
  compatibleArchetypeValues,
} from "./registry.ts";

test("registry defines all six canonical career lanes", () => {
  assert.equal(CANONICAL_ARCHETYPES.length, 6);
  assert.deepEqual(Object.keys(ARCHETYPE_REGISTRY), [...CANONICAL_ARCHETYPES]);
});

test("software_tpm is a compatibility alias for technology_delivery", () => {
  assert.equal(canonicalizeArchetype(" software_tpm "), "technology_delivery");
  assert.equal(archetypeLabel("software_tpm"), "Technology Delivery");
  assert.deepEqual(compatibleArchetypeValues(["technology_delivery"]), [
    "technology_delivery",
    "software_tpm",
  ]);
});

test("compatible values de-duplicate canonical and legacy inputs", () => {
  assert.deepEqual(
    compatibleArchetypeValues(["software_tpm", "technology_delivery", "network_infrastructure"]),
    ["technology_delivery", "software_tpm", "network_infrastructure"],
  );
});
