import assert from "node:assert/strict";
import test from "node:test";

import {
  __resetKeywordInsightsClientFactoryForTests,
  __setKeywordInsightsClientFactoryForTests,
  getKeywordInsights,
} from "./queries.ts";

test.afterEach(() => {
  __resetKeywordInsightsClientFactoryForTests();
});

test("getKeywordInsights batches at 1000 rows until the RPC total is reached", async () => {
  const offsets: number[] = [];
  const firstBatch = Array.from({ length: 1000 }, (_, index) => ({
    keyword: `kw-${index + 1}`,
    category: "skill",
    count: 10,
    total_count: 1200,
    last_updated: "2026-06-11",
  }));
  const secondBatch = Array.from({ length: 200 }, (_, index) => ({
    keyword: `kw-${index + 1001}`,
    category: "technology",
    count: 9,
    total_count: 1200,
    last_updated: "2026-06-11",
  }));

  __setKeywordInsightsClientFactoryForTests(async () => ({
    async rpc(name: string, params: { p_limit: number; p_offset: number }) {
      assert.equal(name, "get_filtered_keyword_insights");
      assert.equal(params.p_limit, 1000);
      offsets.push(params.p_offset);
      return {
        data: params.p_offset === 0 ? firstBatch : secondBatch,
        error: null,
      };
    },
  }));

  const result = await getKeywordInsights();

  assert.deepEqual(offsets, [0, 1000]);
  assert.equal(result.totalCount, 1200);
  assert.equal(result.keywords.length, 1200);
  assert.equal(result.keywords[0]?.keyword, "kw-1");
  assert.equal(result.keywords[1199]?.keyword, "kw-1200");
  assert.equal("total_count" in result.keywords[0]!, false);
});

test("getKeywordInsights returns an empty aggregate result without requesting another batch", async () => {
  let calls = 0;
  __setKeywordInsightsClientFactoryForTests(async () => ({
    async rpc() {
      calls += 1;
      return { data: [], error: null };
    },
  }));

  const result = await getKeywordInsights({ archetypes: [], minCount: -10 });

  assert.deepEqual(result, { keywords: [], totalCount: 0 });
  assert.equal(calls, 1);
});
