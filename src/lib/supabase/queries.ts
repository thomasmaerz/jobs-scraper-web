import type {
  Job,
  JobKeywordInsight as SharedJobKeywordInsight,
  KeywordInsight,
  Resume,
} from "../../types.ts";
import type { PostgrestError } from "@supabase/supabase-js";
import type {
  ApplicationStatus,
  FilterState,
  FilterStatus,
  SortField,
  SortOrder,
} from "../filters/types.ts";

if (!process.env.NODE_TEST_CONTEXT) {
  await import("server-only");
}

export type { KeywordInsight } from "../../types.ts";

export type KeywordInsightsResult = {
  keywords: KeywordInsight[];
  totalCount: number;
};

type SupabaseClientFactory = () => Promise<any>;
type LegacyProvider = string | undefined;

async function createDefaultSupabaseServerClient() {
  const { createSupabaseServerClient } = await import(
    "../../utils/supabase/server.ts"
  );

  return createSupabaseServerClient();
}

let supabaseClientFactory: SupabaseClientFactory = createDefaultSupabaseServerClient;
const createSupabaseServerClient = () => supabaseClientFactory();

export function __setSupabaseClientFactoryForTests(
  factory: SupabaseClientFactory,
) {
  supabaseClientFactory = factory;
}

export function __resetSupabaseClientFactoryForTests() {
  supabaseClientFactory = createDefaultSupabaseServerClient;
}

export function __setKeywordInsightsClientFactoryForTests(
  factory: SupabaseClientFactory,
) {
  __setSupabaseClientFactoryForTests(factory);
}

export function __resetKeywordInsightsClientFactoryForTests() {
  __resetSupabaseClientFactoryForTests();
}

// Helper function to handle Supabase response errors
async function handleResponse({
  data,
  error,
}: {
  data: any[] | null; // Keep 'any' for flexibility or refine if possible
  error: PostgrestError | null;
}): Promise<any> {
  // Keep 'any' or refine return type
  if (error) {
    const details = [error.code, error.message, error.details, error.hint]
      .filter(Boolean)
      .join(" | ");
    console.error("Supabase response error:", details);
    throw new Error(details || "Supabase query failed");
  }
  // Allow returning empty arrays or potentially null for single results handled elsewhere
  // Removed the !data check here as it might be too strict for all cases
  return data;
}

// --- Query Functions ---

export interface JobListQueryOptions<TArchetype extends string = string>
  extends Omit<FilterState<TArchetype>, "pageSize"> {
  pageSize?: number | "all";
}

const dateCutoffCache = new WeakMap<
  object,
  Partial<Record<"24h" | "7d" | "30d", string>>
>();

export interface KeywordInsightsQueryOptions {
  provider?: string | readonly string[];
  providers?: readonly string[];
  archetype?: string | readonly string[];
  archetypes?: readonly string[];
  levels?: readonly string[];
  filterStatus?: FilterStatus | "all" | "filtered" | "unfiltered";
  companies?: readonly string[];
  jobTitles?: readonly string[];
  provinces?: readonly string[];
  locationScopes?: readonly string[];
  excludeMetros?: readonly string[];
  category?: string;
  minCount?: number;
}

type LegacyInterest = boolean | null | undefined;
type InternalJobListOptions = Omit<JobListQueryOptions, "interest"> & {
  interest?: JobListQueryOptions["interest"] | LegacyInterest;
};
type JobListKind = "new" | "top" | "applied";

const APPLIED_STATUSES: readonly ApplicationStatus[] = [
  "applied",
  "interviewing",
  "offer",
];
const JOB_SORT_FIELDS: Readonly<Record<JobListKind, readonly SortField[]>> = {
  new: ["posted_at", "resume_score", "salary_min", "repost_count", "seen_count"],
  top: ["posted_at", "resume_score", "salary_min", "repost_count", "seen_count"],
  applied: [
    "posted_at",
    "resume_score",
    "application_date",
    "salary_min",
    "repost_count",
    "seen_count",
  ],
};
const DEFAULT_SORT: Readonly<Record<JobListKind, SortField>> = {
  new: "posted_at",
  top: "resume_score",
  applied: "application_date",
};

