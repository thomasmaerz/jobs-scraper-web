import {
  CANONICAL_ARCHETYPES,
  isCanonicalArchetype,
} from "../archetypes/registry.ts";
import {
  GEOGRAPHIES,
  type EffectiveLinkedInDiscoveryOptions,
  type ScrapeSettings,
  type ScraperConfiguration,
} from "./types.ts";

export class ConfigurationValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(issues.join("; "));
    this.name = "ConfigurationValidationError";
    this.issues = issues;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

function stringArray(value: unknown, path: string, issues: string[]): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    issues.push(`${path} must be an array of strings`);
    return [];
  }
  const clean = [...new Set(value.map((entry) => entry.trim()).filter(Boolean))];
  if (clean.some((entry) => entry.length > 200)) issues.push(`${path} entries must be 200 characters or fewer`);
  return clean;
}

function integer(
  value: unknown,
  path: string,
  min: number,
  max: number,
  issues: string[],
): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    issues.push(`${path} must be an integer from ${min} to ${max}`);
    return min;
  }
  return value as number;
}

function bool(value: unknown, path: string, issues: string[]): boolean {
  if (typeof value !== "boolean") {
    issues.push(`${path} must be a boolean`);
    return false;
  }
  return value;
}

function optionInteger(
  options: Record<string, unknown>,
  name: keyof EffectiveLinkedInDiscoveryOptions,
  fallback: number,
  min: number,
  max: number,
  issues: string[],
): number {
  const value = options[name];
  if (value === undefined) return fallback;
  return integer(value, `settings.options.${name}`, min, max, issues);
}

function resolveLinkedInDiscoveryOptions(
  settings: Pick<ScrapeSettings, "max_jobs_per_query" | "max_pages_per_query" | "request_delay_ms" | "options">,
  issues: string[],
): EffectiveLinkedInDiscoveryOptions {
  const options = settings.options;
  const minimum = optionInteger(options, "min_pages_per_query", settings.max_pages_per_query, 1, 100, issues);
  const soft = optionInteger(options, "soft_max_pages_per_query", Math.max(minimum, Math.min(10, minimum + 4)), 1, 100, issues);
  const hard = optionInteger(options, "hard_max_pages_per_query", Math.max(soft, 20), 1, 100, issues);
  const detailTasks = optionInteger(options, "max_detail_tasks_per_run", settings.max_jobs_per_query * 6, 0, 10000, issues);
  const sourceAttempts = optionInteger(options, "max_source_http_attempts_per_run", 800, 1, 10000, issues);
  const detailAttempts = optionInteger(options, "max_detail_http_attempts_per_run", 800, 0, 10000, issues);
  const minimumWindow = optionInteger(options, "minimum_recent_window_hours", 3, 1, 8760, issues);
  const maximumWindow = optionInteger(options, "maximum_normal_window_hours", 24, 1, 8760, issues);
  const recoveryCap = optionInteger(options, "outage_recovery_cap_hours", 168, 1, 8760, issues);
  const searchRuntime = optionInteger(options, "max_search_runtime_seconds", 1620, 60, 1920, issues);
  const detailRuntime = optionInteger(options, "max_detail_runtime_seconds", 300, 0, 1200, issues);

  if (!(minimum <= soft && soft <= hard)) {
    issues.push("adaptive page thresholds must satisfy minimum <= soft <= hard");
  }
  if (!(minimumWindow <= maximumWindow && maximumWindow <= recoveryCap)) {
    issues.push("adaptive windows must satisfy minimum <= normal <= recovery cap");
  }
  if (sourceAttempts < minimum) {
    issues.push("settings.options.max_source_http_attempts_per_run must cover the minimum page threshold");
  }
  if (detailTasks > 0 && detailAttempts === 0) {
    issues.push("settings.options.max_detail_http_attempts_per_run must be positive when detail tasks are enabled");
  }
  if (searchRuntime + detailRuntime > 1920) {
    issues.push("adaptive runtime budgets must total 1920 seconds or fewer");
  }

  return {
    global_request_interval_ms: optionInteger(options, "global_request_interval_ms", Math.max(2500, settings.request_delay_ms), 2500, 60000, issues),
    request_jitter_ms: optionInteger(options, "request_jitter_ms", 1500, 0, 10000, issues),
    min_pages_per_query: minimum,
    soft_max_pages_per_query: soft,
    hard_max_pages_per_query: hard,
    max_adaptive_extra_requests: optionInteger(options, "max_adaptive_extra_requests", 20, 0, 10000, issues),
    max_detail_tasks_per_run: detailTasks,
    max_source_http_attempts_per_run: sourceAttempts,
    max_detail_http_attempts_per_run: detailAttempts,
    minimum_recent_window_hours: minimumWindow,
    indexing_overlap_hours: optionInteger(options, "indexing_overlap_hours", 6, 0, 8760, issues),
    maximum_normal_window_hours: maximumWindow,
    outage_recovery_cap_hours: recoveryCap,
    max_search_runtime_seconds: searchRuntime,
    max_detail_runtime_seconds: detailRuntime,
  };
}

