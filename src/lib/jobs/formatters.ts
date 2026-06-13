import type { Job } from "../../types";

export function getExternalJobPostingId(job: Job): string {
  return job.latest_job_id || job.job_id;
}

export function getExternalJobUrl(job: Job): string {
  const listingId = getExternalJobPostingId(job);

  if (job.provider === "careers_future") {
    return `https://www.mycareersfuture.gov.sg/job/${listingId}`;
  }

  return `https://www.linkedin.com/jobs/view/${listingId}`;
}

export function formatSalary(job: Job): string | null {
  if (job.salary_text) return job.salary_text;

  if (job.salary_min != null && job.salary_max != null) {
    const currency = job.salary_currency ? ` ${job.salary_currency}` : "";
    return `$${job.salary_min.toLocaleString()}-$${job.salary_max.toLocaleString()}${currency}`;
  }

  return null;
}
