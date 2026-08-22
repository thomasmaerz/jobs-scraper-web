"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  pageSize: 10 | 25 | 100 | "all";
}

export default function PaginationControls({
  currentPage,
  totalPages,
  pageSize,
}: PaginationControlsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const navigate = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams);
    mutate(params);
    const query = params.toString();
    router.push(query ? `?${query}` : "?");
  };

  const goToPage = (page: number) => {
    navigate((params) => {
      params.set("page", page.toString());
      params.delete("selectedJobId");
    });
  };

  const changePageSize = (value: string) => {
    navigate((params) => {
      if (value === "25") params.delete("pageSize");
      else params.set("pageSize", value);
      params.delete("page");
      params.delete("selectedJobId");
    });
  };

  const getPageNumbers = () => {
    if (totalPages <= 3) return Array.from({ length: totalPages }, (_, index) => index + 1);
    if (currentPage <= 2) return [1, 2, 3];
    if (currentPage >= totalPages - 1) return [totalPages - 2, totalPages - 1, totalPages];
    return [currentPage - 1, currentPage, currentPage + 1];
  };

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-1 text-sm">
      <div className="flex items-center space-x-1">
        {totalPages > 1 && (
          <>
            <button
              type="button"
              onClick={() => currentPage > 1 && goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-label="Previous page"
              className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {getPageNumbers().map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => goToPage(page)}
                aria-current={page === currentPage ? "page" : undefined}
                className={`flex h-7 min-w-7 items-center justify-center rounded px-2 text-xs font-medium ${
                  page === currentPage
                    ? "bg-indigo-600 text-white"
                    : "border border-gray-200 text-gray-600 hover:bg-gray-100"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              onClick={() => currentPage < totalPages && goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
              className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      <label className="flex items-center gap-1.5 text-xs text-gray-600">
        <span>Rows</span>
        <select
          value={pageSize}
          onChange={(event) => changePageSize(event.target.value)}
          aria-label="Jobs per page"
          className="rounded-md border-gray-300 py-1 pl-2 pr-7 text-xs focus:border-indigo-500 focus:ring-indigo-500"
        >
          <option value="10">10</option>
          <option value="25">25</option>
          <option value="100">100</option>
          <option value="all">Unlimited</option>
        </select>
      </label>

      <div className="justify-self-end text-xs text-gray-500">
        {pageSize === "all" ? "All jobs" : `Page ${currentPage} of ${totalPages}`}
      </div>
    </div>
  );
}
