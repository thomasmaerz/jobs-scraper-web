import type { Job, ListingInstance } from "@/types";
import { getDistinctListingLocations, getPostingWaveGroups } from "@/lib/jobs/repost";
import { getLinkedInListingUrl } from "@/lib/jobs/formatters";

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function variantLabel(instance: ListingInstance): string {
  switch (instance.variant_type) {
    case "repost": return "Repost";
    case "simultaneous_variant": return "Simultaneous";
    case "location_variant": return "Location variant";
    case "original": return "Original";
    default: return "Source listing";
  }
}

export default function ListingHistoryPanel({ job }: { job: Job }) {
  const waves = getPostingWaveGroups(job);
  const locationCount = getDistinctListingLocations(job).length;
  const listingCount = job.seen_count ?? job.listing_instances?.length ?? 0;
  const waveCount = job.posting_wave_count ?? Math.max((job.repost_count || 0) + 1, waves.length ? 1 : 0);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs">
        <Metric label="IDs" value={listingCount} />
        <Metric label="Waves" value={waveCount} />
        <Metric label="Locations" value={locationCount} />
        <Metric label="Confirmed reposts" value={job.repost_count || 0} emphasis={(job.repost_count || 0) > 0} />
        <span className="ml-auto hidden text-[11px] text-slate-500 lg:inline">
          Later same-location waves count as reposts; simultaneous and location variants do not.
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] table-fixed text-left text-xs text-slate-600">
          <colgroup>
            <col className="w-[155px]" />
            <col className="w-[118px]" />
            <col className="w-[105px]" />
            <col />
            <col className="w-[90px]" />
            <col className="w-[130px]" />
          </colgroup>
          <thead className="border-b border-slate-200 bg-white text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-1.5">Source ID</th>
              <th className="px-2 py-1.5">Type</th>
              <th className="px-2 py-1.5">Observed</th>
              <th className="px-2 py-1.5">Recruiter</th>
              <th className="px-2 py-1.5 text-right">Applicants</th>
              <th className="px-3 py-1.5 text-right">Salary</th>
            </tr>
          </thead>
          <tbody>
            {waves.map((wave) => (
              <WaveRows key={wave.key} wave={wave} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WaveRows({ wave }: { wave: ReturnType<typeof getPostingWaveGroups>[number] }) {
  return (
    <>
      <tr className="border-y border-slate-200 bg-slate-100/80 first:border-t-0">
        <td colSpan={6} className="px-3 py-1.5">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="font-semibold text-slate-800">{wave.location || "Unknown location"}</span>
            <span className="text-slate-400">·</span>
            <span>{formatDate(wave.postedAt)}</span>
            <span className="text-slate-400">·</span>
            <span>Wave {wave.index}</span>
            <span className="text-slate-400">·</span>
            <span>{wave.instances.length} ID{wave.instances.length === 1 ? "" : "s"}</span>
            {wave.isConfirmedRepost && (
              <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-800">
                Confirmed repost
              </span>
            )}
          </div>
        </td>
      </tr>
      {wave.instances.map((instance) => (
        <tr key={`${wave.key}:${instance.job_id}`} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
          <td className="truncate px-3 py-1.5 font-mono text-[11px]" title={instance.job_id}>
            {getLinkedInListingUrl(instance.job_id) ? (
              <a
                href={getLinkedInListingUrl(instance.job_id) || undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-700 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-900"
                aria-label={`Open LinkedIn listing ${instance.job_id}`}
              >
                {instance.job_id}
              </a>
            ) : (
              <span className="text-slate-700">{instance.job_id}</span>
            )}
          </td>
          <td className="px-2 py-1.5">{variantLabel(instance)}</td>
          <td className="px-2 py-1.5 whitespace-nowrap">{formatDate(instance.scraped_at)}</td>
          <td className="truncate px-2 py-1.5" title={instance.recruiter_name || undefined}>{instance.recruiter_name || "—"}</td>
          <td className="px-2 py-1.5 text-right tabular-nums">{instance.applicant_count ?? "—"}</td>
          <td className="truncate px-3 py-1.5 text-right" title={instance.salary_text || undefined}>{instance.salary_text || "—"}</td>
        </tr>
      ))}
    </>
  );
}

function Metric({ label, value, emphasis = false }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <span className="whitespace-nowrap text-slate-500">
      {label} <strong className={emphasis ? "font-semibold text-orange-700" : "font-semibold text-slate-900"}>{value}</strong>
    </span>
  );
}
