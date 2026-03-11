"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Category = "all" | "skill" | "technology" | "certification" | "attribute";

interface KeywordInsight {
  keyword: string;
  category: string;
  count: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  skill:         "#1976D2",
  technology:    "#00897B",
  certification: "#F57C00",
  attribute:     "#7B1FA2",
};

const CATEGORY_LABELS: Record<string, string> = {
  all:           "All",
  skill:         "Skills",
  technology:    "Technologies",
  certification: "Certifications",
  attribute:     "Attributes",
};

function WordCloud({ keywords }: { keywords: KeywordInsight[] }) {
  if (!keywords.length) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      No data available for this category.
    </div>
  );

  const maxCount = Math.max(...keywords.map(k => k.count));
  const minCount = Math.min(...keywords.map(k => k.count));

  const fontSize = (count: number) => {
    if (maxCount === minCount) return 24;
    const normalized = (count - minCount) / (maxCount - minCount);
    return Math.round(14 + normalized * 42); // 14px to 56px
  };

  const opacity = (count: number) => {
    if (maxCount === minCount) return 1;
    const normalized = (count - minCount) / (maxCount - minCount);
    return 0.5 + normalized * 0.5; // 0.5 to 1.0
  };

  return (
    <div className="flex flex-wrap gap-3 justify-center p-6">
      {keywords.map((k) => (
        <span
          key={`${k.keyword}-${k.category}`}
          title={`${k.keyword} — ${k.count} job${k.count !== 1 ? "s" : ""}`}
          style={{
            fontSize: `${fontSize(k.count)}px`,
            color: CATEGORY_COLORS[k.category] ?? "#555",
            opacity: opacity(k.count),
            lineHeight: 1.3,
            cursor: "default",
            transition: "opacity 0.2s",
          }}
          className="hover:opacity-100 select-none"
        >
          {k.keyword}
        </span>
      ))}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-4 justify-center mb-6">
      {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
        <div key={cat} className="flex items-center gap-1.5 text-sm text-gray-600">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
          {CATEGORY_LABELS[cat] ?? cat}
        </div>
      ))}
    </div>
  );
}

function TopList({ keywords, limit = 20 }: { keywords: KeywordInsight[]; limit?: number }) {
  const sorted = [...keywords].sort((a, b) => b.count - a.count).slice(0, limit);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {sorted.map((k, i) => (
        <div
          key={`${k.keyword}-${k.category}`}
          className="flex items-center justify-between px-4 py-2 rounded-lg bg-white border border-gray-200 shadow-sm"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-gray-400 text-sm w-5 shrink-0">{i + 1}</span>
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: CATEGORY_COLORS[k.category] ?? "#555" }}
            />
            <span className="text-sm font-medium text-gray-800 truncate">{k.keyword}</span>
          </div>
          <span className="text-sm text-gray-500 ml-2 shrink-0">{k.count}</span>
        </div>
      ))}
    </div>
  );
}

export default function InsightsPage() {
  const [allKeywords, setAllKeywords] = useState<KeywordInsight[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [totalKeywords, setTotalKeywords] = useState<number | null>(null);

  useEffect(() => {
    async function fetchInsights() {
      setLoading(true);
      setError(null);
      try {
        const { data, error, count: totalCount } = await supabase
          .from("keyword_insights")
          .select("keyword, category, count, last_updated", { count: "exact" })
          .order("count", { ascending: false })
          .gte("count", 2)   // skip low-signal single-occurrence keywords
          .limit(500);        // top 500 by frequency is plenty for a word cloud

        if (error) throw error;
        setAllKeywords(data ?? []);
        if (data && data.length > 0) {
          setLastUpdated(data[0].last_updated ?? null);
        }
        if (rowCount !== null) setTotalKeywords(rowCount);
      } catch (e: any) {
        setError(e.message ?? "Failed to load insights.");
      } finally {
        setLoading(false);
      }
    }
    fetchInsights();
  }, []);

  const filtered = activeCategory === "all"
    ? allKeywords
    : allKeywords.filter(k => k.category === activeCategory);

  const categories: Category[] = ["all", "skill", "technology", "certification", "attribute"];

  const counts = {
    all: allKeywords.length,
    skill: allKeywords.filter(k => k.category === "skill").length,
    technology: allKeywords.filter(k => k.category === "technology").length,
    certification: allKeywords.filter(k => k.category === "certification").length,
    attribute: allKeywords.filter(k => k.category === "attribute").length,
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Job Market Insights</h1>
        <p className="text-gray-500 mt-1">
          Most commonly requested skills, technologies, certifications and attributes across{" "}
          <span className="font-medium text-gray-700">
            {totalKeywords !== null ? `${totalKeywords} unique keywords` : "your scraped jobs"}
          </span>.
          {lastUpdated && (
            <span className="ml-2 text-xs text-gray-400">
              Last updated {new Date(lastUpdated).toLocaleDateString()}
            </span>
          )}
        </p>
      </div>

      {/* Category filter tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              activeCategory === cat
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
            }`}
          >
            {CATEGORY_LABELS[cat]}
            <span className={`ml-1.5 text-xs ${activeCategory === cat ? "text-blue-100" : "text-gray-400"}`}>
              {counts[cat]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">
          Loading insights...
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-64 text-red-400">
          {error}
        </div>
      ) : (
        <>
          {/* Word Cloud */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 mb-8 min-h-64">
            {activeCategory === "all" && <Legend />}
            <WordCloud keywords={filtered} />
          </div>

          {/* Top 20 ranked list */}
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              Top {Math.min(20, filtered.length)} — {CATEGORY_LABELS[activeCategory]}
            </h2>
            <TopList keywords={filtered} limit={20} />
          </div>
        </>
      )}
    </div>
  );
}