function nonEmpty(values: readonly string[] | undefined): string[] | null {
  const normalized = Array.from(
    new Set(values?.map((value) => value.trim()).filter(Boolean)),
  );
  return normalized.length ? normalized : null;
}

function arrayOption(
  plural: readonly string[] | undefined,
  singular: string | readonly string[] | undefined,
  fallback?: readonly string[],
): string[] | null {
  if (plural !== undefined) return nonEmpty(plural);
  if (Array.isArray(singular)) return nonEmpty(singular);
  if (typeof singular === "string") return nonEmpty([singular]);
  return fallback ? nonEmpty(fallback) : null;
}

function finiteNumber(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function safePositiveInteger(value: number | undefined, fallback: number): number {
  return Number.isSafeInteger(value) && (value ?? 0) > 0 ? value! : fallback;
}

function pageRange(options: InternalJobListOptions) {
  if (options.pageSize === "all") return null;
  const page = safePositiveInteger(options.page, 1);
  const pageSize = Math.min(safePositiveInteger(options.pageSize, 25), 100);
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

function sanitizeSearchTerm(value: string | undefined): string | undefined {
  const sanitized = value
    ?.trim()
    .slice(0, 500)
    .replace(/[^\p{L}\p{N}\s&+\/-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized || undefined;
}

function datePostedCutoff(
  value: InternalJobListOptions["datePosted"],
  options: InternalJobListOptions,
): string | undefined {
  const age = value === "24h" ? 24 : value === "7d" ? 24 * 7 : value === "30d" ? 24 * 30 : 0;
  if (!age || !value) return undefined;
  const cached = dateCutoffCache.get(options)?.[value];
  if (cached) return cached;
  const cutoffDate = new Date(Date.now() - age * 60 * 60 * 1000);
  cutoffDate.setUTCSeconds(0, 0);
  const cutoff = cutoffDate.toISOString();
  const cutoffs = dateCutoffCache.get(options) ?? {};
  cutoffs[value] = cutoff;
  dateCutoffCache.set(options, cutoffs);
  return cutoff;
}

function applyInterestPredicate(
  query: any,
  interest: InternalJobListOptions["interest"],
  useNewPageDefault: boolean,
) {
  if (interest === true || interest === "true") return query.is("is_interested", true);
  if (interest === false || interest === "false") return query.is("is_interested", false);
  if (interest === null || interest === "null") return query.is("is_interested", null);
  return useNewPageDefault
    ? query.or("is_interested.is.null,is_interested.eq.true")
    : query;
}

function applyJobPredicates(
  initialQuery: any,
  kind: JobListKind,
  options: InternalJobListOptions,
) {
  let query = initialQuery.eq("is_active", true).eq("job_state", "new");

  if (kind === "applied") {
    query = options.applicationStatus
      ? query.eq("status", options.applicationStatus)
      : query.in("status", APPLIED_STATUSES);
  } else {
    query = query.eq("status", "new");
  }

  const useScoreDefaults = options.filterStatus !== "entry_level";
  const minScore =
    finiteNumber(options.minScore) ??
    (useScoreDefaults
      ? kind === "top"
        ? 50
        : kind === "new"
          ? 0
          : undefined
      : undefined);
  const maxScore =
    finiteNumber(options.maxScore) ??
    (useScoreDefaults && kind !== "applied" ? 100 : undefined);
  if (minScore !== undefined) query = query.gte("resume_score", minScore);
  if (maxScore !== undefined) query = query.lte("resume_score", maxScore);
  if (options.provider) query = query.eq("provider", options.provider);
  if (options.level?.length) query = query.in("level", options.level);
  if (options.archetype?.length) query = query.in("archetype", options.archetype);
  if (options.province?.length && options.locationScope?.length) {
    const regionalScopes = options.locationScope.filter(
      (scope) => scope !== "country",
    );
    const clauses: string[] = [];
    if (options.locationScope.includes("country")) {
      clauses.push("location_scope.eq.country");
    }
    if (regionalScopes.length) {
      clauses.push(
        `and(location_province_code.in.(${options.province.join(",")}),location_scope.in.(${regionalScopes.join(",")}))`,
      );
    }
    query = query.or(clauses.join(","));
  } else if (options.province?.length) {
    query = query.in("location_province_code", options.province);
  } else if (options.locationScope?.length) {
    query = query.in("location_scope", options.locationScope);
  }
  if (options.excludeMetro?.length) {
    query = query.or(
      `location_metro.is.null,location_metro.not.in.(${options.excludeMetro.join(",")})`,
    );
  }

  query = applyInterestPredicate(
    query,
    options.interest,
    kind === "new" && options.filterStatus !== "entry_level",
  );

  if (options.filterStatus === "entry_level") {
    query = query.eq("is_entry_level_filtered", true);
  } else if (options.filterStatus !== "show_filtered") {
    query = query.or("is_filtered.is.null,is_filtered.eq.false");
  }

  if (options.hasSalary) query = query.not("salary_min", "is", null);
  const salaryMin = finiteNumber(options.salaryMin);
  const salaryMax = finiteNumber(options.salaryMax);
  if (options.hasSalary && salaryMin !== undefined) query = query.gte("salary_min", salaryMin);
  if (options.hasSalary && salaryMax !== undefined) query = query.lte("salary_min", salaryMax);

  const minRepostCount = finiteNumber(options.minRepostCount);
  const minSeenCount = finiteNumber(options.minSeenCount);
  if (minRepostCount !== undefined) query = query.gte("repost_count", minRepostCount);
  if (minSeenCount !== undefined) query = query.gte("seen_count", minSeenCount);

  const cutoff = datePostedCutoff(options.datePosted, options);
  if (cutoff) query = query.gte("posted_at", cutoff);

  const search = sanitizeSearchTerm(options.query);
  if (search) {
    query = query.or(`job_title.ilike.%${search}%,company.ilike.%${search}%`);
  }

  return query;
}

function applyJobSort(query: any, kind: JobListKind, options: InternalJobListOptions) {
  const requestedSort = options.sortBy;
  const sortBy = requestedSort && JOB_SORT_FIELDS[kind].includes(requestedSort)
    ? requestedSort
    : DEFAULT_SORT[kind];
  const sortOrder: SortOrder = options.sortOrder === "asc" ? "asc" : "desc";
  const orderOptions: { ascending: boolean; nullsFirst?: boolean } = {
    ascending: sortOrder === "asc",
  };
  if (sortBy === "salary_min") orderOptions.nullsFirst = false;

  return query
    .order(sortBy, orderOptions)
    .order("job_id", { ascending: true });
}

async function getJobRows(kind: JobListKind, options: InternalJobListOptions): Promise<Job[]> {
  const supabase = await supabaseClientFactory();
  const createQuery = () =>
    applyJobSort(
      applyJobPredicates(
        supabase.from("jobs").select(
          "*, customized_resumes!jobs_customized_resume_id_fkey(resume_link)",
        ),
        kind,
        options,
      ),
      kind,
      options,
    );
  const range = pageRange(options);
  if (range) {
    const response = await createQuery().range(range.from, range.to);
    return ((await handleResponse(response)) ?? []) as Job[];
  }

  const jobs: Job[] = [];
  const batchSize = 1000;
  for (let from = 0; ; from += batchSize) {
    const response = await createQuery().range(from, from + batchSize - 1);
    const batch = ((await handleResponse(response)) ?? []) as Job[];
    jobs.push(...batch);
    if (batch.length < batchSize) break;
  }
  return jobs;
}

async function getJobCount(kind: JobListKind, options: InternalJobListOptions): Promise<number> {
  const supabase = await supabaseClientFactory();
  const query = applyJobPredicates(
    supabase.from("jobs").select("*", { count: "exact", head: true }),
    kind,
    options,
  );
  const { count, error } = await query;
  if (error) throw new Error(error.message || "Failed to get job count");
  return count ?? 0;
}

function legacyListOptions(
  optionsOrPage: JobListQueryOptions | number | undefined,
  pageSize?: number,
  provider?: string,
  minScore?: number,
  maxScore?: number,
  interest?: LegacyInterest,
  query?: string,
): InternalJobListOptions {
  if (typeof optionsOrPage === "object") return optionsOrPage;
  return { page: optionsOrPage, pageSize, provider: provider as any, minScore, maxScore, interest, query };
}

function legacyCountOptions(
  optionsOrProvider: JobListQueryOptions | string | undefined,
  minScore?: number,
  maxScore?: number,
  interest?: LegacyInterest,
  query?: string,
): InternalJobListOptions {
  if (typeof optionsOrProvider === "object") return optionsOrProvider;
  return { provider: optionsOrProvider as any, minScore, maxScore, interest, query };
}

export async function getNewJobs(options?: JobListQueryOptions): Promise<Job[]>;
export async function getNewJobs(
  page?: number,
  pageSize?: number,
  provider?: LegacyProvider,
  minScore?: number,
  maxScore?: number,
  interest?: LegacyInterest,
  query?: string,
): Promise<Job[]>;
export async function getNewJobs(
  optionsOrPage: JobListQueryOptions | number = {},
  pageSize?: number,
  provider?: string,
  minScore?: number,
  maxScore?: number,
  interest?: LegacyInterest,
  query?: string,
): Promise<Job[]> {
  return getJobRows("new", legacyListOptions(optionsOrPage, pageSize, provider, minScore, maxScore, interest, query));
}

export async function getAllActiveJobsCount(options?: JobListQueryOptions): Promise<number>;
export async function getAllActiveJobsCount(
  provider?: LegacyProvider,
  minScore?: number,
  maxScore?: number,
  interest?: LegacyInterest,
  query?: string,
): Promise<number>;
export async function getAllActiveJobsCount(
  optionsOrProvider: JobListQueryOptions | string = {},
  minScore?: number,
  maxScore?: number,
  interest?: LegacyInterest,
  query?: string,
): Promise<number> {
  return getJobCount("new", legacyCountOptions(optionsOrProvider, minScore, maxScore, interest, query));
}

export async function getTopScoredJobs(options?: JobListQueryOptions): Promise<Job[]>;
export async function getTopScoredJobs(
  page?: number,
  pageSize?: number,
  provider?: LegacyProvider,
  minScore?: number,
  maxScore?: number,
  interest?: LegacyInterest,
  query?: string,
): Promise<Job[]>;
export async function getTopScoredJobs(
  optionsOrPage: JobListQueryOptions | number = {},
  pageSize?: number,
  provider?: string,
  minScore?: number,
  maxScore?: number,
  interest?: LegacyInterest,
  query?: string,
): Promise<Job[]> {
  return getJobRows("top", legacyListOptions(optionsOrPage, pageSize, provider, minScore, maxScore, interest, query));
}

export async function getTopScoredJobsCount(options?: JobListQueryOptions): Promise<number>;
export async function getTopScoredJobsCount(
  provider?: LegacyProvider,
  minScore?: number,
  maxScore?: number,
  interest?: LegacyInterest,
  query?: string,
): Promise<number>;
export async function getTopScoredJobsCount(
  optionsOrProvider: JobListQueryOptions | string = {},
  minScore?: number,
  maxScore?: number,
  interest?: LegacyInterest,
  query?: string,
): Promise<number> {
  return getJobCount("top", legacyCountOptions(optionsOrProvider, minScore, maxScore, interest, query));
}

function legacyAppliedOptions(
  optionsOrPage: JobListQueryOptions | number | undefined,
  pageSize?: number,
  provider?: string,
  query?: string,
  applicationStatus?: string,
  sortBy?: string,
  sortOrder?: string,
): InternalJobListOptions {
  if (typeof optionsOrPage === "object") return optionsOrPage;
  return {
    page: optionsOrPage,
    pageSize,
    provider: provider as any,
    query,
    applicationStatus: applicationStatus as ApplicationStatus,
    sortBy: sortBy as SortField,
    sortOrder: sortOrder as SortOrder,
  };
}

export async function getAppliedJobs(options?: JobListQueryOptions): Promise<Job[]>;
export async function getAppliedJobs(
  page?: number,
  pageSize?: number,
  provider?: LegacyProvider,
  query?: string,
  applicationStatus?: string,
  sortBy?: string,
  sortOrder?: string,
): Promise<Job[]>;
export async function getAppliedJobs(
  optionsOrPage: JobListQueryOptions | number = {},
  pageSize?: number,
  provider?: string,
  query?: string,
  applicationStatus?: string,
  sortBy?: string,
  sortOrder?: string,
): Promise<Job[]> {
  return getJobRows("applied", legacyAppliedOptions(
    optionsOrPage,
    pageSize,
    provider,
    query,
    applicationStatus,
    sortBy,
    sortOrder,
  ));
}

export async function getAppliedJobsCount(options?: JobListQueryOptions): Promise<number>;
export async function getAppliedJobsCount(
  provider?: LegacyProvider,
  query?: string,
  applicationStatus?: string,
): Promise<number>;
export async function getAppliedJobsCount(
  optionsOrProvider: JobListQueryOptions | string = {},
  query?: string,
  applicationStatus?: string,
): Promise<number> {
  const options = typeof optionsOrProvider === "object"
    ? optionsOrProvider
    : {
      provider: optionsOrProvider as any,
      query,
      applicationStatus: applicationStatus as ApplicationStatus,
    };
  return getJobCount("applied", options);
}

function keywordFilterStatus(
  value: KeywordInsightsQueryOptions["filterStatus"],
): string {
  if (value === "show_filtered" || value === "all") return "all";
  if (value === "entry_level") return "entry_level";
  if (value === "filtered") return "filtered";
  return "unfiltered";
}

export async function getKeywordInsights(
  options: KeywordInsightsQueryOptions = {},
): Promise<KeywordInsightsResult> {
  const supabase = await supabaseClientFactory();
  const batchSize = 1000;
  const keywords: KeywordInsight[] = [];
  let offset = 0;
  let totalCount: number | null = null;

  while (totalCount === null || keywords.length < totalCount) {
    const response = await supabase.rpc("get_filtered_keyword_insights", {
      p_providers: arrayOption(options.providers, options.provider),
      p_archetypes: arrayOption(options.archetypes, options.archetype, ["software_tpm"]),
      p_levels: nonEmpty(options.levels),
      p_filter_status: keywordFilterStatus(options.filterStatus),
      p_companies: nonEmpty(options.companies),
      p_job_titles: nonEmpty(options.jobTitles),
      p_provinces: nonEmpty(options.provinces),
      p_location_scopes: nonEmpty(options.locationScopes),
      p_exclude_metros: nonEmpty(options.excludeMetros),
      p_category: options.category && options.category !== "all" ? options.category : null,
      p_min_count: Math.max(0, Math.trunc(finiteNumber(options.minCount) ?? 2)),
      p_limit: batchSize,
      p_offset: offset,
    });
    const rows = ((await handleResponse(response)) ?? []) as Array<KeywordInsight & {
      total_count?: number | string | null;
    }>;

    if (totalCount === null) {
      const parsedTotal = Number(rows[0]?.total_count);
      totalCount = Number.isFinite(parsedTotal) ? parsedTotal : rows.length;
    }
    keywords.push(...rows.map(({ total_count: _totalCount, ...row }) => row));
    if (!rows.length) break;
    offset += rows.length;
  }

  return { keywords, totalCount: totalCount ?? keywords.length };
}

export async function getJobKeywordInsights(
  jobId: string,
): Promise<JobKeywordInsight[]> {
  const supabase = await supabaseClientFactory();
  const response = await supabase
    .from("job_keyword_insights")
    .select("job_id, keyword, category, analyzed_at, archetype, provider")
    .eq("job_id", jobId)
    .order("category", { ascending: true })
    .order("keyword", { ascending: true });
  return (((await handleResponse(response)) ?? []) as JobKeywordInsight[]);
}

export type JobKeywordInsight = SharedJobKeywordInsight & {
  job_id: string;
  analyzed_at: string | null;
};

export type JobFilterSuggestionField = "company" | "jobTitle";

export async function getJobFilterSuggestions(
  field: JobFilterSuggestionField,
  query = "",
  limit = 20,
): Promise<string[]> {
  if (field !== "company" && field !== "jobTitle") {
    throw new Error("Unsupported suggestion field");
  }
  const normalizedQuery = query.trim().slice(0, 100);
  const normalizedLimit = Math.min(
    Math.max(Math.trunc(finiteNumber(limit) ?? 5000), 1),
    5000,
  );
  const supabase = await supabaseClientFactory();
  const response = await supabase.rpc("search_job_filter_suggestions", {
    p_field: field,
    p_query: normalizedQuery,
    p_limit: normalizedLimit,
  });
  const rows = ((await handleResponse(response)) ?? []) as Array<{ value: string | null }>;
  return Array.from(new Set(rows.map((row) => row.value).filter((value): value is string => Boolean(value))))
    .slice(0, normalizedLimit);
}

export function getDistinctCompanies(query = "", limit = 5000): Promise<string[]> {
  return getJobFilterSuggestions("company", query, limit);
}

export function getDistinctJobTitles(query = "", limit = 5000): Promise<string[]> {
  return getJobFilterSuggestions("jobTitle", query, limit);
}

/**
 * Gets the count of applied jobs on a specific date.
 * @param dateThe date string in 'YYYY-MM-DD' format.
 * @returns A promise that resolves to the number of jobs applied on that date.
 */
export async function getAppliedJobsCountByDate(
  localDateString: string,
): Promise<number> {
  // localDateString is "YYYY-MM-DD", e.g., "2025-05-21" from server's local TZ
  const supabase = await createSupabaseServerClient();
  const appliedStatuses = ["applied", "interviewing", "offer"];

  // Create a Date object representing the start of the local day (00:00:00 local time)
  // For "2025-05-21", this will be 2025-05-21T00:00:00 in the server's local timezone.
  const startOfLocalDay = new Date(localDateString);

  // Convert the start of the local day to a UTC ISO string for the query
  const startOfDayUTCForQuery = startOfLocalDay.toISOString();

  // Create a Date object for the end of the local day
  // Start with the beginning of the local day again
  const endOfLocalDay = new Date(localDateString);
  // Advance it by one full day to get the start of the *next* local day
  endOfLocalDay.setDate(startOfLocalDay.getDate() + 1);

  // Convert the start of the next local day to a UTC ISO string for the query boundary
  const startOfNextDayUTCForQuery = endOfLocalDay.toISOString();

  // For debugging:
  // console.log(`Querying for applications on local date: ${localDateString}`);
  // console.log(`UTC Range: >= ${startOfDayUTCForQuery} and < ${startOfNextDayUTCForQuery}`);

  const { count, error } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true)
    .in("status", appliedStatuses)
    .eq("job_state", "new") // Retained this filter if it's still relevant
    .gte("application_date", startOfDayUTCForQuery) // Greater than or equal to the start of the local day (in UTC)
    .lt("application_date", startOfNextDayUTCForQuery); // Less than the start of the next local day (in UTC)

  if (error) {
    console.error(
      `Supabase count error (applied jobs on local date ${localDateString}):`,
      error,
    );
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function getJobById(job_id: string): Promise<Job | null> {
  // The jobs table now stores one canonical row per role; job_id remains the stable canonical row identifier.
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("*, customized_resumes!jobs_customized_resume_id_fkey(resume_link)")
    .eq("job_id", job_id)
    .single(); // Use single() if you expect only one or zero results

  if (error && error.code !== "PGRST116") {
    // PGRST116: Row not found, which is okay for single()
    console.error("Supabase response error:", error);
    throw new Error(error.message);
  }
  // The 'data' object will now potentially include a 'customized_resumes' field:
  // e.g., { ..., customized_resume_id: 'xyz', customized_resumes: { resume_link: '...' } }
  // or { ..., customized_resume_id: null, customized_resumes: null }
  return data as Job | null; // Ensure your Job type definition accommodates this structure
}

// New function to update a job by its ID
export async function updateJobById(
  job_id: string,
  updates: Pick<
    Partial<Job>,
    "application_date" | "is_interested" | "notes" | "status"
  >,
): Promise<Job | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("jobs")
    .update(updates)
    .eq("job_id", job_id)
    .select() // Select the updated row
    .single(); // Expect a single row to be returned

  // The handleResponse function might need adjustment if it's not designed for single object returns
  // or if you want specific error handling for updates.
  // For now, we'll adapt the error handling similar to getJobById.
  if (error) {
    // PGRST116: Row not found, which means the job_id didn't match any record.
    if (error.code === "PGRST116") {
      console.warn(`Job with ID ${job_id} not found for update.`);
      return null;
    }
    console.error("Supabase update error:", error);
    throw new Error(error.message);
  }
  return data as Job | null; // Cast to Job or null
}

/**
 * Retrieves a specific customized resume by its ID.
 * @param resume_id The ID of the customized resume to retrieve.
 * @returns A promise that resolves to the Resume object or null if not found.
 */
export async function getCustomizedResumeById(
  resume_id: string,
): Promise<Resume | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customized_resumes") // Target the 'customized_resumes' table
    .select("*")
    .eq("id", resume_id) // Assuming 'id' is the primary key column
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116: Row not found, which is okay for single()
    console.error("Supabase error fetching customized resume:", error);
    throw new Error(error.message);
  }
  return data as Resume | null;
}

/**
 * Updates specified fields of a customized resume by its ID.
 * @param resume_id The ID of the customized resume to update.
 * @param updates An object containing the fields to update.
 * @returns A promise that resolves to the updated Resume object or null if not found.
 */
export async function updateCustomizedResumeById(
  resume_id: string,
  updates: Partial<Omit<Resume, "id" | "created_at" | "last_updated">>, // Exclude system-managed fields from direct update via this function
): Promise<Resume | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customized_resumes") // Target the 'customized_resumes' table
    .update(updates)
    .eq("id", resume_id) // Assuming 'id' is the primary key column
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // Row not found
      console.warn(
        `Customized resume with ID ${resume_id} not found for update.`,
      );
      return null;
    }
    console.error("Supabase error updating customized resume:", error);
    throw new Error(error.message);
  }
  return data as Resume | null;
}

