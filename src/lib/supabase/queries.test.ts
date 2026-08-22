import assert from "node:assert/strict";
import test from "node:test";
import { isDeepStrictEqual } from "node:util";

import {
  __resetSupabaseClientFactoryForTests,
  __setSupabaseClientFactoryForTests,
  getAllActiveJobsCount,
  getAppliedJobs,
  getAppliedJobsCount,
  getDistinctCompanies,
  getDistinctJobTitles,
  getJobFilterSuggestions,
  getJobKeywordInsights,
  getNewJobs,
  getTopScoredJobs,
  getTopScoredJobsCount,
  type JobListQueryOptions,
} from "./queries.ts";
import { SORT_FIELDS, type SortField, type SortOrder } from "../filters/types.ts";

type Call = { method: string; args: unknown[] };

function createQueryClient(options: {
  data?: unknown[];
  count?: number;
  rangeData?: unknown[][];
  rpc?: (name: string, params: Record<string, unknown>) => unknown[];
} = {}) {
  const calls: Call[] = [];
  const response = {
    data: options.data ?? [],
    count: options.count ?? 0,
    error: null,
  };
  const query: Record<string, any> = {};
  let rangeIndex = 0;

  for (const method of [
    "select",
    "eq",
    "in",
    "is",
    "or",
    "gte",
    "lte",
    "not",
    "order",
  ]) {
    query[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return query;
    };
  }

  query.range = async (...args: unknown[]) => {
    calls.push({ method: "range", args });
    return options.rangeData
      ? { ...response, data: options.rangeData[rangeIndex++] ?? [] }
      : response;
  };
  query.then = (resolve: (value: typeof response) => unknown) => resolve(response);

  return {
    calls,
    client: {
      from(table: string) {
        calls.push({ method: "from", args: [table] });
        return query;
      },
      async rpc(name: string, params: Record<string, unknown>) {
        calls.push({ method: "rpc", args: [name, params] });
        return {
          data: options.rpc?.(name, params) ?? [],
          error: null,
        };
      },
    },
  };
}

function predicates(calls: Call[]) {
  return calls.filter((call) => [
    "eq",
    "in",
    "is",
    "or",
    "gte",
    "lte",
    "not",
  ].includes(call.method));
}

function hasCall(calls: Call[], method: string, ...args: unknown[]) {
  return calls.some((call) => call.method === method && isDeepStrictEqual(call.args, args));
}

async function rowCalls(
  getter: (options?: JobListQueryOptions) => Promise<unknown[]>,
  options: JobListQueryOptions = {},
) {
  const mock = createQueryClient();
  __setSupabaseClientFactoryForTests(async () => mock.client);
  await getter(options);
  return mock.calls;
}

const jobLists = [
  { name: "new", rows: getNewJobs, count: getAllActiveJobsCount },
  { name: "top", rows: getTopScoredJobs, count: getTopScoredJobsCount },
  { name: "applied", rows: getAppliedJobs, count: getAppliedJobsCount },
] as const;

test.afterEach(() => {
  __resetSupabaseClientFactoryForTests();
});

test("new, top, and applied row/count queries keep every predicate in parity", async () => {
  for (const list of jobLists) {
    const options: JobListQueryOptions = {
      provider: "linkedin",
      interest: "null",
      minScore: 20,
      maxScore: 90,
      level: ["Entry level", "Mid-Senior level"],
      archetype: ["software_tpm"],
      hasSalary: true,
      salaryMin: 100000,
      salaryMax: 200000,
      minRepostCount: 1,
      minSeenCount: 2,
      province: ["AB", "BC"],
      locationScope: ["local", "country"],
      excludeMetro: ["calgary", "vancouver"],
      datePosted: "7d",
      query: "TPM),status.eq.applied",
      ...(list.name === "applied" ? { applicationStatus: "offer" as const } : {}),
    };
    const rowMock = createQueryClient();
    const countMock = createQueryClient({ count: 1 });
    const clients = [rowMock.client, countMock.client];
    __setSupabaseClientFactoryForTests(async () => clients.shift());

    await list.rows(options);
    await list.count(options);

    assert.deepEqual(predicates(rowMock.calls), predicates(countMock.calls), list.name);
  }
});

