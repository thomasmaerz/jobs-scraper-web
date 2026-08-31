import assert from "node:assert/strict";
import test from "node:test";

import { parseBooleanSearch } from "./booleanSearch.ts";

test("Boolean search obeys NOT, implicit AND, explicit AND, and OR precedence", () => {
  assert.deepEqual(parseBooleanSearch("program manager OR product AND NOT sales"), {
    ok: true,
    explicitBoolean: true,
    ast: {
      type: "or",
      children: [
        { type: "and", children: [{ type: "term", term: "program" }, { type: "term", term: "manager" }] },
        { type: "and", children: [{ type: "term", term: "product" }, { type: "term", term: "sales", negated: true }] },
      ],
    },
  });
});

test("Boolean search supports groups, phrases, case-insensitive operators, and escaped quotes", () => {
  assert.deepEqual(parseBooleanSearch('(TPM or "program manager") AND NOT "sales \\"ops\\""'), {
    ok: true,
    explicitBoolean: true,
    ast: {
      type: "and",
      children: [
        { type: "or", children: [{ type: "term", term: "TPM" }, { type: "term", term: "program manager" }] },
        { type: "term", term: 'sales "ops"', negated: true },
      ],
    },
  });
});

test("Boolean search applies De Morgan normalization", () => {
  assert.deepEqual(parseBooleanSearch("NOT (sales OR marketing)"), {
    ok: true,
    explicitBoolean: true,
    ast: {
      type: "and",
      children: [
        { type: "term", term: "sales", negated: true },
        { type: "term", term: "marketing", negated: true },
      ],
    },
  });
});

test("operator substrings remain ordinary terms", () => {
  assert.deepEqual(parseBooleanSearch("android oracle Netherlands"), {
    ok: true,
    explicitBoolean: false,
    ast: {
      type: "and",
      children: [
        { type: "term", term: "android" },
        { type: "term", term: "oracle" },
        { type: "term", term: "Netherlands" },
      ],
    },
  });
});

test("malformed Boolean searches return actionable errors", () => {
  for (const query of ['"program manager', "program AND", "(program OR manager", "program ) manager", "()"] as const) {
    const result = parseBooleanSearch(query);
    assert.equal(result.ok, false, query);
    if (!result.ok) assert.ok(result.error.length > 0, query);
  }
});

test("Boolean search bounds individual terms and keeps wildcard characters literal", () => {
  const oversized = parseBooleanSearch(`"${"x".repeat(201)}"`);
  assert.equal(oversized.ok, false);
  assert.deepEqual(parseBooleanSearch("100% _remote_"), {
    ok: true,
    explicitBoolean: false,
    ast: {
      type: "and",
      children: [
        { type: "term", term: "100%" },
        { type: "term", term: "_remote_" },
      ],
    },
  });
});