// New function to upload a personalized resume PDF to Supabase Storage
/**
 * Uploads a personalized resume PDF to Supabase Storage.
 * @param job_id The ID of the job for which the resume is personalized.
 * @param file The PDF file to upload.
 * @returns A promise that resolves to an object containing the public URL of the uploaded file.
 * @throws Will throw an error if the upload fails or the public URL cannot be retrieved.
 */
export async function uploadPersonalizedResume(
  fileName: string,
  file: File,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const filePath = fileName;

  console.log("Uploading file to path:", filePath);

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("personalized_resumes") // Updated bucket name
    .upload(filePath, file, {
      upsert: true, // Overwrite if file already exists
    });

  if (uploadError) {
    console.error("Supabase storage upload error:", uploadError);
    throw new Error(
      `Failed to upload personalized resume: ${uploadError.message}`,
    );
  }

  if (!uploadData || !uploadData.path) {
    console.error(
      "Supabase storage upload error: No path returned despite no error.",
    );
    throw new Error(
      "Failed to upload personalized resume: No path returned from storage.",
    );
  }

  return fileName;
}

/**
 * Retrieves the user profile from the 'base_resume' table.
 * Fetches the latest row as per the backend architecture.
 * @returns A promise that resolves to the Resume object or null if not found.
 */
