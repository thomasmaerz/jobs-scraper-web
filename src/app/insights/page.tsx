import { Suspense } from "react";

import InsightsClient from "@/components/insights/InsightsClient";
import FilterButton from "@/components/jobs/FilterButton";
import FilterChips from "@/components/jobs/FilterChips";
import { parseFilterSearchParams } from "@/lib/filters/searchParams";
import type { FilterId } from "@/lib/filters/types";
import { getKeywordInsights } from "@/lib/supabase/queries";

const INSIGHTS_FILTERS = [
  "provider",
  "archetype",
  "level",
  "filterStatus",
  "company",
  "jobTitle",
  "location",
] as const satisfies readonly FilterId[];
const KNOWN_ARCHETYPES = ["software_tpm"] as const;

function InsightsHeader() {
  return (
    <>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Market Insights</h1>
          <p className="mt-1 text-gray-500">
            Most commonly requested skills, technologies, certifications and attributes.
          </p>
        </div>
        <Suspense
          fallback={
            <button
              type="button"
              disabled
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-400"
            >
              Filters
            </button>
          }
        >
          <FilterButton
            supportedFilters={INSIGHTS_FILTERS}
            knownArchetypes={KNOWN_ARCHETYPES}
          />
        </Suspense>
      </div>
      <Suspense fallback={null}>
        <FilterChips
          supportedFilters={INSIGHTS_FILTERS}
          knownArchetypes={KNOWN_ARCHETYPES}
        />
      </Suspense>
    </>
  );
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const filters = parseFilterSearchParams(params ?? {}, {
    knownArchetypes: KNOWN_ARCHETYPES,
  });
  const archetypes = filters.archetype?.length
    ? filters.archetype
    : [...KNOWN_ARCHETYPES];
  const activeCategory = filters.category ?? "all";
  const scopeLabel = archetypes
    .map((archetype) =>
      archetype === "software_tpm" ? "Software TPM" : archetype,
    )
    .join(", ");

  let result: Awaited<ReturnType<typeof getKeywordInsights>> | undefined;
  let errorMessage: string | undefined;
  try {
    result = await getKeywordInsights({
      providers: filters.provider ? [filters.provider] : undefined,
      archetypes,
      levels: filters.level,
      filterStatus: filters.filterStatus,
      companies: filters.company,
      jobTitles: filters.jobTitle,
      provinces: filters.province,
      locationScopes: filters.locationScope,
      excludeMetros: filters.excludeMetro,
      category: activeCategory,
      minCount: 2,
    });
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load insights.";
  }

  if (!result) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <InsightsHeader />
        <div className="flex h-64 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-400">
          {errorMessage}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <InsightsHeader />
      <Suspense fallback={null}>
        <InsightsClient
          scopeLabel={scopeLabel}
          keywords={result.keywords}
          totalKeywords={result.totalCount}
          lastUpdated={result.keywords[0]?.last_updated ?? null}
          activeCategory={activeCategory}
        />
      </Suspense>
    </div>
  );
}
