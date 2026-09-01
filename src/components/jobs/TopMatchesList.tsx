"use client";

import { useState, useEffect, useRef } from "react"; // Added useEffect
import Link from "next/link";
import PaginationControls from "./PaginationControls";
import {
  ExternalLink,
  CheckCircle,
  ThumbsUp,
  ThumbsDown,
  BuildingIcon,
  MapPinIcon,
  BarChart3Icon,
  FileText,
  Link as SocialLink,
} from "lucide-react";
import MarkdownRenderer from "./MarkdownRenderer";
import ListingHistoryPanel from "./ListingHistoryPanel";
import LocalDateTime from "./LocalDateTime";
import { Job } from "@/types";
import { useRouter, useSearchParams } from "next/navigation"; // Added useSearchParams
import {
  formatFilterReason,
  formatArchetype,
  formatLevel,
  hasSpecifiedLevel,
  formatPostedRelative,
  formatRepostCount,
  formatSalary,
  formatSourcePostedDate,
  getExternalJobUrl,
  getJobDisplayDate,
  sanitizeExternalUrl,
} from "@/lib/jobs/formatters";
import {
  getListingRecruiters,
  hasListingVariants,
} from "@/lib/jobs/repost";
import { jobDetailHref } from "@/lib/jobs/detailLink";

interface TopMatchesListProps {
  jobs: Job[];
  currentPage: number;
  totalPages: number;
  pageSize: 10 | 25 | 100 | "all";
  listTitle?: string;
}

