import type { Job } from "../../types";

export function getExternalJobPostingId(job: Job): string {
  return job.latest_job_id || job.job_id;
}

export function getLatestPostedAt(job: Job): string | null {
  if (job.effective_posted_at) return job.effective_posted_at;
  const values = [job.posted_at, job.last_seen_posted_at].filter(
    (value): value is string => Boolean(value),
  );
  return values.reduce<string | null>((latest, value) => {
    if (!latest) return value;
    return Date.parse(value) > Date.parse(latest) ? value : latest;
  }, null);
}

export function getJobDisplayDate(job: Job): {
  label: "Posted" | "Scraped";
  value: string;
} | null {
  const postedAt = getLatestPostedAt(job);
  if (postedAt) return { label: "Posted", value: postedAt };
  if (job.scraped_at) return { label: "Scraped", value: job.scraped_at };
  return null;
}

export function formatSourcePostedDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
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

export function getLinkedInListingUrl(jobId: string | null | undefined): string | null {
  const listingId = jobId?.trim();
  if (!listingId || !/^\d+$/.test(listingId)) return null;
  return `https://www.linkedin.com/jobs/view/${listingId}`;
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

export function formatPostedRelative(
  relativeText: string | null | undefined,
): string {
  if (!relativeText) return "";
  const elapsed = relativeText.trim().replace(/\s+ago$/i, "");
  return `Listed ${elapsed} before scrape`;
}

export function formatLevel(level: string | null | undefined): string {
  if (!level) return "";

  const normalized = level.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const labels: Record<string, string> = {
    not_applicable: "Seniority unspecified",
    not_applicable_level: "Seniority unspecified",
    n_a: "Seniority unspecified",
    na: "Seniority unspecified",
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

export function hasSpecifiedLevel(level: string | null | undefined): boolean {
  return Boolean(level && formatLevel(level) !== "Seniority unspecified");
}

export function formatArchetype(archetype: string | null | undefined): string {
  if (!archetype) return "";
  if (archetype.trim().toLowerCase() === "software_tpm") return "Software TPM";
  return archetype.replaceAll("_", " ");
}

export function formatFilterReason(
  reason: string | null | undefined,
): string {
  if (!reason) return "";

  const normalized = reason.toLowerCase();
  const source = reason.split(":", 1)[0];
  let label: string;

  if (normalized.includes("account manager")) {
    label = "account management";
  } else if (normalized.includes("customer success")) {
    label = "customer success";
  } else if (normalized.includes("clinical")) {
    label = "clinical";
  } else if (normalized.includes("jobgether")) {
    label = "job aggregator listing";
  } else if (
    [
      "construction",
      "subcontract",
      "general contractor",
      "preconstruction",
      "site inspection",
      "civil engineering",
      "epcm",
      "procore",
      "shop drawings",
      "subtrade",
      "tenant improvement",
      "land development",
      "natural and built assets",
      "mep",
      "ici",
    ].some((term) => normalized.includes(term))
  ) {
    label = "construction";
  } else if (source === "title_entry_level") {
    label = "entry-level";
  } else if (source === "title") {
    label = "matched an exclusion rule";
  } else if (source === "company") {
    label = "company matched an exclusion rule";
  } else {
    label = "description matched an exclusion rule";
  }

  return `Filtered: ${label}`;
}

export function formatRepostCount(
  count: number | null | undefined,
): string {
  if (count == null || count <= 0) return "";
  return `${count} confirmed repost${count === 1 ? "" : "s"}`;
}