test("job-list filters emit their individual Supabase predicates", async () => {
  const cases: Array<{
    name: string;
    options: JobListQueryOptions;
    expected: Call;
  }> = [
    { name: "provider", options: { provider: "linkedin" }, expected: { method: "eq", args: ["provider", "linkedin"] } },
    { name: "interest true", options: { interest: "true" }, expected: { method: "is", args: ["is_interested", true] } },
    { name: "interest false", options: { interest: "false" }, expected: { method: "is", args: ["is_interested", false] } },
    { name: "interest null", options: { interest: "null" }, expected: { method: "is", args: ["is_interested", null] } },
    { name: "minimum score", options: { minScore: 17 }, expected: { method: "gte", args: ["resume_score", 17] } },
    { name: "maximum score", options: { maxScore: 83 }, expected: { method: "lte", args: ["resume_score", 83] } },
    { name: "repeated levels", options: { level: ["Entry level", "Director"] }, expected: { method: "in", args: ["level", ["Entry level", "Director"]] } },
    { name: "repeated archetypes", options: { archetype: ["software_tpm", "data_pm"] }, expected: { method: "in", args: ["archetype", ["software_tpm", "data_pm"]] } },
    { name: "has salary", options: { hasSalary: true }, expected: { method: "not", args: ["salary_min", "is", null] } },
    { name: "salary minimum", options: { hasSalary: true, salaryMin: 90000 }, expected: { method: "gte", args: ["salary_min", 90000] } },
    { name: "salary maximum", options: { hasSalary: true, salaryMax: 180000 }, expected: { method: "lte", args: ["salary_min", 180000] } },
    { name: "repost minimum", options: { minRepostCount: 2 }, expected: { method: "gte", args: ["repost_count", 2] } },
    { name: "seen minimum", options: { minSeenCount: 3 }, expected: { method: "gte", args: ["seen_count", 3] } },
    { name: "provinces", options: { province: ["AB", "BC"] }, expected: { method: "in", args: ["location_province_code", ["AB", "BC"]] } },
    { name: "location scopes", options: { locationScope: ["local", "country"] }, expected: { method: "in", args: ["location_scope", ["local", "country"]] } },
    { name: "excluded metros", options: { excludeMetro: ["calgary", "vancouver"] }, expected: { method: "or", args: ["location_metro.is.null,location_metro.not.in.(calgary,vancouver)"] } },
  ];

  for (const item of cases) {
    const calls = await rowCalls(getNewJobs, item.options);
    assert.ok(hasCall(calls, item.expected.method, ...item.expected.args), item.name);
  }

  const noSalary = await rowCalls(getNewJobs, { salaryMin: 90000, salaryMax: 180000 });
  assert.equal(noSalary.some((call) => call.args[0] === "salary_min"), false);
});

test("province filters can include Canada-wide jobs without restricting them to a province", async () => {
  const mock = createQueryClient({ data: [] });
  __setSupabaseClientFactoryForTests(async () => mock.client);

  await getNewJobs({
    province: ["AB", "BC"],
    locationScope: ["local", "country"],
  });

  assert.ok(mock.calls.some((call) =>
    call.method === "or" &&
      call.args[0] ===
        "location_scope.eq.country,and(location_province_code.in.(AB,BC),location_scope.in.(local))"
  ));
});

test("interest and filterStatus defaults and overrides are exact", async () => {
  const defaultCalls = await rowCalls(getNewJobs);
  assert.ok(hasCall(defaultCalls, "or", "is_interested.is.null,is_interested.eq.true"));
  assert.ok(hasCall(defaultCalls, "or", "is_filtered.is.null,is_filtered.eq.false"));

  const shownCalls = await rowCalls(getNewJobs, { filterStatus: "show_filtered" });
  assert.equal(shownCalls.some((call) => String(call.args[0]).includes("is_filtered")), false);

  const entryCalls = await rowCalls(getNewJobs, { filterStatus: "entry_level" });
  assert.ok(hasCall(entryCalls, "eq", "is_entry_level_filtered", true));
  assert.equal(entryCalls.some((call) => String(call.args[0]).includes("is_filtered")), false);
  assert.equal(entryCalls.some((call) => String(call.args[0]).includes("is_interested")), false);
  assert.equal(entryCalls.some((call) => call.args[0] === "resume_score"), false);

  const topCalls = await rowCalls(getTopScoredJobs);
  assert.ok(hasCall(topCalls, "gte", "resume_score", 50));
  assert.ok(hasCall(topCalls, "lte", "resume_score", 100));
  assert.equal(topCalls.some((call) => String(call.args[0]).includes("is_interested")), false);
});

test("date-posted and safe text filters are bounded and sanitized", async () => {
  for (const [datePosted, hours] of [["24h", 24], ["7d", 168], ["30d", 720]] as const) {
    const now = Date.now();
    const calls = await rowCalls(getNewJobs, { datePosted });
    const cutoff = calls.find((call) => call.method === "gte" && call.args[0] === "posted_at")?.args[1];
    assert.equal(typeof cutoff, "string");
    const age = now - Date.parse(cutoff as string);
    assert.ok(age >= hours * 3_600_000 && age < hours * 3_600_000 + 61_000, datePosted);
  }

  const calls = await rowCalls(getNewJobs, { query: "  TPM),status.eq.applied  " });
  assert.ok(hasCall(calls, "or", "job_title.ilike.%TPM status eq applied%,company.ilike.%TPM status eq applied%"));
});

