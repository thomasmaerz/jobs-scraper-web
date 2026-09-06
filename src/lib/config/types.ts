import type { CanonicalArchetype } from "@/lib/archetypes/registry";

export const GEOGRAPHIES = ["canada", "usa", "eea"] as const;
export type Geography = (typeof GEOGRAPHIES)[number];
export type QueryType = "precision" | "recall";

export interface LaneSearchQuery {
  archetype: CanonicalArchetype;
  query: string;
  query_type: QueryType;
  language: string;
  sort_order: number;
  enabled: boolean;
}

export interface CareerLaneConfiguration {
  archetype: CanonicalArchetype;
  display_name: string;
  description: string;
  routing_guidance: string;
  title_include: string[];
  title_exclude: string[];
  description_include: string[];
  description_exclude: string[];
  enabled: boolean;
  /** Read-only readiness; false does not disable scraping. */
  resume_profile_ready: boolean;
  sort_order: number;
  locations: Geography[];
  queries: LaneSearchQuery[];
}

export interface ScrapeOptions {
  global_request_interval_ms?: number;
  request_jitter_ms?: number;
  min_pages_per_query?: number;
  soft_max_pages_per_query?: number;
  hard_max_pages_per_query?: number;
  max_adaptive_extra_requests?: number;
  max_detail_tasks_per_run?: number;
  max_source_http_attempts_per_run?: number;
  max_detail_http_attempts_per_run?: number;
  minimum_recent_window_hours?: number;
  indexing_overlap_hours?: number;
  maximum_normal_window_hours?: number;
  outage_recovery_cap_hours?: number;
  max_search_runtime_seconds?: number;
  max_detail_runtime_seconds?: number;
  [key: string]: unknown;
}

export interface EffectiveLinkedInDiscoveryOptions {
  global_request_interval_ms: number;
  request_jitter_ms: number;
  min_pages_per_query: number;
  soft_max_pages_per_query: number;
  hard_max_pages_per_query: number;
  max_adaptive_extra_requests: number;
  max_detail_tasks_per_run: number;
  max_source_http_attempts_per_run: number;
  max_detail_http_attempts_per_run: number;
  minimum_recent_window_hours: number;
  indexing_overlap_hours: number;
  maximum_normal_window_hours: number;
  outage_recovery_cap_hours: number;
  max_search_runtime_seconds: number;
  max_detail_runtime_seconds: number;
}

export interface ScrapeSettings {
  scraping_enabled: boolean;
  lookback_days: number;
  max_jobs_per_query: number;
  max_pages_per_query: number;
  request_delay_ms: number;
  concurrent_queries: number;
  deduplicate_jobs: boolean;
  fetch_descriptions: boolean;
  score_jobs: boolean;
  options: ScrapeOptions;
  updated_at?: string;
}

export interface ScraperConfiguration {
  version: number;
  revision: number | null;
  aliases: Record<string, CanonicalArchetype>;
  settings: ScrapeSettings;
  lanes: CareerLaneConfiguration[];
}

export interface LinkedInDiscoveryCycleStatus {
  id: number;
  sequence: number;
  started_at: string;
  completed_at: string | null;
  search_status: string;
  canonical_status: string;
  required_scopes: number;
  completed_scopes: number;
  running_scopes: number;
  pages: number;
  cards: number;
}

export interface LinkedInLaneDiscoveryStatus {
  archetype: CanonicalArchetype;
  scopes: number;
  exhausted: number;
  running: number;
  pages: number;
  cards: number;
}

export interface LinkedInDiscoveryStatus {
  latest_cycle: LinkedInDiscoveryCycleStatus | null;
  coverage_debt: { pending: number; expired: number; oldest_at: string | null };
  tasks: { pending: number; leased: number; retryable: number; terminal: number; complete: number };
  publication: {
    generation?: number;
    published_at?: string | null;
    source_discovery_cycle_id?: number | null;
    source_discovery_sequence?: number | null;
    row_count?: number;
  };
  lanes: LinkedInLaneDiscoveryStatus[];
}
