export type KeywordInsightsFetchState = {
  accumulatedCount: number;
  batchCount: number;
  batchSize: number;
  totalCount: number | null;
};

export function getNextKeywordInsightsRange(offset: number, batchSize: number) {
  return {
    from: offset,
    to: offset + batchSize - 1,
  };
}

export function shouldContinueKeywordInsightsFetch({
  accumulatedCount,
  batchCount,
  batchSize,
  totalCount,
}: KeywordInsightsFetchState) {
  if (batchCount === 0) {
    return false;
  }

  if (batchCount < batchSize) {
    return false;
  }

  if (totalCount !== null && accumulatedCount >= totalCount) {
    return false;
  }

  return true;
}
