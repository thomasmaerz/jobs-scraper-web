"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { parseBooleanSearch } from "@/lib/jobs/booleanSearch";

export default function SearchComponent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSearchQuery(searchParams.get("query") || "");
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (trimmed) {
      const parsed = parseBooleanSearch(trimmed);
      if (!parsed.ok) {
        setError(`${parsed.error} (at character ${parsed.position + 1})`);
        return;
      }
    }
    setError(null);
    const params = new URLSearchParams(searchParams.toString());
    if (trimmed) {
      params.set("query", trimmed);
    } else {
      params.delete("query");
    }
    // Reset page to 1 when a new search is performed
    params.set("page", "1");
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="w-96 max-w-full">
      <form onSubmit={handleSearch} className="relative group">
        <div
          className={`
          relative flex items-center
          bg-white/90 backdrop-blur-sm
          border border-gray-200/60
          rounded-xl
          shadow-md shadow-black/5
          transition-all duration-300 ease-out
          ${
            isFocused
              ? "ring-2 ring-blue-500/20 border-blue-300/60 shadow-lg shadow-blue-500/10"
              : "hover:border-gray-300/80 hover:shadow-lg hover:shadow-black/8"
          }
        `}
        >
          {/* Search Icon */}
          <div className="absolute left-3 flex items-center pointer-events-none">
            <svg
              className={`w-4 h-4 transition-colors duration-200 ${
                isFocused ? "text-blue-500" : "text-gray-400"
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* Input Field */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setError(null);
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder='Search: TPM AND (cloud OR "program manager") NOT sales'
            aria-invalid={Boolean(error)}
            aria-describedby="job-search-help"
            className="
              w-full
              pl-10 pr-16 py-2.5
              bg-transparent
              text-gray-800 placeholder-gray-500
              text-sm font-medium
              border-none outline-none
              rounded-xl
            "
          />

          {/* Search Button */}
          <button
            type="submit"
            className="
              absolute right-1.5
              p-2
              bg-gradient-to-r from-blue-600 to-blue-700
              hover:from-blue-700 hover:to-blue-800
              active:from-blue-800 active:to-blue-900
              text-white
              rounded-lg
              shadow-md shadow-blue-600/20
              hover:shadow-lg hover:shadow-blue-600/30
              active:scale-95
              transition-all duration-200 ease-out
              focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-1
              group
            "
          >
            <svg
              className="w-4 h-4 transition-transform duration-200 group-hover:scale-110"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </button>
        </div>

        {/* Subtle glow effect on focus */}
        <div
          className={`
          absolute inset-0 -z-10
          bg-gradient-to-r from-blue-600/8 to-purple-600/8
          rounded-xl blur-lg
          transition-opacity duration-300
          ${isFocused ? "opacity-100" : "opacity-0"}
        `}
        />
      </form>
      <p id="job-search-help" className={`mt-1 px-1 text-[11px] ${error ? "text-red-600" : "text-gray-500"}`}>
        {error || "Supports AND, OR, NOT, parentheses, quoted phrases, and implicit AND."}
      </p>
    </div>
  );
}
