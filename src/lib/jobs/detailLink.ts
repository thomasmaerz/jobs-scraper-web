export function jobDetailHref(jobId: string, searchParams: URLSearchParams): string {
  const detailsParams = new URLSearchParams();
  // Membership context comes only from an explicit lane filter. Never infer it
  // from jobs.archetype, which may be a legacy/non-selected projection.
  for (const archetype of searchParams.getAll("archetype")) {
    if (archetype.trim()) detailsParams.append("archetype", archetype);
  }
  const query = detailsParams.toString();
  return `/jobs/${encodeURIComponent(jobId)}${query ? `?${query}` : ""}`;
}
