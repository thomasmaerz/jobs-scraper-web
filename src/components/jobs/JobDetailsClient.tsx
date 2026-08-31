"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BarChart3Icon,
  BuildingIcon,
  CheckCircle,
  ExternalLink,
  FileText,
  Link as SocialLink,
  MapPinIcon,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import MarkdownRenderer from "./MarkdownRenderer";
import ListingHistoryPanel from "./ListingHistoryPanel";
import LocalDateTime from "./LocalDateTime";
import type {
  Job,
  JobKeywordInsight,
  JobKeywordInsightCategory,
} from "@/types";
import {
  formatArchetype,
  formatLevel,
  formatFilterReason,
  hasSpecifiedLevel,
  formatPostedRelative,
  formatSalary,
  formatSourcePostedDate,
  getExternalJobUrl,
  getJobDisplayDate,
  sanitizeExternalUrl,
} from "@/lib/jobs/formatters";
import {
  getListingRecruiters,
} from "@/lib/jobs/repost";

interface JobDetailsClientProps {
  initialJob: Job;
  keywordInsights: JobKeywordInsight[];
}

const KEYWORD_GROUPS: Array<{
  category: JobKeywordInsightCategory;
  label: string;
  badgeColor: string;
}> = [
  {
    category: "skill",
    label: "Skills",
    badgeColor: "bg-blue-50 text-blue-700",
  },
  {
    category: "technology",
    label: "Technologies",
    badgeColor: "bg-teal-50 text-teal-700",
  },
  {
    category: "certification",
    label: "Certifications",
    badgeColor: "bg-amber-50 text-amber-800",
  },
  {
    category: "attribute",
    label: "Attributes",
    badgeColor: "bg-rose-50 text-rose-700",
  },
];

