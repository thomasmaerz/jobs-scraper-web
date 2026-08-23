import { CalendarDays, MapPin, Radio, Users } from "lucide-react";
import type { Job, ListingInstance } from "@/types";
import { getDistinctListingLocations, getPostingWaveGroups } from "@/lib/jobs/repost";

function formatDate(value: string | null | undefined): string {
  if (!value) return "Date unavailable";
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function variantLabel(instance: ListingInstance): string {
  switch (instance.variant_type) {
    case "repost": return "Repost wave";
    case "simultaneous_variant": return "Simultaneous variant";
    case "location_variant": return "Location variant";
    case "original": return "Original listing";
    default: return "Source listing";
  }
}

export default function ListingHistoryPanel({ job }: { job: Job }) {
  const waves = getPostingWaveGroups(job);
  const locations = getDistinctListingLocations(job);
  const listingCount = job.seen_count ?? job.listing_instances?.length ?? 0;
  const waveCount = job.posting_wave_count ?? Math.max((job.repost_count || 0) + 1, waves.length ? 1 : 0);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70">
      <div className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={Radio} label="Listing IDs" value={listingCount} />
          <Stat icon={CalendarDays} label="Posting waves" value={waveCount} />
          <Stat icon={MapPin} label="Locations" value={locations.length} />
          <Stat icon={Users} label="Confirmed reposts" value={job.repost_count || 0} />
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          Source IDs preserve every observed listing. Only later waves at the same location count as reposts; simultaneous and cross-location listings remain variants.
        </p>
      </div>
      <div className="space-y-3 p-4">
        {waves.map((wave) => (
          <section key={wave.key} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">{wave.location || "Unknown location"}</span>
                  {wave.isConfirmedRepost && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-800">Confirmed repost</span>}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Posted {formatDate(wave.postedAt)} · Wave {wave.index} · {wave.instances.length} source ID{wave.instances.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
              {wave.instances.map((instance) => (
                <div key={`${wave.key}:${instance.job_id}`} className="grid gap-1 py-2.5 text-xs text-slate-600 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-slate-700">{instance.job_id}</p>
                    <p className="mt-1">{variantLabel(instance)}{instance.recruiter_name ? ` · Recruiter: ${instance.recruiter_name}` : ""}</p>
                  </div>
                  <div className="sm:text-right">
                    <p>Observed {formatDate(instance.scraped_at)}</p>
                    {instance.applicant_count != null && <p>{instance.applicant_count} applicants</p>}
                    {instance.salary_text && <p>{instance.salary_text}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Radio; label: string; value: number }) {
  return <div className="rounded-lg bg-slate-50 px-3 py-2.5"><div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500"><Icon className="h-3.5 w-3.5" />{label}</div><p className="mt-1 font-mono text-xl font-semibold text-slate-900">{value}</p></div>;
}