test("applied status supports every value and has an exact default", async () => {
  for (const status of ["applied", "interviewing", "offer", "rejected"] as const) {
    const calls = await rowCalls(getAppliedJobs, { applicationStatus: status });
    assert.ok(hasCall(calls, "eq", "status", status), status);
  }
  const calls = await rowCalls(getAppliedJobs);
  assert.ok(hasCall(calls, "in", "status", ["applied", "interviewing", "offer"]));
});

test("sort fields and orders are allowlisted per job list", async () => {
  const configs = [
    { rows: getNewJobs, allowed: SORT_FIELDS.filter((field) => field !== "application_date"), fallback: "posted_at" },
    { rows: getTopScoredJobs, allowed: SORT_FIELDS.filter((field) => field !== "application_date"), fallback: "resume_score" },
    { rows: getAppliedJobs, allowed: [...SORT_FIELDS], fallback: "application_date" },
  ] as const;

  for (const config of configs) {
    for (const requested of [...SORT_FIELDS, "company"] as const) {
      for (const order of ["asc", "desc"] as const) {
        const calls = await rowCalls(config.rows, {
          sortBy: requested as SortField,
          sortOrder: order,
        });
        const expected = config.allowed.includes(requested as never) ? requested : config.fallback;
        const options = expected === "salary_min"
          ? { ascending: order === "asc", nullsFirst: false }
          : { ascending: order === "asc" };
        assert.deepEqual(calls.filter((call) => call.method === "order"), [
          { method: "order", args: [expected, options] },
          { method: "order", args: ["job_id", { ascending: true }] },
        ]);
      }
    }
    const invalidOrder = await rowCalls(config.rows, { sortOrder: "sideways" as SortOrder });
    assert.deepEqual(invalidOrder.find((call) => call.method === "order")?.args[1], { ascending: false });
  }
});

test("pagination supports 10, 25, 100, and batched all results", async () => {
  for (const pageSize of [10, 25, 100] as const) {
    const calls = await rowCalls(getNewJobs, { page: 2, pageSize });
    assert.deepEqual(calls.at(-1), { method: "range", args: [pageSize, pageSize * 2 - 1] });
  }

  const firstBatch = Array.from({ length: 1000 }, (_, index) => ({ job_id: `job-${index}` }));
  const finalBatch = [{ job_id: "job-1000" }, { job_id: "job-1001" }];
  const mock = createQueryClient({ rangeData: [firstBatch, finalBatch] });
  __setSupabaseClientFactoryForTests(async () => mock.client);
  const rows = await getNewJobs({ page: 99, pageSize: "all" });
  assert.equal(rows.length, 1002);
  assert.deepEqual(mock.calls.filter((call) => call.method === "range"), [
    { method: "range", args: [0, 999] },
    { method: "range", args: [1000, 1999] },
  ]);
});

test("job keyword insights select the complete confirmed row and use deterministic order", async () => {
  const mock = createQueryClient({ data: [{
    job_id: "job-1",
    keyword: "Roadmapping",
    category: "skill",
    analyzed_at: "2026-08-20T00:00:00Z",
    archetype: "software_tpm",
    provider: "linkedin",
  }] });
  __setSupabaseClientFactoryForTests(async () => mock.client);

  const rows = await getJobKeywordInsights("job-1");

  assert.equal(rows.length, 1);
  assert.deepEqual(mock.calls, [
    { method: "from", args: ["job_keyword_insights"] },
    { method: "select", args: ["job_id, keyword, category, analyzed_at, archetype, provider"] },
    { method: "eq", args: ["job_id", "job-1"] },
    { method: "order", args: ["category", { ascending: true }] },
    { method: "order", args: ["keyword", { ascending: true }] },
  ]);
});

test("suggestion helpers call the allowlisted RPC with bounded inputs", async () => {
  const mock = createQueryClient({
    rpc: () => [{ value: "Acme" }, { value: "Acme" }, { value: "Beta" }],
  });
  __setSupabaseClientFactoryForTests(async () => mock.client);

  assert.deepEqual(await getDistinctCompanies(`  ${"x".repeat(120)}  `, 100), ["Acme", "Beta"]);
  assert.deepEqual(await getDistinctJobTitles("TPM", 2), ["Acme", "Beta"]);
  assert.deepEqual(mock.calls.filter((call) => call.method === "rpc"), [
    {
      method: "rpc",
      args: ["search_job_filter_suggestions", {
        p_field: "company",
        p_query: "x".repeat(100),
        p_limit: 100,
      }],
    },
    {
      method: "rpc",
      args: ["search_job_filter_suggestions", {
        p_field: "jobTitle",
        p_query: "TPM",
        p_limit: 2,
      }],
    },
  ]);
  await assert.rejects(
    () => getJobFilterSuggestions("arbitrary" as "company"),
    /Unsupported suggestion field/,
  );
});