function MetadataRow({
  label,
  value,
  valueClassName = "text-gray-900",
}: {
  label: string;
  value: string | number;
  valueClassName?: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className={`break-words text-right font-medium ${valueClassName}`}>
        {value}
      </dd>
    </div>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function JobDetailsClient({
  initialJob,
  keywordInsights,
}: JobDetailsClientProps) {
  const [job, setJob] = useState<Job>(initialJob);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUpdatingInterest, setIsUpdatingInterest] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleViewResume = (
    jobId: string,
    resumeId: string | null | undefined,
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("source", window.location.pathname);
    router.push(`/jobs/${jobId}/resumes/${resumeId}?${params.toString()}`);
  };

  const patchJob = async (updates: Partial<Job>): Promise<Partial<Job>> => {
    const response = await fetch(`/api/jobs/${job.job_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.error || `HTTP error! status: ${response.status}`,
      );
    }

    return response.json();
  };

  const showToast = (message: string, type: "success" | "error") => {
    console.log(`Toast (${type}): ${message}`);
    alert(type === "error" ? `Error: ${message}` : message);
  };

  const handleMarkAsApplied = async () => {
    if (job.status === "applied") return;

    setIsUpdating(true);
    try {
      const updatedJob = await patchJob({
        status: "applied",
        application_date: new Date().toISOString(),
      });
      setJob((currentJob) => ({ ...currentJob, ...updatedJob }));
      showToast("Job marked as applied successfully!", "success");
      router.refresh();
    } catch (error) {
      console.error("Error marking job as applied:", error);
      showToast(
        error instanceof Error ? error.message : "An unknown error occurred.",
        "error",
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSetInterest = async (newInterestValue: boolean) => {
    setIsUpdatingInterest(true);
    const finalInterestValue =
      job.is_interested === newInterestValue ? null : newInterestValue;

    try {
      const updatedJob = await patchJob({ is_interested: finalInterestValue });
      setJob((currentJob) => ({ ...currentJob, ...updatedJob }));
      showToast(
        finalInterestValue === true
          ? "Marked as interested"
          : finalInterestValue === false
            ? "Marked as not interested"
            : "Interest status cleared",
        "success",
      );
      router.refresh();
    } catch (error) {
      console.error("Error updating job interest:", error);
      showToast(
        error instanceof Error ? error.message : "An unknown error occurred.",
        "error",
      );
    } finally {
      setIsUpdatingInterest(false);
    }
  };

  const jobUrl = getExternalJobUrl(job);
  const salaryDisplay = formatSalary(job);
  const listingRecruiters = getListingRecruiters(job);

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-lg">
      <header className="border-b border-gray-200 bg-gray-50 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-gray-900">
              {job.job_title || "Untitled job"}
            </h1>
            <div className="mt-3 flex flex-col gap-2 text-gray-600 sm:flex-row sm:flex-wrap sm:gap-x-6">
              {job.company && (
                <div className="flex items-center">
                  <BuildingIcon className="mr-2 h-5 w-5 text-gray-500" />
                  <span>{job.company}</span>
                </div>
              )}
              {job.location && (
                <div className="flex items-center">
                  <MapPinIcon className="mr-2 h-5 w-5 text-gray-500" />
                  <span>{job.location}</span>
                </div>
              )}
              {job.provider && (
                <div className="flex items-center">
                  <SocialLink className="mr-2 h-5 w-5 text-gray-500" />
                  <span>
                    {job.provider === "careers_future"
                      ? "MyCareersFuture"
                      : job.provider === "linkedin"
                        ? "LinkedIn"
                        : job.provider}
                  </span>
                </div>
              )}
            </div>
            <div className="mt-3 flex items-start justify-between gap-3 text-sm text-gray-600">
              <div className="flex flex-wrap gap-2">
                {hasSpecifiedLevel(job.level) && (
                  <span className="rounded bg-orange-100 px-2 py-0.5 font-medium text-orange-800">
                    {formatLevel(job.level)}
                  </span>
                )}
                {job.posted_relative_text && (
                  <span>{formatPostedRelative(job.posted_relative_text)}</span>
                )}
                {job.applicant_count != null && (
                  <span>{job.applicant_count} applicants</span>
                )}
                {salaryDisplay && <span>{salaryDisplay}</span>}
                {listingRecruiters.length > 0 && (
                  <span className="inline-flex flex-wrap gap-x-1">
                    <span>{listingRecruiters.length === 1 ? "Recruiter:" : "Recruiters:"}</span>
                    {listingRecruiters.map((recruiter, index) => {
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
                          ) : recruiter.name}
                        </span>
                      );
                    })}
                  </span>
                )}
              </div>
              {job.scraped_at && (
                <span className="shrink-0 text-right text-xs text-gray-400">
                  <LocalDateTime value={job.scraped_at} />
                </span>
              )}
            </div>
          </div>

          {job.resume_score != null && (
            <div className="flex shrink-0 items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5">
              <BarChart3Icon className="h-6 w-6 text-indigo-600" />
              <div>
                <div className="flex items-baseline">
                  <span className="text-2xl font-semibold text-indigo-700">
                    {job.resume_score}
                  </span>
                  <span className="ml-1 text-sm text-indigo-500">/100</span>
                </div>
                {job.resume_score_stage && (
                  <span className="block text-xs capitalize text-indigo-500">
                    {job.resume_score_stage}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {jobUrl && (
            <Link
              href={jobUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              View Job Listing
              <ExternalLink size={16} className="ml-2" />
            </Link>
          )}
          {job.customized_resumes?.resume_link && job.customized_resume_id && (
            <button
              onClick={() =>
                handleViewResume(job.job_id, job.customized_resume_id)
              }
              className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              View Customized Resume
              <FileText size={16} className="ml-2" />
            </button>
          )}
          {job.status !== "applied" ? (
            <button
              onClick={handleMarkAsApplied}
              disabled={isUpdating}
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle size={16} className="mr-2" />
              {isUpdating ? "Updating..." : "Mark as Applied"}
            </button>
          ) : (
            <div className="inline-flex items-center rounded-md bg-green-100 px-4 py-2 text-sm font-medium text-green-800">
              <CheckCircle size={16} className="mr-2" /> Applied
            </div>
          )}
          <div className="inline-flex rounded-md shadow-sm">
            <button
              onClick={() => handleSetInterest(true)}
              disabled={isUpdatingInterest}
              className={`inline-flex items-center rounded-l-md px-3 py-2 text-sm font-medium disabled:opacity-50 ${
                job.is_interested === true
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <ThumbsUp
                size={16}
                className="mr-2"
                fill={job.is_interested === true ? "currentColor" : "none"}
              />
              Interested
            </button>
            <button
              onClick={() => handleSetInterest(false)}
              disabled={isUpdatingInterest}
              className={`inline-flex items-center rounded-r-md border-l border-gray-300 px-3 py-2 text-sm font-medium disabled:opacity-50 ${
                job.is_interested === false
                  ? "bg-red-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <ThumbsDown
                size={16}
                className="mr-2"
                fill={job.is_interested === false ? "currentColor" : "none"}
              />
              Not Interested
            </button>
          </div>
          {getJobDisplayDate(job) && (
            <span className="ml-auto self-center text-xs text-gray-400">
              {getJobDisplayDate(job)!.label} {formatSourcePostedDate(getJobDisplayDate(job)!.value)}
            </span>
          )}
        </div>
      </header>

      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <main className="min-w-0">
          <h2 className="mb-4 text-xl font-semibold text-gray-800">
            Job Description
          </h2>
          {job.description ? (
            <div className="prose max-w-none prose-sm sm:prose lg:prose-lg">
              <MarkdownRenderer content={job.description} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-gray-500">
              <AlertTriangle size={48} className="mb-4 text-yellow-500" />
              <p className="text-lg">No description available for this job.</p>
            </div>
          )}
        </main>

        <aside className="space-y-4">
          <details open className="rounded-lg border border-gray-200 bg-white">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50">
              Filter Info
            </summary>
            <dl className="space-y-2 border-t border-gray-100 px-4 py-4 text-sm">
              {job.archetype && (
                <MetadataRow
                  label="Archetype"
                  value={formatArchetype(job.archetype)}
                />
              )}
              {job.filter_profile && (
                <MetadataRow label="Filter Profile" value={job.filter_profile} />
              )}
              {job.search_query && (
                <MetadataRow label="Search Query" value={job.search_query} />
              )}
              {job.is_filtered && (
                <MetadataRow
                  label="Filtered"
                  value="true"
                  valueClassName="text-red-700"
                />
              )}
              {job.is_filtered && job.filter_reason && (
                <MetadataRow
                  label="Filter Reason"
                  value={formatFilterReason(job.filter_reason)}
                  valueClassName="text-red-700"
                />
              )}
              {job.is_entry_level_filtered && (
                <MetadataRow
                  label="Entry Level Filtered"
                  value="true"
                  valueClassName="text-amber-700"
                />
              )}
              {!job.archetype &&
                !job.filter_profile &&
                !job.search_query &&
                !job.is_filtered &&
                !job.is_entry_level_filtered && (
                  <p className="text-gray-400">No filter metadata available.</p>
                )}
            </dl>
          </details>

          <details open className="rounded-lg border border-gray-200 bg-white">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50">
              Job Lifecycle
            </summary>
            <div className="space-y-4 border-t border-gray-100 px-4 py-4">
              <dl className="space-y-2 text-sm">
                {job.canonical_key && (
                  <MetadataRow label="Canonical Key" value={job.canonical_key} />
                )}
                {job.first_seen_at && (
                  <MetadataRow
                    label="First Seen"
                    value={formatDate(job.first_seen_at)}
                  />
                )}
                {job.last_seen_at && (
                  <MetadataRow
                    label="Last Seen"
                    value={formatDate(job.last_seen_at)}
                  />
                )}
                {job.repost_count != null && (
                  <MetadataRow
                    label="Repost Count"
                    value={job.repost_count}
                  />
                )}
                {job.posting_wave_count != null && (
                  <MetadataRow label="Posting Waves" value={job.posting_wave_count} />
                )}
                {job.seen_count != null && (
                  <MetadataRow label="Source Listing IDs" value={job.seen_count} />
                )}
                {job.original_job_id && (
                  <MetadataRow
                    label="Original Job ID"
                    value={job.original_job_id}
                  />
                )}
                {job.latest_job_id && (
                  <MetadataRow label="Latest Job ID" value={job.latest_job_id} />
                )}
              </dl>

              {job.listing_instances?.length ? <ListingHistoryPanel job={job} /> : (
                <p className="text-sm text-gray-400">No listing instances available.</p>
              )}
            </div>
          </details>

          <details open className="rounded-lg border border-gray-200 bg-white">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50">
              Keyword Insights
            </summary>
            <div className="space-y-4 border-t border-gray-100 px-4 py-4">
              {keywordInsights.length === 0 ? (
                <p className="text-sm text-gray-400">No keywords available.</p>
              ) : (
                KEYWORD_GROUPS.map(({ category, label, badgeColor }) => {
                  const items = keywordInsights.filter(
                    (insight) => insight.category === category,
                  );
                  if (items.length === 0) return null;

                  return (
                    <section key={category}>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {label}
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((insight) => (
                          <span
                            key={`${insight.category}-${insight.keyword}-${insight.archetype}`}
                            className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${badgeColor}`}
                          >
                            {insight.keyword}
                          </span>
                        ))}
                      </div>
                    </section>
                  );
                })
              )}
            </div>
          </details>
        </aside>
      </div>
    </div>
  );
}
