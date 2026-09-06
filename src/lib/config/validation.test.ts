import assert from "node:assert/strict";
import test from "node:test";

import { CANONICAL_ARCHETYPES } from "../archetypes/registry.ts";
import {
  ConfigurationValidationError,
  effectiveLinkedInDiscoveryOptions,
  validateConfiguration,
} from "./validation.ts";

function validConfiguration() {
  return {
    revision: 7,
    settings: {
      scraping_enabled: true,
      lookback_days: 14,
      max_jobs_per_query: 250,
      max_pages_per_query: 10,
      request_delay_ms: 1000,
      concurrent_queries: 3,
      deduplicate_jobs: true,
      fetch_descriptions: true,
      score_jobs: true,
      options: {},
    },
    lanes: CANONICAL_ARCHETYPES.map((archetype, index) => ({
      archetype,
      display_name: archetype,
      description: "Description",
      routing_guidance: "Guidance",
      title_include: [" engineer ", "engineer"],
      title_exclude: [],
      description_include: [],
      description_exclude: [],
      enabled: true,
      sort_order: index * 10,
      locations: ["canada"],
      queries: [
        { archetype, query: `"${archetype}"`, query_type: "precision", language: "en", sort_order: 0, enabled: true },
        { archetype, query: `${archetype} operations`, query_type: "recall", language: "en", sort_order: 10, enabled: true },
      ],
    })),
  };
}

test("validateConfiguration requires a server revision while preserving initial null", () => {
  assert.equal(validateConfiguration(validConfiguration()).revision, 7);
  assert.equal(validateConfiguration({ ...validConfiguration(), revision: null }).revision, null);
  assert.throws(
    () => validateConfiguration({ ...validConfiguration(), revision: undefined }),
    (error: unknown) => error instanceof ConfigurationValidationError && error.issues.some((issue) => issue.startsWith("revision must")),
  );
});

test("effectiveLinkedInDiscoveryOptions matches bounded scraper defaults", () => {
  const settings = validateConfiguration(validConfiguration()).settings;

  assert.deepEqual(effectiveLinkedInDiscoveryOptions(settings), {
    global_request_interval_ms: 2500,
    request_jitter_ms: 1500,
    min_pages_per_query: 10,
    soft_max_pages_per_query: 10,
    hard_max_pages_per_query: 20,
    max_adaptive_extra_requests: 20,
    max_detail_tasks_per_run: 1500,
    max_source_http_attempts_per_run: 800,
    max_detail_http_attempts_per_run: 800,
    minimum_recent_window_hours: 3,
    indexing_overlap_hours: 6,
    maximum_normal_window_hours: 24,
    outage_recovery_cap_hours: 168,
    max_search_runtime_seconds: 1620,
    max_detail_runtime_seconds: 300,
  });
});

test("validateConfiguration rejects unsafe adaptive relationships", () => {
  const configuration = validConfiguration();
  configuration.settings.options = {
    min_pages_per_query: 8,
    soft_max_pages_per_query: 7,
    max_search_runtime_seconds: 1620,
    max_detail_runtime_seconds: 301,
  };

  assert.throws(
    () => validateConfiguration(configuration),
    (error: unknown) => error instanceof ConfigurationValidationError
      && error.issues.some((issue) => issue.includes("minimum <= soft <= hard"))
      && error.issues.some((issue) => issue.includes("1920 seconds")),
  );
});

test("validateConfiguration preserves unknown option keys", () => {
  const configuration = validConfiguration();
  configuration.settings.options = { provider_extension: "keep" };

  assert.equal(validateConfiguration(configuration).settings.options.provider_extension, "keep");
});

test("validateConfiguration accepts and normalizes all six lanes", () => {
  const result = validateConfiguration(validConfiguration());
  assert.equal(result.lanes.length, 6);
  assert.deepEqual(result.lanes[0].title_include, ["engineer"]);
  assert.deepEqual(result.aliases, { software_tpm: "technology_delivery" });
  assert.equal(result.lanes[0].queries[0].archetype, result.lanes[0].archetype);
});

test("validateConfiguration rejects missing lanes and invalid scrape bounds", () => {
  const input = validConfiguration();
  input.lanes.pop();
  input.settings.lookback_days = 0;
  assert.throws(
    () => validateConfiguration(input),
    (error: unknown) => error instanceof ConfigurationValidationError
      && error.issues.some((issue) => issue.includes("Missing canonical lane"))
      && error.issues.some((issue) => issue.includes("lookback_days")),
  );
});

test("validateConfiguration requires a selected geography and both enabled query types", () => {
  const input = validConfiguration();
  input.lanes[0].locations = [];
  input.lanes[0].queries.forEach((query) => { query.enabled = false; });
  assert.throws(
    () => validateConfiguration(input),
    /at least one geography.*at least one enabled precision query.*at least one enabled recall query/,
  );
});

test("validateConfiguration identifies a missing enabled precision or recall query", () => {
  const missingPrecision = validConfiguration();
  missingPrecision.lanes[0].queries[0].enabled = false;
  assert.throws(
    () => validateConfiguration(missingPrecision),
    /lanes\[0\].*must contain at least one enabled precision query/,
  );

  const missingRecall = validConfiguration();
  missingRecall.lanes[0].queries[1].enabled = false;
  assert.throws(
    () => validateConfiguration(missingRecall),
    /lanes\[0\].*must contain at least one enabled recall query/,
  );
});

test("validateConfiguration rejects query provenance assigned to another lane", () => {
  const input = validConfiguration();
  input.lanes[0].queries[0].archetype = "network_infrastructure";
  assert.throws(() => validateConfiguration(input), /archetype must match its parent lane/);
});
