"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Filter } from "lucide-react";

import JobFiltersSidebar from "./JobFiltersSidebar";
import type { FilterId } from "@/lib/filters/types";

interface FilterButtonProps {
  disabled?: boolean;
  className?: string;
  supportedFilters?: readonly FilterId[];
  knownArchetypes?: readonly string[];
  providerOptions?: boolean;
  interestOptions?: boolean;
  scoreOptions?: boolean;
  applicationStatusOptions?: boolean;
}

const DEFAULT_FILTERS: readonly FilterId[] = [
  "provider",
  "interest",
  "score",
  "level",
  "archetype",
  "filterStatus",
  "hasSalary",
  "salaryRange",
  "repostCount",
  "seenCount",
  "datePosted",
];

export default function FilterButton({
  disabled = false,
  className = "",
  supportedFilters,
  knownArchetypes,
  providerOptions = true,
  interestOptions = true,
  scoreOptions = true,
  applicationStatusOptions = false,
}: FilterButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const sidebarId = "job-filters-sidebar";

  const filters =
    supportedFilters ??
    DEFAULT_FILTERS.filter((filter) => {
      if (filter === "provider") return providerOptions;
      if (filter === "interest") return interestOptions;
      if (filter === "score") return scoreOptions;
      return true;
    }).concat(applicationStatusOptions ? ["applicationStatus"] : []);

  const close = useCallback(() => {
    setIsOpen(false);
    window.requestAnimationFrame(() => buttonRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const isMobile = !window.matchMedia("(min-width: 64rem)").matches;
    const previousOverflow = document.body.style.overflow;
    if (isMobile) document.body.style.overflow = "hidden";
    const sidebar = document.getElementById(sidebarId);
    sidebar?.querySelector<HTMLElement>("button, input, summary")?.focus();
    return () => {
      if (isMobile) document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-expanded={isOpen}
        aria-controls={sidebarId}
        onClick={() => setIsOpen((open) => !open)}
        className={`inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        <Filter className="h-4 w-4" aria-hidden="true" />
        Filters
      </button>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open filters"
          aria-controls={sidebarId}
          className="fixed right-0 top-1/2 z-30 flex -translate-y-1/2 items-center justify-center rounded-l-xl border border-r-0 border-gray-300 bg-white px-2 py-4 text-gray-700 shadow-lg transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          <Filter className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
      <JobFiltersSidebar
        id={sidebarId}
        supportedFilters={filters}
        knownArchetypes={knownArchetypes}
        isOpen={isOpen}
        onClose={close}
      />
    </>
  );
}
