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
  options: Record<string, unknown>;
  updated_at?: string;
}

export interface ScraperConfiguration {
  version: number;
  revision: number | null;
  aliases: Record<string, CanonicalArchetype>;
  settings: ScrapeSettings;
  lanes: CareerLaneConfiguration[];
}