export async function getUserProfileByEmail(): Promise<Resume | null> {
  const supabase = await createSupabaseServerClient();

  // Fetch the latest base resume from the 'base_resume' table
  // This follows the backend's architecture of keeping a single/latest base resume.
  const { data, error } = await supabase
    .from("base_resume")
    .select("resume_data")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // PGRST116: Row not found, which is okay
      console.warn("No base resume found in the 'base_resume' table.");
      return null;
    }
    console.error("Supabase error fetching base resume:", error);
    throw new Error(error.message);
  }

  return (data as any)?.resume_data as Resume | null;
}

/**
 * Updates the base resume data in the 'base_resume' table.
 * Finds the latest row and updates its resume_data JSONB column.
 * @param resumeData The full Resume data object to save.
 * @returns The updated Resume data or null.
 */
export async function updateBaseResume(
  resumeData: Omit<Resume, "id" | "created_at" | "parsed_at" | "last_updated" | "resume_link">,
): Promise<Resume | null> {
  const supabase = await createSupabaseServerClient();

  // First, find the latest base resume row ID
  const { data: existing, error: fetchError } = await supabase
    .from("base_resume")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      console.warn("No base resume found to update.");
      return null;
    }
    console.error("Error fetching base resume for update:", fetchError);
    throw new Error(fetchError.message);
  }

  // Update the resume_data JSONB column
  const { data, error } = await supabase
    .from("base_resume")
    .update({ resume_data: resumeData })
    .eq("id", existing.id)
    .select("resume_data")
    .single();

  if (error) {
    console.error("Error updating base resume:", error);
    throw new Error(error.message);
  }

  return (data as any)?.resume_data as Resume | null;
}

