import test from "node:test";
import assert from "node:assert/strict";

import {
  __resetKeywordInsightsClientFactoryForTests,
  __setKeywordInsightsClientFactoryForTests,
  getKeywordInsights,
} from "./queries.ts";

type KeywordInsight = {
  keyword: string;
  category: string;
  archetype?: string;
  count: number;
  last_updated?: string | null;
};

type QueryCall =
  | { method: "from"; args: [table: string] }
  | { method: "select"; args: [fields: string, options?: { count?: string }] }
  | { method: "order"; args: [column: string, options: { ascending: boolean }] }
  | { method: "eq"; args: [column: string, value: string] }
  | { method: "gte"; args: [column: string, value: number] }
  | { method: "range"; args: [from: number, to: number] };

function createSupabaseMock(responseData = [{
  keyword: "roadmap",
  category: "skill",
  archetype: "software_tpm",
  count: 5,
  last_updated: "2026-06-11",
}]) {
  const calls: QueryCall[] = [];

  const query = {
    select(fields: string, options?: { count?: string }) {
      calls.push({ method: "select", args: [fields, options] });
      return query;
    },
    order(column: string, options: { ascending: boolean }) {
      calls.push({ method: "order", args: [column, options] });
      return query;
    },
    eq(column: string, value: string) {
      calls.push({ method: "eq", args: [column, value] });
      return query;
    },
    gte(column: string, value: number) {
      calls.push({ method: "gte", args: [column, value] });
      return query;
    },
    async range(from: number, to: number) {
      calls.push({ method: "range", args: [from, to] });
      return {
        data: responseData,
        error: null,
        count: responseData.length,
      };
    },
  };

  return {
    calls,
    client: {
      from(table: string) {
        calls.push({ method: "from", args: [table] });
        return query;
      },
    },
  };
}

function filterScopedKeywordInsightsByCategory(
  keywords: KeywordInsight[],
  category: KeywordInsight["category"] | "all",
) {
  return category === "all"
    ? keywords
    : keywords.filter((keyword) => keyword.category === category);
}

test.afterEach(() => {
  __resetKeywordInsightsClientFactoryForTests();
});

test("getKeywordInsights defaults to software_tpm, minCount 2, and selects archetype", async () => {
  const { client, calls } = createSupabaseMock();

  __setKeywordInsightsClientFactoryForTests(async () => client);

  const result = await getKeywordInsights();

  assert.equal(result.totalCount, 1);
  assert.equal(result.keywords[0]?.archetype, "software_tpm");
  assert.deepEqual(calls, [
    { method: "from", args: ["keyword_insights"] },
    {
      method: "select",
      args: ["keyword, category, archetype, count, last_updated", { count: "exact" }],
    },
    { method: "order", args: ["count", { ascending: false }] },
    { method: "order", args: ["keyword", { ascending: true }] },
    { method: "eq", args: ["archetype", "software_tpm"] },
    { method: "gte", args: ["count", 2] },
    { method: "range", args: [0, 999] },
  ]);
});

test("getKeywordInsights applies provider filter only when provided", async () => {
  const withProvider = createSupabaseMock();
  __setKeywordInsightsClientFactoryForTests(async () => withProvider.client);

  await getKeywordInsights({ archetype: "data_pm", provider: "linkedin", minCount: 7 });

  assert.deepEqual(
    withProvider.calls.filter((call) => call.method === "eq" || call.method === "gte"),
    [
      { method: "eq", args: ["archetype", "data_pm"] },
      { method: "gte", args: ["count", 7] },
      { method: "eq", args: ["provider", "linkedin"] },
    ],
  );

  const withoutProvider = createSupabaseMock();
  __setKeywordInsightsClientFactoryForTests(async () => withoutProvider.client);

  await getKeywordInsights({ archetype: "data_pm", minCount: 7 });

  assert.deepEqual(
    withoutProvider.calls.filter((call) => call.method === "eq" || call.method === "gte"),
    [
      { method: "eq", args: ["archetype", "data_pm"] },
      { method: "gte", args: ["count", 7] },
    ],
  );
});

test("category filtering operates only on already-scoped software_tpm rows", async () => {
  const scopedRows: KeywordInsight[] = [
    {
      keyword: "Roadmapping",
      category: "skill",
      archetype: "software_tpm",
      count: 5,
      last_updated: "2026-06-11",
    },
    {
      keyword: "Python",
      category: "technology",
      archetype: "software_tpm",
      count: 2,
      last_updated: "2026-06-11",
    },
    {
      keyword: "PMP",
      category: "certification",
      archetype: "software_tpm",
      count: 3,
      last_updated: "2026-06-11",
    },
  ];

  const { client } = createSupabaseMock(scopedRows);
  __setKeywordInsightsClientFactoryForTests(async () => client);

  const result = await getKeywordInsights({ archetype: "software_tpm" });
  const technologyRows = filterScopedKeywordInsightsByCategory(result.keywords, "technology");

  assert.deepEqual(
    result.keywords.map((row) => row.archetype),
    ["software_tpm", "software_tpm", "software_tpm"],
  );
  assert.deepEqual(technologyRows, [
    {
      keyword: "Python",
      category: "technology",
      archetype: "software_tpm",
      count: 2,
      last_updated: "2026-06-11",
    },
  ]);
  assert.equal(technologyRows.some((row) => row.archetype !== "software_tpm"), false);
});
