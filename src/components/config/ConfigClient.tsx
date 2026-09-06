"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  CircleGauge,
  Database,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";

import { ARCHETYPE_REGISTRY } from "@/lib/archetypes/registry";
import {
  GEOGRAPHIES,
  type CareerLaneConfiguration,
  type LinkedInDiscoveryStatus,
  type ScraperConfiguration,
} from "@/lib/config/types";

const GEOGRAPHY_LABELS = { canada: "Canada", usa: "United States", eea: "EEA" } as const;

function lines(value: string): string[] {
  return [...new Set(value.split("\n").map((entry) => entry.trim()).filter(Boolean))];
}

function TextList({ label, help, value, onChange }: {
  label: string;
  help: string;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [draft, setDraft] = useState(value.join("\n"));

  useEffect(() => {
    setDraft(value.join("\n"));
  }, [value]);

  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-800">{label}</span>
      <span className="mb-2 block text-xs text-slate-500">{help}</span>
      <textarea
        rows={5}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onChange(lines(draft))}
        className="w-full rounded-xl border-slate-200 bg-slate-50/60 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        placeholder="One phrase per line"
      />
    </label>
  );
}

function NumberSetting({ label, help, value, min, max, onChange }: {
  label: string;
  help: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className="block text-sm font-semibold text-slate-800">{label}</span>
      <span className="mt-1 block min-h-8 text-xs leading-4 text-slate-500">{help}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 w-full rounded-xl border-slate-200 bg-slate-50 text-sm font-semibold"
      />
    </label>
  );
}

