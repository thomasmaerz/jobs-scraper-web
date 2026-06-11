"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  AlertTriangle,
} from "lucide-react";
import MarkdownRenderer from "./MarkdownRenderer"; // Assuming this is in the same directory or adjust path
import { Job } from "@/types"; // Assuming types are defined here

interface JobDetailsClientProps {
  initialJob: Job;
}

export default function JobDetailsClient({
  initialJob,
}: JobDetailsClientProps) {
  const [job, setJob] = useState<Job>(initialJob);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUpdatingInterest, setIsUpdatingInterest] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleViewResume = (
    job_id: string,
    resume_id: string | null | undefined
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    // Optionally preserve other query params if needed when navigating
    params.set("source", window.location.pathname);
    router.push(`/jobs/${job_id}/resumes/${resume_id}?${params.toString()}`);
  };

  const handleMarkAsApplied = async () => {
    if (job.status === "applied") {
      return;
    }

    setIsUpdating(true);
    try {
      const currentDate = new Date().toISOString();
      const response = await fetch(`/api/jobs/${job.job_id}`, {
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

      const updatedJob: Job = await response.json();
      setJob(updatedJob);
      showToast("Job marked as applied successfully!", "success");
      router.refresh(); // Refresh server-side props if needed, or update state locally
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
    setIsUpdatingInterest(true);
    let finalInterestValue: boolean | null;

    if (job.is_interested === newInterestValue) {
      finalInterestValue = null;
    } else {
      finalInterestValue = newInterestValue;
    }

    try {
      const response = await fetch(`/api/jobs/${job.job_id}`, {
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

      const updatedJob: Job = await response.json();
      setJob(updatedJob);

      const message =
        finalInterestValue === true
          ? "Marked as interested"
          : finalInterestValue === false
          ? "Marked as not interested"
          : "Interest status cleared";
      showToast(message, "success");
      router.refresh();
    } catch (error) {
      console.error("Error updating job interest:", error);
      const message =
        error instanceof Error ? error.message : "An unknown error occurred.";
      showToast(`Error: ${message}`, "error");
    } finally {
      setIsUpdatingInterest(false);
    }
  };

  const showToast = (message: string, type: "success" | "error") => {
    // Placeholder for a proper toast library
    console.log(`Toast (${type}): ${message}`);
    if (type === "error") {
      alert(`Error: ${message}`);
    } else {
      alert(message); // Simple alert for success for now
    }
  };

  // Determine the job listing URL based on the provider
  let jobUrl;
  if (job.provider === "careers_future") {
    jobUrl = `https://www.mycareersfuture.gov.sg/job/${job.job_id}`;
  } else {
    jobUrl = `https://www.linkedin.com/jobs/view/${job.job_id}`;
  }

  return (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden">
      {/* Header section */}
      <div className="bg-gray-50 border-b border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {job.job_title}
            </h1>
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center text-gray-600 space-y-2 sm:space-y-0 sm:space-x-6">
              <div className="flex items-center">
                <BuildingIcon className="h-5 w-5 mr-2 text-gray-500" />
                <span>{job.company}</span>
              </div>
              <div className="flex items-center">
                <MapPinIcon className="h-5 w-5 mr-2 text-gray-500" />
                <span>{job.location}</span>
              </div>
              <div className="flex items-center">
                <SocialLink className="h-5 w-5 mr-2 text-gray-500" />
                <span className="capitalize">
                  {job.provider === "careers_future"
                    ? "MyCareersFuture"
                    : "LinkedIn"}
                </span>
              </div>
            </div>
          </div>

          {job.resume_score && (
            <div className="flex-shrink-0 mt-4 sm:mt-0">
              <div className="flex items-center space-x-2 bg-indigo-50 px-4 py-2.5 rounded-lg border border-indigo-200">
                <BarChart3Icon className="h-6 w-6 text-indigo-600" />
                <div>
                  <div className="flex items-baseline">
                    <span className="text-2xl font-semibold text-indigo-700">
                      {job.resume_score}
                    </span>
                    <span className="ml-1 text-sm text-indigo-500">/100</span>
                  </div>
                  {job.resume_score_stage && (
                    <span className="text-xs text-indigo-500 block capitalize">
                      {job.resume_score_stage}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 mt-6">
          <Link
            href={jobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            View Job Listing
            <ExternalLink size={16} className="ml-2" />
          </Link>

          {job.customized_resumes?.resume_link && job.customized_resume_id && (
            <button
              onClick={() =>
                handleViewResume(job.job_id, job.customized_resume_id)
              }
              className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-md hover:bg-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
            >
              View Customized Resume
              <FileText size={16} className="ml-2" />
            </button>
          )}

          {job.status !== "applied" ? (
            <button
              onClick={handleMarkAsApplied}
              disabled={isUpdating}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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

          <div className="inline-flex rounded-md shadow-sm">
            <button
              onClick={() => handleSetInterest(true)}
              disabled={isUpdatingInterest}
              className={`relative inline-flex items-center px-3 py-2 rounded-l-md text-sm font-medium focus:z-10 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed
                ${
                  job.is_interested === true
                    ? "bg-green-600 text-white hover:bg-green-700"
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
              className={`relative inline-flex items-center px-3 py-2 rounded-r-md text-sm font-medium focus:z-10 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed border-l border-gray-300
                ${
                  job.is_interested === false
                    ? "bg-red-600 text-white hover:bg-red-700"
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
        </div>
      </div>

      {/* Scrollable content for description */}
      <div className="p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">
          Job Description
        </h3>
        {job.description ? (
          <div className="prose max-w-none prose-sm sm:prose lg:prose-lg xl:prose-xl">
            <MarkdownRenderer content={job.description} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-500 py-10">
            <AlertTriangle size={48} className="mb-4 text-yellow-500" />
            <p className="text-lg">No description available for this job.</p>
          </div>
        )}
      </div>
    </div>
  );
}
