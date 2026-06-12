import test from "node:test";
import assert from "node:assert/strict";

import { getNextKeywordInsightsRange, shouldContinueKeywordInsightsFetch } from "./keywordInsightsPagination.ts";

type KeywordInsight = {
  keyword: string;
  category: string;
  count: number;
  last_updated?: string | null;
};

function aggregateKeywordInsightBatches(args: {
  batches: KeywordInsight[][];
  totalCount: number | null;
  batchSize?: number;
}) {
  const batchSize = args.batchSize ?? 1000;
  let offset = 0;
  let totalCount = args.totalCount;
  const keywords: KeywordInsight[] = [];
  const requestedRanges: Array<{ from: number; to: number }> = [];

  for (const batch of args.batches) {
    const range = getNextKeywordInsightsRange(offset, batchSize);
    requestedRanges.push(range);
    keywords.push(...batch);

    if (
      !shouldContinueKeywordInsightsFetch({
        accumulatedCount: keywords.length,
        batchCount: batch.length,
        batchSize,
        totalCount,
      })
    ) {
      break;
    }

    offset += batchSize;
  }

  return {
    keywords,
    totalCount: totalCount ?? keywords.length,
    requestedRanges,
  };
}

test("pagination helpers produce expected first and second ranges", () => {
  assert.deepEqual(getNextKeywordInsightsRange(0, 1000), { from: 0, to: 999 });
  assert.deepEqual(getNextKeywordInsightsRange(1000, 1000), { from: 1000, to: 1999 });
});

test("shouldContinueKeywordInsightsFetch stops on empty, partial, and exact-total batches", () => {
  assert.equal(
    shouldContinueKeywordInsightsFetch({
      accumulatedCount: 1000,
      batchCount: 0,
      batchSize: 1000,
      totalCount: 1500,
    }),
    false,
  );

  assert.equal(
    shouldContinueKeywordInsightsFetch({
      accumulatedCount: 1500,
      batchCount: 500,
      batchSize: 1000,
      totalCount: 3000,
    }),
    false,
  );

  assert.equal(
    shouldContinueKeywordInsightsFetch({
      accumulatedCount: 2200,
      batchCount: 1000,
      batchSize: 1000,
      totalCount: 2200,
    }),
    false,
  );
});

test("aggregation logic combines multiple batches into one full result set", () => {
  const firstBatch = Array.from({ length: 1000 }, (_, index) => ({
    keyword: `kw-${index + 1}`,
    category: "skill",
    count: 10,
    last_updated: "2026-06-11",
  }));

  const secondBatch = Array.from({ length: 200 }, (_, index) => ({
    keyword: `kw-${index + 1001}`,
    category: "technology",
    count: 9,
    last_updated: "2026-06-11",
  }));

  const result = aggregateKeywordInsightBatches({
    batches: [firstBatch, secondBatch],
    totalCount: 1200,
  });

  assert.equal(result.keywords.length, 1200);
  assert.equal(result.totalCount, 1200);
  assert.deepEqual(result.requestedRanges, [
    { from: 0, to: 999 },
    { from: 1000, to: 1999 },
  ]);
  assert.equal(result.keywords[0]?.keyword, "kw-1");
  assert.equal(result.keywords[1199]?.keyword, "kw-1200");
});
