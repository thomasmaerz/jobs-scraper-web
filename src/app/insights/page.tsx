import InsightsClient from "@/components/insights/InsightsClient";
import { getKeywordInsights } from "@/lib/supabase/queries";
import { normalizeInsightsArchetype } from "./normalizeArchetype";

export default async function InsightsPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  try {
    const params = await searchParams;
    const archetype = normalizeInsightsArchetype(params?.archetype);

    const { keywords, totalCount } = await getKeywordInsights({ archetype });

    if (!keywords.length) {
      return (
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Job Market Insights</h1>
            <p className="mt-1 text-gray-500">
              Most commonly requested skills, technologies, certifications and attributes.
            </p>
          </div>

          <div className="flex h-64 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-400">
            No insights available yet.
          </div>
        </div>
      );
    }

    return (
      <InsightsClient
        archetype={archetype}
        keywords={keywords}
        totalKeywords={totalCount}
        lastUpdated={keywords[0]?.last_updated ?? null}
      />
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load insights.";

    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Job Market Insights</h1>
          <p className="mt-1 text-gray-500">
            Most commonly requested skills, technologies, certifications and attributes.
          </p>
        </div>

        <div className="flex h-64 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-400">
          {message}
        </div>
      </div>
    );
  }
}