function Toggle({ label, help, checked, onChange }: {
  label: string;
  help?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <span>
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        {help && <span className="mt-0.5 block text-xs text-slate-500">{help}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
    </label>
  );
}

function DiscoveryStatusPanel({ status, error }: {
  status: LinkedInDiscoveryStatus | null;
  error: string;
}) {
  if (error) {
    return <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">Operational status unavailable: {error}</div>;
  }
  if (!status) {
    return <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500">Loading operational status...</div>;
  }
  const cycle = status.latest_cycle;
  const queuedTasks = status.tasks.pending + status.tasks.retryable + status.tasks.leased;
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-[radial-gradient(circle_at_top_right,_#ecfeff,_transparent_42%),linear-gradient(135deg,#ffffff,#f8fafc)] p-6 shadow-sm sm:p-7">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Live database state</p><h2 className="mt-1 text-xl font-bold text-slate-950">LinkedIn discovery coverage</h2></div>
        <div className="text-sm text-slate-500">{cycle ? `Cycle ${cycle.sequence} · ${cycle.search_status}` : "No discovery cycle yet"}</div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Terminal scopes", cycle ? `${cycle.completed_scopes}/${cycle.required_scopes}` : "—"],
          ["Running scopes", cycle?.running_scopes ?? 0],
          ["Pages / cards", cycle ? `${cycle.pages} / ${cycle.cards}` : "—"],
          ["Task backlog", queuedTasks],
          ["Coverage debt", status.coverage_debt.pending + status.coverage_debt.expired],
        ].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/80 bg-white/75 px-4 py-3 shadow-sm"><div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div><div className="mt-1 text-xl font-bold text-slate-950">{value}</div></div>)}
      </div>
      {status.lanes.length > 0 && <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{status.lanes.map((lane) => <div key={lane.archetype} className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2 text-sm"><span className="font-semibold text-slate-700">{ARCHETYPE_REGISTRY[lane.archetype].label}</span><span className="tabular-nums text-slate-500">{lane.exhausted}/{lane.scopes} terminal</span></div>)}</div>}
      <div className="mt-4 text-xs text-slate-500">Published generation {status.publication.generation ?? "—"} from discovery sequence {status.publication.source_discovery_sequence ?? "—"}. A scope is complete only after LinkedIn returns verified no-results evidence.</div>
    </section>
  );
}

function LaneEditor({ lane, onChange }: {
  lane: CareerLaneConfiguration;
  onChange: (lane: CareerLaneConfiguration) => void;
}) {
  const [open, setOpen] = useState(lane.sort_order === 10);
  const registry = ARCHETYPE_REGISTRY[lane.archetype];
  const missingQueryTypes = lane.enabled
    ? (["precision", "recall"] as const).filter(
        (queryType) => !lane.queries.some((query) => query.enabled && query.query_type === queryType),
      )
    : [];
  const patch = (updates: Partial<CareerLaneConfiguration>) => onChange({ ...lane, ...updates });
  const patchQuery = (index: number, updates: Partial<CareerLaneConfiguration["queries"][number]>) => {
    const queries = lane.queries.map((query, queryIndex) => queryIndex === index ? { ...query, ...updates } : query);
    patch({ queries });
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-50">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${lane.enabled ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-400"}`}>
          <SlidersHorizontal size={19} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="font-semibold text-slate-900">{lane.display_name || registry.label}</span>
            {!lane.enabled && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Disabled</span>}
            {lane.enabled && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${lane.resume_profile_ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                {lane.resume_profile_ready ? "Resume ready" : "Scrape only · resume missing"}
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">{lane.archetype} · {lane.queries.filter((query) => query.enabled).length} active searches · {lane.locations.map((location) => GEOGRAPHY_LABELS[location]).join(", ") || "No geography"}</span>
          {missingQueryTypes.length > 0 && (
            <span className="mt-1 block text-xs font-semibold text-rose-600">
              Add or enable a {missingQueryTypes.join(" and ")} query before saving.
            </span>
          )}
          {lane.enabled && !lane.resume_profile_ready && (
            <span className="mt-1 block text-xs text-amber-700">
              Scraping stays enabled. Resume-dependent workers skip this lane until an enabled resume profile exists.
            </span>
          )}
        </span>
        <ChevronDown size={20} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-slate-100 p-5 sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[1fr_220px]">
            <div>
              <label className="block text-sm font-semibold text-slate-800">Display name</label>
              <input value={lane.display_name} onChange={(event) => patch({ display_name: event.target.value })} maxLength={120} className="mt-2 w-full rounded-xl border-slate-200 bg-slate-50" />
            </div>
            <Toggle label="Lane enabled" checked={lane.enabled} onChange={(enabled) => patch({ enabled })} />
          </div>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-800">Description
              <textarea rows={3} value={lane.description} onChange={(event) => patch({ description: event.target.value })} className="mt-2 w-full rounded-xl border-slate-200 bg-slate-50 text-sm font-normal" />
            </label>
            <label className="block text-sm font-semibold text-slate-800">Routing guidance
              <textarea rows={3} value={lane.routing_guidance} onChange={(event) => patch({ routing_guidance: event.target.value })} className="mt-2 w-full rounded-xl border-slate-200 bg-slate-50 text-sm font-normal" />
            </label>
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4">
            <div className="mb-3 flex items-center gap-2"><MapPin size={17} className="text-indigo-600" /><h3 className="text-sm font-bold text-slate-900">Search geographies</h3></div>
            <div className="flex flex-wrap gap-2">
              {GEOGRAPHIES.map((geography) => {
                const selected = lane.locations.includes(geography);
                return <button key={geography} type="button" onClick={() => patch({ locations: selected ? lane.locations.filter((item) => item !== geography) : [...lane.locations, geography] })} className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${selected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300"}`}>{selected && <Check size={14} className="mr-1.5 inline" />}{GEOGRAPHY_LABELS[geography]}</button>;
              })}
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <TextList label="Include title phrases" help="A title matching any phrase receives a positive lane signal." value={lane.title_include} onChange={(title_include) => patch({ title_include })} />
            <TextList label="Exclude title phrases" help="Filter or down-rank titles matching these phrases." value={lane.title_exclude} onChange={(title_exclude) => patch({ title_exclude })} />
            <TextList label="Include description signals" help="Skills and responsibilities that support lane membership." value={lane.description_include} onChange={(description_include) => patch({ description_include })} />
            <TextList label="Exclude description signals" help="Description phrases that indicate an adjacent or irrelevant role." value={lane.description_exclude} onChange={(description_exclude) => patch({ description_exclude })} />
          </div>

          <div className="mt-7">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><h3 className="font-bold text-slate-900">Search strings</h3><p className="mt-0.5 text-xs text-slate-500">Precision searches target titles. Recall searches broaden discovery.</p></div>
              <button type="button" onClick={() => patch({ queries: [...lane.queries, { archetype: lane.archetype, query: "", query_type: "precision", language: "en", sort_order: lane.queries.length * 10 + 10, enabled: true }] })} className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100"><Plus size={15} /> Add search</button>
            </div>
            <div className="space-y-3">
              {lane.queries.map((query, index) => (
                <div key={`${index}-${query.sort_order}`} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 md:grid-cols-[110px_78px_1fr_auto]">
                  <select value={query.query_type} onChange={(event) => patchQuery(index, { query_type: event.target.value as "precision" | "recall" })} className="rounded-lg border-slate-200 bg-white text-xs font-semibold"><option value="precision">Precision</option><option value="recall">Recall</option></select>
                  <input aria-label="Language" value={query.language} onChange={(event) => patchQuery(index, { language: event.target.value })} maxLength={5} className="rounded-lg border-slate-200 bg-white text-xs" placeholder="en" />
                  <textarea aria-label="Search query" rows={2} value={query.query} onChange={(event) => patchQuery(index, { query: event.target.value })} className="rounded-lg border-slate-200 bg-white font-mono text-xs" placeholder='"Job title" OR keywords' />
                  <div className="flex items-center justify-end gap-2">
                    <input aria-label="Query enabled" type="checkbox" checked={query.enabled} onChange={(event) => patchQuery(index, { enabled: event.target.checked })} className="rounded border-slate-300 text-indigo-600" />
                    <button aria-label="Delete search query" type="button" onClick={() => patch({ queries: lane.queries.filter((_, queryIndex) => queryIndex !== index) })} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default function ConfigClient() {
  const [config, setConfig] = useState<ScraperConfiguration | null>(null);
  const [baseline, setBaseline] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [conflicted, setConflicted] = useState(false);
  const [discoveryStatus, setDiscoveryStatus] = useState<LinkedInDiscoveryStatus | null>(null);
  const [statusError, setStatusError] = useState("");
  const dirty = useMemo(() => Boolean(config && JSON.stringify(config) !== baseline), [config, baseline]);

  const load = useCallback(async () => {
    setLoading(true); setError(""); setSuccess(""); setConflicted(false);
    try {
      const response = await fetch("/api/config", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? "Could not load configuration");
      }
      setConfig(body.data); setBaseline(JSON.stringify(body.data));
      setStatusError("");
      try {
        const statusResponse = await fetch("/api/config/status", { cache: "no-store" });
        const statusBody = await statusResponse.json();
        if (statusResponse.ok) setDiscoveryStatus(statusBody.data);
        else setStatusError(statusBody.error ?? "Could not load status");
      } catch (statusLoadError) {
        setStatusError(statusLoadError instanceof Error ? statusLoadError.message : "Could not load status");
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load configuration");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!config || saving) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) });
      const body = await response.json();
      if (response.status === 409 && body.code === "configuration_revision_conflict") {
        setConflicted(true);
        throw new Error(body.error);
      }
      if (!response.ok) throw new Error(body.issues?.join(" · ") ?? body.error ?? "Could not save configuration");
      setConfig(body.data); setBaseline(JSON.stringify(body.data));
      setSuccess(`Saved revision ${body.data.revision ?? "new"}. The next scrape will use this configuration.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save configuration");
    } finally { setSaving(false); }
  };

  if (loading) return <div className="grid min-h-[60vh] place-items-center"><div className="text-center"><Loader2 className="mx-auto animate-spin text-indigo-600" size={30} /><p className="mt-3 text-sm text-slate-500">Loading scraper configuration…</p></div></div>;
  if (!config) {
    return (
      <div className="mx-auto mt-12 max-w-2xl rounded-3xl border border-amber-200 bg-white p-7 shadow-sm sm:p-9">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700"><AlertCircle size={24} /></span>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Configuration unavailable</h1>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
          </div>
        </div>
        <button onClick={() => void load()} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"><RefreshCw size={16} /> Try again</button>
      </div>
    );
  }

  const updateSettings = (updates: Partial<ScraperConfiguration["settings"]>) => setConfig({ ...config, settings: { ...config.settings, ...updates } });
  const optionValue = (name: string, fallback: number) => typeof config.settings.options[name] === "number" ? config.settings.options[name] as number : fallback;
  const updateOption = (name: string, value: number) => updateSettings({ options: { ...config.settings.options, [name]: value } });

  return (
    <div className="mx-auto max-w-6xl pb-28 pt-4">
      <div className="overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-9">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div><div className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-500/15 px-3 py-1.5 text-xs font-bold text-indigo-200"><Database size={14} /> Database-backed · LAN access · revision {config.revision ?? "—"}</div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Scraper configuration</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Control discovery, classification, geography, and scrape limits for all six career lanes. Legacy <code className="rounded bg-white/10 px-1.5 py-0.5">software_tpm</code> jobs remain compatible with Technology Delivery.</p></div>
          <div className="grid grid-cols-2 gap-2 text-center"><div className="rounded-2xl bg-white/5 px-5 py-3"><div className="text-2xl font-bold">{config.lanes.filter((lane) => lane.enabled).length}</div><div className="text-[11px] uppercase tracking-wider text-slate-400">Active lanes</div></div><div className="rounded-2xl bg-white/5 px-5 py-3"><div className="text-2xl font-bold">{config.lanes.flatMap((lane) => lane.queries).filter((query) => query.enabled).length}</div><div className="text-[11px] uppercase tracking-wider text-slate-400">Searches</div></div></div>
        </div>
      </div>

      <div className="mt-6"><DiscoveryStatusPanel status={discoveryStatus} error={statusError} /></div>

      {(error || success) && <div role="status" className={`mt-5 flex items-start gap-3 rounded-2xl border p-4 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{error ? <AlertCircle className="mt-0.5 shrink-0" size={18} /> : <Check className="mt-0.5 shrink-0" size={18} />}<span className="flex-1">{error || success}</span>{conflicted && <button type="button" onClick={() => void load()} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-300 px-3 py-1.5 font-bold hover:bg-red-100"><RefreshCw size={14} /> Reload latest</button>}</div>}

      <section className="mt-7">
        <div className="mb-4 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-700"><CircleGauge size={20} /></span><div><h2 className="text-xl font-bold text-slate-900">Scrape controls</h2><p className="text-sm text-slate-500">Global limits and processing behavior.</p></div></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <NumberSetting label="Lookback days" help="Age window for discovered postings." value={config.settings.lookback_days} min={1} max={365} onChange={(lookback_days) => updateSettings({ lookback_days })} />
          <NumberSetting label="Jobs per query" help="Maximum results accepted per search." value={config.settings.max_jobs_per_query} min={1} max={10000} onChange={(max_jobs_per_query) => updateSettings({ max_jobs_per_query })} />
          <NumberSetting label="Baseline pages per query" help="Initial depth target; verified no-results evidence, not this value, completes a scope." value={config.settings.max_pages_per_query} min={1} max={100} onChange={(max_pages_per_query) => updateSettings({ max_pages_per_query })} />
          <NumberSetting label="Request delay (ms)" help="Delay between provider requests." value={config.settings.request_delay_ms} min={0} max={60000} onChange={(request_delay_ms) => updateSettings({ request_delay_ms })} />
          <NumberSetting label="Concurrency" help="Search queries processed in parallel." value={config.settings.concurrent_queries} min={1} max={50} onChange={(concurrent_queries) => updateSettings({ concurrent_queries })} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Toggle label="Scraping enabled" help="Master switch for scheduled scraping." checked={config.settings.scraping_enabled} onChange={(scraping_enabled) => updateSettings({ scraping_enabled })} />
          <Toggle label="Deduplicate jobs" checked={config.settings.deduplicate_jobs} onChange={(deduplicate_jobs) => updateSettings({ deduplicate_jobs })} />
          <Toggle label="Fetch descriptions" checked={config.settings.fetch_descriptions} onChange={(fetch_descriptions) => updateSettings({ fetch_descriptions })} />
          <Toggle label="Score jobs" checked={config.settings.score_jobs} onChange={(score_jobs) => updateSettings({ score_jobs })} />
        </div>
        <div className="mt-6 border-t border-slate-200 pt-5">
          <div className="mb-3"><h3 className="font-bold text-slate-900">Bounded discovery execution</h3><p className="mt-1 text-xs text-slate-500">Coverage continues across hourly runs until every scope reaches a verified terminal response.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <NumberSetting label="Search runtime (seconds)" help="Search plus detail may not exceed 1,920 seconds." value={optionValue("max_search_runtime_seconds", 1620)} min={60} max={1920} onChange={(value) => updateOption("max_search_runtime_seconds", value)} />
            <NumberSetting label="Detail runtime (seconds)" help="Detail-drain budget after search work." value={optionValue("max_detail_runtime_seconds", 300)} min={0} max={1200} onChange={(value) => updateOption("max_detail_runtime_seconds", value)} />
            <NumberSetting label="Search request budget" help="Maximum physical search attempts per run." value={optionValue("max_source_http_attempts_per_run", 800)} min={1} max={10000} onChange={(value) => updateOption("max_source_http_attempts_per_run", value)} />
            <NumberSetting label="Detail task budget" help="Maximum queued detail tasks processed per run." value={optionValue("max_detail_tasks_per_run", config.settings.max_jobs_per_query * 6)} min={0} max={10000} onChange={(value) => updateOption("max_detail_tasks_per_run", value)} />
            <NumberSetting label="Source interval (ms)" help="Durable source-wide minimum; never lower than 2,500 ms." value={optionValue("global_request_interval_ms", Math.max(2500, config.settings.request_delay_ms))} min={2500} max={60000} onChange={(value) => updateOption("global_request_interval_ms", value)} />
            <NumberSetting label="Recovery cap (hours)" help="Maximum outage window retained for automatic recovery." value={optionValue("outage_recovery_cap_hours", 168)} min={1} max={8760} onChange={(value) => updateOption("outage_recovery_cap_hours", value)} />
          </div>
        </div>
      </section>

      <section className="mt-9">
        <div className="mb-4 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-100 text-indigo-700"><Search size={20} /></span><div><h2 className="text-xl font-bold text-slate-900">Career lanes</h2><p className="text-sm text-slate-500">Expand a lane to edit filters, searches, and locations.</p></div></div>
        <div className="space-y-3">{config.lanes.map((lane) => <LaneEditor key={lane.archetype} lane={lane} onChange={(nextLane) => setConfig({ ...config, lanes: config.lanes.map((item) => item.archetype === lane.archetype ? nextLane : item) })} />)}</div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4"><div className="flex items-center gap-2 text-sm text-slate-500"><Settings2 size={17} />{dirty ? <span className="font-semibold text-amber-700">Unsaved changes</span> : <span>Configuration is up to date</span>}</div><div className="flex gap-2"><button type="button" disabled={!dirty || saving} onClick={() => { const restored = JSON.parse(baseline) as ScraperConfiguration; setConfig(restored); setError(""); setSuccess(""); }} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 disabled:opacity-40">Discard</button><button type="button" disabled={!dirty || saving} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">{saving ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}{saving ? "Saving…" : "Save configuration"}</button></div></div>
      </div>
    </div>
  );
}
