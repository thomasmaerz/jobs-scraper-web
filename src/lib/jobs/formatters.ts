import type { Job } from "../../types";

export function getExternalJobPostingId(job: Job): string {
  return job.latest_job_id || job.job_id;
}

export function sanitizeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return null;
    }

    return parsedUrl.toString();
  } catch {
    return null;
  }
}

export function getExternalJobUrl(job: Job): string | null {
  const listingId = getExternalJobPostingId(job);

  if (job.provider === "careers_future") {
    return `https://www.mycareersfuture.gov.sg/job/${listingId}`;
  }

  if (job.provider === "linkedin") {
    return `https://www.linkedin.com/jobs/view/${listingId}`;
  }

  return null;
}

export function formatSalary(job: Job): string | null {
  if (job.salary_text) return job.salary_text;

  if (job.salary_min != null && job.salary_max != null) {
    if (job.salary_currency) {
      try {
        const formatter = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: job.salary_currency,
        });

        return `${formatter.format(job.salary_min)}-${formatter.format(job.salary_max)}`;
      } catch {
        return `${job.salary_min.toLocaleString()}-${job.salary_max.toLocaleString()} ${job.salary_currency}`;
      }
    }

    return `${job.salary_min.toLocaleString()}-${job.salary_max.toLocaleString()}`;
  }

  return null;
}

export function formatLevel(level: string | null | undefined): string {
  if (!level) return "";

  const normalized = level.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const labels: Record<string, string> = {
    not_applicable: "Not Applicable",
    not_applicable_level: "Not Applicable",
    n_a: "Not Applicable",
    na: "Not Applicable",
    entry: "Entry",
    entry_level: "Entry",
    associate: "Associate",
    associate_level: "Associate",
    mid_senior: "Mid-Senior",
    mid_senior_level: "Mid-Senior",
    midsenior: "Mid-Senior",
    senior: "Senior",
    senior_level: "Senior",
    director: "Director",
    director_level: "Director",
    executive: "Executive",
    executive_level: "Executive",
    internship: "Internship",
    internship_level: "Internship",
    intern: "Internship",
  };

  return labels[normalized] ?? level;
}

export function formatSeenCount(count: number | null | undefined): string {
  return count != null && count > 0 ? `Seen ${count}x` : "";
}

export function formatFilterReason(
  reason: string | null | undefined,
): string {
  return reason ? `filtered: ${reason}` : "";
}

export function formatRepostCount(count: number | null | undefined): string {
  if (count == null || count <= 0) return "";
  return count === 1 ? "Reposted 1 time" : `Reposted ${count} times`;
}