// --- New Count Functions ---

/**
 * Gets the count of expired jobs.
 * @returns A promise that resolves to the number of expired jobs.
 */
export async function getExpiredJobsCount(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .eq("job_state", "expired");

  if (error) {
    console.error("Supabase count error (expired jobs):", error);
    throw new Error(error.message);
  }
  return count ?? 0;
}

/**
 * Gets the count of jobs pending to be scored (resume_score is null).
 * @returns A promise that resolves to the number of jobs pending scoring.
 */
export async function getPendingScoreJobsCount(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .is("resume_score", null)
    .eq("is_active", true) // Assuming we only count active jobs
    .eq("status", "new") // And new jobs that haven't been processed beyond initial scraping
    .eq("job_state", "new");

  if (error) {
    console.error("Supabase count error (pending score jobs):", error);
    throw new Error(error.message);
  }
  return count ?? 0;
}

/**
 * Gets the count of jobs that have already been scored (resume_score is not null).
 * @returns A promise that resolves to the number of scored jobs.
 */
export async function getScoredJobsCount(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .not("resume_score", "is", null)
    .eq("is_active", true)
    .eq("status", "new")
    .eq("job_state", "new");

  if (error) {
    console.error("Supabase count error (scored jobs):", error);
    throw new Error(error.message);
  }
  return count ?? 0;
}

