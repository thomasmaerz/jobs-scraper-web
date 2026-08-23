import type { Job, ListingInstance } from "../../types";

export function getListingInstances(job: Job): ListingInstance[] {
  return Array.isArray(job.listing_instances) ? job.listing_instances : [];
}

export function hasListingVariants(job: Job): boolean {
  return (job.repost_count || 0) > 0 || getListingInstances(job).length > 1;
}

export function getLatestListingInstance(job: Job): ListingInstance | null {
  const instances = getListingInstances(job);

  if (!instances.length) return null;

  return getSortedListingInstances(job)[0] ?? null;
}

export function getSortedListingInstances(job: Job): ListingInstance[] {
  return [...getListingInstances(job)].sort((a, b) => {
    if (a.scraped_at === b.scraped_at) return 0;
    return a.scraped_at < b.scraped_at ? 1 : -1;
  });
}

export interface PostingWaveGroup {
  key: string;
  index: number;
  location: string | null;
  postedAt: string | null;
  instances: ListingInstance[];
  isConfirmedRepost: boolean;
}

export function getPostingWaveGroups(job: Job): PostingWaveGroup[] {
  const groups = new Map<string, PostingWaveGroup>();

  for (const instance of getSortedListingInstances(job)) {
    const key = instance.posting_wave_key || `legacy:${instance.job_id}`;
    const existing = groups.get(key);
    if (existing) {
      existing.instances.push(instance);
      continue;
    }
    groups.set(key, {
      key,
      index: instance.posting_wave_index || 1,
      location: instance.location || null,
      postedAt: instance.posted_at || null,
      instances: [instance],
      isConfirmedRepost: instance.variant_type === "repost" || (instance.posting_wave_index || 1) > 1,
    });
  }

  return [...groups.values()].sort((a, b) => {
    const left = a.postedAt || a.instances[0]?.scraped_at || "";
    const right = b.postedAt || b.instances[0]?.scraped_at || "";
    return right.localeCompare(left);
  });
}

export function getDistinctListingLocations(job: Job): string[] {
  return [...new Set(
    getListingInstances(job)
      .map((instance) => instance.location?.trim())
      .filter((location): location is string => Boolean(location)),
  )].sort();
}

export interface ListingRecruiter {
  name: string;
  profileUrl: string | null;
}

export function getListingRecruiters(job: Job): ListingRecruiter[] {
  const candidates = [
    {
      name: job.recruiter_name,
      profileUrl: job.recruiter_profile_url,
      identifier: job.recruiter_identifier,
    },
    ...getListingInstances(job).map((instance) => ({
      name: instance.recruiter_name,
      profileUrl: instance.recruiter_profile_url,
      identifier: instance.recruiter_identifier,
    })),
  ];
  const recruiters = new Map<string, ListingRecruiter>();

  for (const candidate of candidates) {
    if (!candidate.name) continue;
    const key = candidate.identifier || candidate.profileUrl || candidate.name.toLowerCase();
    if (!recruiters.has(key)) {
      recruiters.set(key, {
        name: candidate.name,
        profileUrl: candidate.profileUrl,
      });
    }
  }

  return [...recruiters.values()];
}