export function effectiveLinkedInDiscoveryOptions(
  settings: Pick<ScrapeSettings, "max_jobs_per_query" | "max_pages_per_query" | "request_delay_ms" | "options">,
): EffectiveLinkedInDiscoveryOptions {
  const issues: string[] = [];
  const effective = resolveLinkedInDiscoveryOptions(settings, issues);
  if (issues.length) throw new ConfigurationValidationError(issues);
  return effective;
}

export function validateConfiguration(input: unknown): ScraperConfiguration {
  const issues: string[] = [];
  if (!isRecord(input)) throw new ConfigurationValidationError(["Configuration must be an object"]);
  const revision = input.revision;
  if (!(revision === null || (Number.isSafeInteger(revision) && (revision as number) > 0))) {
    issues.push("revision must be null for an initial configuration or a positive integer loaded from the server");
  }
  if (!Array.isArray(input.lanes)) throw new ConfigurationValidationError(["lanes must be an array"]);

  const seen = new Set<string>();
  const lanes = input.lanes.map((raw, index) => {
    const path = `lanes[${index}]`;
    if (!isRecord(raw)) {
      issues.push(`${path} must be an object`);
      return null;
    }
    const archetype = typeof raw.archetype === "string" ? raw.archetype : "";
    if (!isCanonicalArchetype(archetype)) issues.push(`${path}.archetype is not canonical`);
    if (seen.has(archetype)) issues.push(`${path}.archetype is duplicated`);
    seen.add(archetype);
    const displayName = typeof raw.display_name === "string" ? raw.display_name.trim() : "";
    if (!displayName || displayName.length > 120) issues.push(`${path}.display_name must be 1-120 characters`);
    const locations = stringArray(raw.locations, `${path}.locations`, issues);
    if (locations.some((item) => !(GEOGRAPHIES as readonly string[]).includes(item))) {
      issues.push(`${path}.locations contains an unsupported geography`);
    }
    if (!Array.isArray(raw.queries)) issues.push(`${path}.queries must be an array`);
    const queries = (Array.isArray(raw.queries) ? raw.queries : []).map((query, queryIndex) => {
      const queryPath = `${path}.queries[${queryIndex}]`;
      if (!isRecord(query)) {
        issues.push(`${queryPath} must be an object`);
        return null;
      }
      const value = typeof query.query === "string" ? query.query.trim() : "";
      if (!value || value.length > 2000) issues.push(`${queryPath}.query must be 1-2000 characters`);
      if (query.archetype !== archetype) {
        issues.push(`${queryPath}.archetype must match its parent lane`);
      }
      if (query.query_type !== "precision" && query.query_type !== "recall") {
        issues.push(`${queryPath}.query_type must be precision or recall`);
      }
      const language = typeof query.language === "string" ? query.language.trim() : "";
      if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(language)) issues.push(`${queryPath}.language is invalid`);
      return {
        archetype: archetype as (typeof CANONICAL_ARCHETYPES)[number],
        query: value,
        query_type: query.query_type as "precision" | "recall",
        language,
        sort_order: integer(query.sort_order, `${queryPath}.sort_order`, 0, 100000, issues),
        enabled: bool(query.enabled, `${queryPath}.enabled`, issues),
      };
    }).filter((query): query is NonNullable<typeof query> => query !== null);
    const laneEnabled = bool(raw.enabled, `${path}.enabled`, issues);
    if (laneEnabled && locations.length === 0) {
      issues.push(`${path}.locations must select at least one geography`);
    }
    if (laneEnabled && !queries.some((query) => query.enabled && query.query_type === "precision")) {
      issues.push(`${path} (${displayName || archetype}) must contain at least one enabled precision query`);
    }
    if (laneEnabled && !queries.some((query) => query.enabled && query.query_type === "recall")) {
      issues.push(`${path} (${displayName || archetype}) must contain at least one enabled recall query`);
    }

    return {
      archetype: archetype as (typeof CANONICAL_ARCHETYPES)[number],
      display_name: displayName,
      description: typeof raw.description === "string" ? raw.description.trim() : "",
      routing_guidance: typeof raw.routing_guidance === "string" ? raw.routing_guidance.trim() : "",
      title_include: stringArray(raw.title_include, `${path}.title_include`, issues),
      title_exclude: stringArray(raw.title_exclude, `${path}.title_exclude`, issues),
      description_include: stringArray(raw.description_include, `${path}.description_include`, issues),
      description_exclude: stringArray(raw.description_exclude, `${path}.description_exclude`, issues),
      enabled: laneEnabled,
      resume_profile_ready: raw.resume_profile_ready === true,
      sort_order: integer(raw.sort_order, `${path}.sort_order`, 0, 100000, issues),
      locations: locations as (typeof GEOGRAPHIES)[number][],
      queries,
    };
  }).filter((lane): lane is NonNullable<typeof lane> => lane !== null);

  for (const archetype of CANONICAL_ARCHETYPES) {
    if (!seen.has(archetype)) issues.push(`Missing canonical lane ${archetype}`);
  }
  if (seen.size !== CANONICAL_ARCHETYPES.length) issues.push("Configuration must contain exactly the six canonical lanes");

  const rawSettings = isRecord(input.settings) ? input.settings : {};
  if (!isRecord(input.settings)) issues.push("settings must be an object");
  const settings: ScrapeSettings = {
    scraping_enabled: bool(rawSettings.scraping_enabled, "settings.scraping_enabled", issues),
    lookback_days: integer(rawSettings.lookback_days, "settings.lookback_days", 1, 365, issues),
    max_jobs_per_query: integer(rawSettings.max_jobs_per_query, "settings.max_jobs_per_query", 1, 10000, issues),
    max_pages_per_query: integer(rawSettings.max_pages_per_query, "settings.max_pages_per_query", 1, 100, issues),
    request_delay_ms: integer(rawSettings.request_delay_ms, "settings.request_delay_ms", 0, 60000, issues),
    concurrent_queries: integer(rawSettings.concurrent_queries, "settings.concurrent_queries", 1, 50, issues),
    deduplicate_jobs: bool(rawSettings.deduplicate_jobs, "settings.deduplicate_jobs", issues),
    fetch_descriptions: bool(rawSettings.fetch_descriptions, "settings.fetch_descriptions", issues),
    score_jobs: bool(rawSettings.score_jobs, "settings.score_jobs", issues),
    options: isRecord(rawSettings.options) ? rawSettings.options : {},
  };
  if (!isRecord(rawSettings.options)) issues.push("settings.options must be an object");
  resolveLinkedInDiscoveryOptions(settings, issues);

  if (issues.length) throw new ConfigurationValidationError(issues);
  return {
    version: 1,
    revision: revision === null ? null : revision as number,
    aliases: { software_tpm: "technology_delivery" },
    settings,
    lanes,
  };
}