/**
 * Gets the count of jobs which have a custom resume generated (customized_resume_id is not null).
 * @returns A promise that resolves to the number of jobs with a custom resume.
 */
export async function getCustomResumeJobsCount(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .not("customized_resume_id", "is", null)
    .eq("is_active", true); // Assuming active jobs

  if (error) {
    console.error("Supabase count error (custom resume jobs):", error);
    throw new Error(error.message);
  }
  return count ?? 0;
}

/**
 * Gets the count of jobs which have no custom resume (customized_resume_id is null).
 * @returns A promise that resolves to the number of jobs without a custom resume.
 */
export async function getNoCustomResumeJobsCount(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .is("customized_resume_id", null)
    .eq("is_active", true); // Assuming active jobs

  if (error) {
    console.error("Supabase count error (no custom resume jobs):", error);
    throw new Error(error.message);
  }
  return count ?? 0;
}

/**
 * Gets the count of scored jobs based on the original resume.
 * (resume_score is not null AND resume_score_stage is "initial")
 * @returns A promise that resolves to the number of jobs scored with the original resume.
 */
export async function getScoredWithOriginalResumeCount(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .not("resume_score", "is", null)
    .eq("resume_score_stage", "initial")
    .eq("is_active", true)
    .eq("status", "new")
    .eq("job_state", "new");

  if (error) {
    console.error("Supabase count error (scored with original resume):", error);
    throw new Error(error.message);
  }
  return count ?? 0;
}