function getLevelBadgeColor(level: string | null): string {
  switch (formatLevel(level)) {
    case "Entry":
    case "Associate":
    case "Internship":
      return "bg-teal-100 text-teal-800";
    case "Mid-Senior":
    case "Senior":
      return "bg-orange-100 text-orange-800";
    case "Director":
    case "Executive":
      return "bg-violet-100 text-violet-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export default function TopMatchesList({
  jobs,
  currentPage,
  totalPages,
  pageSize,
  listTitle = "Job Matches",
}: TopMatchesListProps) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null); // Initialize as null
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUpdatingInterest, setIsUpdatingInterest] = useState(false);
  const jobCardRefs = useRef<Array<HTMLLIElement | null>>([]);
  const router = useRouter();
  const searchParams = useSearchParams(); // Get searchParams

  useEffect(() => {
    const selectedJobIdFromUrl = searchParams.get("selectedJobId");
    let jobToSelect: Job | null = null;

    if (selectedJobIdFromUrl) {
      // Try to find the job from the URL ID in the *current* jobs list
      jobToSelect =
        jobs.find((job) => job.job_id === selectedJobIdFromUrl) || null;
    }

    // If job from URL ID is not found (jobToSelect is null) or no ID in URL,
    // and there are jobs in the list, default to the first job.
    if (!jobToSelect && jobs.length > 0) {
      jobToSelect = jobs[0];
      // Update URL with the default selected job ID if it's missing
      if (!selectedJobIdFromUrl) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("selectedJobId", jobToSelect.job_id);
        router.replace(`${window.location.pathname}?${params.toString()}`, {
          scroll: false,
        });
      }
    }
    // If jobs list is empty, ensure jobToSelect is null.
    else if (jobs.length === 0) {
      jobToSelect = null;
    }

    // Update state only if the selected job (by ID) is different,
    // or if jobToSelect is null and selectedJob is not (or vice-versa).
    if (selectedJob?.job_id !== jobToSelect?.job_id) {
      setSelectedJob(jobToSelect);
    }
  }, [jobs, searchParams]); // Dependencies are jobs and searchParams

  const handleViewResume = (
    job_id: string,
    resume_id: string | null | undefined,
  ) => {
    // Preserve current search params and add source page info
    const params = new URLSearchParams(searchParams.toString());
    if (selectedJob) {
      params.set("selectedJobId", selectedJob.job_id);
    }
    params.set("source", window.location.pathname);
    router.push(`/jobs/${job_id}/resumes/${resume_id}?${params.toString()}`);
  };

  const handleJobSelect = (job: Job) => {
    setSelectedJob(job);
    // Update URL with selected job ID without adding to history
    const params = new URLSearchParams(searchParams.toString());
    params.set("selectedJobId", job.job_id);
    // Use replace to avoid polluting browser history for selections on the same page
    router.replace(`${window.location.pathname}?${params.toString()}`, {
      scroll: false,
    });
  };

  const handleJobCardKeyDown = (
    event: React.KeyboardEvent<HTMLLIElement>,
    index: number,
  ) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

    const nextIndex = event.key === "ArrowDown" ? index + 1 : index - 1;
    const nextJob = jobs[nextIndex];
    if (!nextJob) return;

    event.preventDefault();
    handleJobSelect(nextJob);
    jobCardRefs.current[nextIndex]?.focus();
    jobCardRefs.current[nextIndex]?.scrollIntoView({ block: "nearest" });
  };

  const handleMarkAsApplied = async () => {
    if (!selectedJob || selectedJob.status === "applied") {
      return;
    }

    setIsUpdating(true);
    try {
      const currentDate = new Date().toISOString();
      const response = await fetch(`/api/jobs/${selectedJob.job_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "applied",
          application_date: currentDate,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage =
          errorData?.error || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      const updatedJob: Partial<Job> = await response.json();
      setSelectedJob((currentJob) =>
        currentJob ? { ...currentJob, ...updatedJob } : currentJob,
      );
      // Toast notification instead of alert
      showToast("Job marked as applied successfully!", "success");
      router.refresh(); // Refresh the page to show updated jobs
    } catch (error) {
      console.error("Error marking job as applied:", error);
      const message =
        error instanceof Error ? error.message : "An unknown error occurred.";
      showToast(`Error: ${message}`, "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSetInterest = async (newInterestValue: boolean | null) => {
    if (!selectedJob) {
      return;
    }

    setIsUpdatingInterest(true);
    let finalInterestValue: boolean | null;

    // If the button clicked matches the current state, set to null (toggle off)
    if (selectedJob.is_interested === newInterestValue) {
      finalInterestValue = null;
    } else {
      finalInterestValue = newInterestValue;
    }

    try {
      const response = await fetch(`/api/jobs/${selectedJob.job_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          is_interested: finalInterestValue,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage =
          errorData?.error || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      const updatedJob: Partial<Job> = await response.json();
      setSelectedJob((currentJob) =>
        currentJob ? { ...currentJob, ...updatedJob } : currentJob,
      );

      // Show toast instead of alert
      const message =
        finalInterestValue === true
          ? "Marked as interested"
          : finalInterestValue === false
            ? "Marked as not interested"
            : "Interest status cleared";
      showToast(message, "success");
      router.refresh(); // Refresh the page to show updated jobs
    } catch (error) {
      console.error("Error updating job interest:", error);
      const message =
        error instanceof Error ? error.message : "An unknown error occurred.";
      showToast(`Error: ${message}`, "error");
    } finally {
      setIsUpdatingInterest(false);
    }
  };

  // Simple toast notification function (you may want to replace with a proper toast library)
  const showToast = (message: string, type: "success" | "error") => {
    // This is a placeholder - you would implement a proper toast notification
    // Consider using react-hot-toast, react-toastify, or a similar library
    console.log(`Toast (${type}): ${message}`);
    // For now, we'll use a simple alert as a fallback
    if (type === "error") {
      alert(message);
    }
  };

  // Function to determine badge color based on resume score
  const getScoreBadgeColor = (score: number) => {
    if (score >= 0.8) return "bg-green-100 text-green-800 border-green-300";
    if (score >= 0.6) return "bg-blue-100 text-blue-800 border-blue-300";
    if (score >= 0.4) return "bg-yellow-100 text-yellow-800 border-yellow-300";
    return "bg-gray-100 text-gray-800 border-gray-300";
  };

  // Placeholder for empty state
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="bg-gray-100 p-6 rounded-full mb-4">
        <BuildingIcon className="h-12 w-12 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs found</h3>
      <p className="text-gray-500 max-w-sm">
        No top-matched jobs found for this page. Try adjusting your search or
        checking back later.
      </p>
    </div>
  );

  const selectedJobSalary = selectedJob ? formatSalary(selectedJob) : null;
  const selectedJobRecruiters = selectedJob
    ? getListingRecruiters(selectedJob)
    : [];
  const selectedJobUrl = selectedJob ? getExternalJobUrl(selectedJob) : null;

  return (
    <div className="flex flex-col gap-6 rounded-lg bg-gray-50 shadow-sm md:min-h-0 md:flex-1 md:items-start md:flex-row md:overflow-visible">
      {/* Left Column: Job List */}
      <div className="w-full md:w-1/3 bg-white border-r border-gray-100 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">{listTitle}</h2>
          <p className="text-sm text-gray-500">
            {jobs.length} {jobs.length === 1 ? "result" : "results"} found
          </p>
        </div>

        {jobs.length > 0 ? (
          <>
            <ul className="divide-y divide-gray-100 overflow-y-auto flex-grow">
              {jobs.map((job, index) => (
                <li
                  key={job.job_id}
                  ref={(element) => { jobCardRefs.current[index] = element; }}
                  tabIndex={0}
                  aria-current={selectedJob?.job_id === job.job_id ? "true" : undefined}
                  onClick={(event) => {
                    event.currentTarget.focus();
                    handleJobSelect(job);
                  }}
                  onKeyDown={(event) => handleJobCardKeyDown(event, index)}
                  className={`p-4 cursor-pointer transition-all duration-200 hover:bg-gray-50 ${
                    selectedJob?.job_id === job.job_id
                      ? "bg-indigo-50 border-l-4 border-indigo-500"
                      : "border-l-4 border-transparent"
                  } focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-md font-medium text-gray-900 truncate">
                        {job.job_title}
                      </h3>
                      <div className="mt-1 flex items-center text-sm text-gray-500">
                        <BuildingIcon className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
                        <span className="truncate">{job.company}</span>
                      </div>
                      <div className="mt-1 flex items-center text-sm text-gray-500">
                        <MapPinIcon className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
                        <span className="truncate">{job.location}</span>
                      </div>
                      <div className="mt-1 flex items-center text-xs text-gray-400">
                        <SocialLink className="h-3 w-3 mr-1 flex-shrink-0" />
                        <span className="capitalize truncate">
                          {job.provider === "careers_future"
                            ? "MyCareersFuture"
                            : "LinkedIn"}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                        {job.posted_relative_text && (
                          <span>{formatPostedRelative(job.posted_relative_text)}</span>
                        )}
                        {job.applicant_count != null && <span>{job.applicant_count} applicants</span>}
                        {formatSalary(job) && <span>{formatSalary(job)}</span>}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {hasSpecifiedLevel(job.level) && (
                          <span
                            className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${getLevelBadgeColor(job.level)}`}
                          >
                            {formatLevel(job.level)}
                          </span>
                        )}
                        {job.archetype && (
                          <span className="inline-flex rounded bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                            {formatArchetype(job.archetype)}
                          </span>
                        )}
                        {formatRepostCount(job.repost_count) && (
                          <span className="text-xs text-gray-500">
                            {formatRepostCount(job.repost_count)}
                          </span>
                        )}
                        {job.is_filtered && job.filter_reason && (
                          <span className="inline-flex rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            {formatFilterReason(job.filter_reason)}
                          </span>
                        )}
                      </div>
                    </div>

                    {job.resume_score && (
                      <div
                        className={`flex-shrink-0 ml-2 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getScoreBadgeColor(
                          job.resume_score,
                        )}`}
                      >
                        {job.resume_score}
                      </div>
                    )}
                  </div>

                  {/* Status indicators */}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {job.status === "applied" && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Applied
                      </span>
                    )}
                    {(job.job_state === "expired" || job.is_active === false) && (
                      <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
                        Expired
                      </span>
                    )}
                    {job.is_interested === true && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <ThumbsUp className="h-3 w-3 mr-1" />
                        Interested
                      </span>
                    )}
                    {job.is_interested === false && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <ThumbsDown className="h-3 w-3 mr-1" />
                        Not Interested
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="p-4 border-t border-gray-100 bg-white">
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
              />
            </div>
          </>
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Right Column: Job Details */}
      <div className="w-full bg-white md:sticky md:top-20 md:max-h-[calc(100vh-6rem)] md:w-2/3 md:self-start md:overflow-y-auto">
        {selectedJob ? (
          <div className="h-full flex flex-col">
            {/* Header section with fixed position */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedJob.job_title}
                  </h2>
                  <div className="mt-2 flex items-center text-gray-700 space-x-4">
                    <div className="flex items-center">
                      <BuildingIcon className="h-4 w-4 mr-1.5 text-gray-500" />
                      <span>{selectedJob.company}</span>
                    </div>
                    <div className="flex items-center">
                      <MapPinIcon className="h-4 w-4 mr-1.5 text-gray-500" />
                      <span>{selectedJob.location}</span>
                    </div>
                    <div className="flex items-center">
                      <SocialLink className="h-4 w-4 mr-1.5 text-gray-500" />
                      <span className="capitalize truncate">
                        {selectedJob.provider === "careers_future"
                          ? "MyCareersFuture"
                          : "LinkedIn"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-start justify-between gap-3 text-sm text-gray-600">
                    <div className="flex flex-wrap gap-2">
                      {selectedJob.posted_relative_text && (
                        <span>{formatPostedRelative(selectedJob.posted_relative_text)}</span>
                      )}
                      {selectedJob.applicant_count != null && (
                        <span>{selectedJob.applicant_count} applicants</span>
                      )}
                      {selectedJobSalary && <span>{selectedJobSalary}</span>}
                      {selectedJobRecruiters.length > 0 && (
                        <span className="inline-flex flex-wrap gap-x-1">
                          <span>{selectedJobRecruiters.length === 1 ? "Recruiter:" : "Recruiters:"}</span>
                          {selectedJobRecruiters.map((recruiter, index) => {
                            const profileUrl = sanitizeExternalUrl(recruiter.profileUrl);
                            return (
                              <span key={`${recruiter.name}-${index}`}>
                                {index > 0 ? ", " : ""}
                                {profileUrl ? (
                                  <a
                                    href={profileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                                  >
                                    {recruiter.name}
                                  </a>
                                ) : (
                                  recruiter.name
                                )}
                              </span>
                            );
                          })}
                        </span>
                      )}
                    </div>
                    {selectedJob.scraped_at && (
                      <span className="shrink-0 text-right text-xs text-gray-400">
                        <LocalDateTime value={selectedJob.scraped_at} />
                      </span>
                    )}
                  </div>
                </div>

                {selectedJob.resume_score && (
                  <div className="flex items-center space-x-1.5 bg-gray-50 px-3 py-2 rounded-lg">
                    <BarChart3Icon className="h-4 w-4 text-gray-500" />
                    <div>
                      <div className="flex items-baseline">
                        <span className="text-lg font-semibold text-gray-900">
                          {selectedJob.resume_score}
                        </span>
                        <span className="ml-1 text-xs text-gray-500">/100</span>
                      </div>
                      {selectedJob.resume_score_stage && (
                        <span className="text-xs text-gray-500 block">
                          {selectedJob.resume_score_stage
                            .charAt(0)
                            .toUpperCase() +
                            selectedJob.resume_score_stage.slice(1)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3 mt-5">
                <Link
                  href={jobDetailHref(selectedJob.job_id, searchParams)}
                  className="inline-flex items-center px-4 py-2 border border-indigo-200 text-indigo-700 text-sm font-medium rounded-md hover:bg-indigo-50 transition-colors"
                >
                  View Details
                </Link>
                {selectedJobUrl && (
                  <Link
                    href={selectedJobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    View Job Listing
                    <ExternalLink size={16} className="ml-2" />
                  </Link>
                )}

                {selectedJob.customized_resume_id && (
                  <button
                    onClick={() =>
                      handleViewResume(
                        selectedJob.job_id,
                        selectedJob.customized_resume_id,
                      )
                    }
                    className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-md hover:bg-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                  >
                    View Resume
                    <FileText size={16} className="ml-2" />
                    {/* You can add an icon here too */}
                  </button>
                )}

                {selectedJob.status !== "applied" ? (
                  <button
                    onClick={handleMarkAsApplied}
                    disabled={isUpdating}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <CheckCircle size={16} className="mr-2" />
                    {isUpdating ? "Updating..." : "Mark as Applied"}
                  </button>
                ) : (
                  <div className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 text-sm font-medium rounded-md">
                    <CheckCircle size={16} className="mr-2" />
                    Applied
                  </div>
                )}

                {/* Interest buttons */}
                <div className="inline-flex rounded-md shadow-sm">
                  <button
                    onClick={() => handleSetInterest(true)}
                    disabled={isUpdatingInterest}
                    className={`relative cursor-pointer inline-flex items-center px-3 py-2 rounded-l-md text-sm font-medium focus:z-10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed
                      ${
                        selectedJob.is_interested === true
                          ? "bg-green-600 text-white hover:bg-green-700"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                  >
                    <ThumbsUp
                      size={16}
                      className="mr-2"
                      fill={
                        selectedJob.is_interested === true
                          ? "currentColor"
                          : "none"
                      }
                    />
                    Interested
                  </button>

                  <button
                    onClick={() => handleSetInterest(false)}
                    disabled={isUpdatingInterest}
                    className={`relative cursor-pointer inline-flex items-center px-3 py-2 rounded-r-md text-sm font-medium focus:z-10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed border-l border-gray-300
                      ${
                        selectedJob.is_interested === false
                          ? "bg-red-600 text-white hover:bg-red-700"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                  >
                    <ThumbsDown
                      size={16}
                      className="mr-2"
                      fill={
                        selectedJob.is_interested === false
                          ? "currentColor"
                          : "none"
                      }
                    />
                    Not Interested
                  </button>
                </div>
                {getJobDisplayDate(selectedJob) && (
                  <span className="ml-auto text-xs text-gray-400 self-center">
                    {getJobDisplayDate(selectedJob)!.label} {formatSourcePostedDate(getJobDisplayDate(selectedJob)!.value)}
                  </span>
                )}
              </div>
            </div>

            {hasListingVariants(selectedJob) && (
              <div className="px-6 pt-4">
                <details>
                  <summary className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-3 font-medium text-slate-900 shadow-sm hover:bg-slate-50">
                    Listing history and posting waves
                  </summary>
                  <div className="mt-3"><ListingHistoryPanel job={selectedJob} /></div>
                </details>
              </div>
            )}

            {/* Scrollable content for description */}
            <div className="p-6 flex-grow">
              <div className="prose max-w-none">
                <MarkdownRenderer content={selectedJob.description || ""} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <EmptyState />
          </div>
        )}
      </div>
    </div>
  );
}
