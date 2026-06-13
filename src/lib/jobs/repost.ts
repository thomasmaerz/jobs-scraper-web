import type { Job, ListingInstance } from "../../types";

export function getListingInstances(job: Job): ListingInstance[] {
  return Array.isArray(job.listing_instances) ? job.listing_instances : [];
}

export function hasReposts(job: Job): boolean {
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

export function getRepostSummary(job: Job): string | null {
  const inferredFromInstances = Math.max(getListingInstances(job).length - 1, 0);
  const repostCount = Math.max(job.repost_count || 0, inferredFromInstances);

  if (repostCount <= 0) return null;

  return repostCount === 1 ? "Reposted once" : `Reposted ${repostCount} times`;
}
