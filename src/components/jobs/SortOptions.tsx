"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  SORT_OPTIONS,
  type SortField,
  type SortOrder,
} from "@/lib/filters/types";
import { resetResultPosition } from "@/lib/filters/searchParams";

interface SortOptionsProps {
  supportedSorts?: readonly SortField[];
  showApplicationSort?: boolean;
  showResumeScoreSort?: boolean;
}

export default function SortOptions({
  supportedSorts,
  showApplicationSort = true,
  showResumeScoreSort = true,
}: SortOptionsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const available =
    supportedSorts ??
    SORT_OPTIONS.filter((option) => {
      if (option.field === "application_date") return showApplicationSort;
      if (option.field === "resume_score") return showResumeScoreSort;
      return false;
    }).map((option) => option.field);
  const currentField = available.includes(searchParams.get("sortBy") as SortField)
    ? (searchParams.get("sortBy") as SortField)
    : undefined;
  const currentOrder: SortOrder =
    searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

  const sort = (field: SortField) => {
    const next = new URLSearchParams(searchParams.toString());
    const order: SortOrder =
      currentField === field && currentOrder === "desc" ? "asc" : "desc";
    next.set("sortBy", field);
    next.set("sortOrder", order);
    resetResultPosition(next);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Sort jobs">
      {SORT_OPTIONS.filter((option) => available.includes(option.field)).map(
        (option) => {
          const active = currentField === option.field;
          return (
            <button
              key={option.field}
              type="button"
              onClick={() => sort(option.field)}
              aria-pressed={active}
              aria-label={`${option.label}, ${active ? currentOrder : "not selected"}`}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
                active
                  ? "bg-gray-200 text-gray-900"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {option.label}
              {active &&
                (currentOrder === "asc" ? (
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                ))}
            </button>
          );
        }
      )}
    </div>
  );
}