/**
 * Gets the count of scored jobs based on a custom resume.
 * (resume_score is not null AND resume_score_stage is "custom")
 * @returns A promise that resolves to the number of jobs scored with a custom resume.
 */
export async function getScoredWithCustomResumeCount(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .not("resume_score", "is", null)
    .eq("resume_score_stage", "custom")
    .eq("is_active", true)
    .eq("status", "new")
    .eq("job_state", "new");

  if (error) {
    console.error("Supabase count error (scored with custom resume):", error);
    throw new Error(error.message);
  }
  return count ?? 0;
}

/**
 * Gets the count of jobs from LinkedIn.
 * Filters for active, new status, and new job_state jobs by default.
 * @returns A promise that resolves to the number of LinkedIn jobs.
 */
export async function getLinkedInJobsCount(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .eq("provider", "linkedin")
    .eq("is_active", true) // Consider if these filters are always needed
    .eq("job_state", "new");

  if (error) {
    console.error("Supabase count error (LinkedIn jobs):", error);
    throw new Error(error.message);
  }
  return count ?? 0;
}

/**
 * Gets the count of jobs from Careers Future.
 * Filters for active, new status, and new job_state jobs by default.
 * @returns A promise that resolves to the number of Careers Future jobs.
 */
export async function getCareersFutureJobsCount(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .eq("provider", "careers_future")
    .eq("is_active", true) // Consider if these filters are always needed
    .eq("job_state", "new");

  if (error) {
    console.error("Supabase count error (Careers Future jobs):", error);
    throw new Error(error.message);
  }
  return count ?? 0;
}
