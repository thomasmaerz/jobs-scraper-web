# Job Scraper Web Data Surface Implementation Plan

**Goal:** Implement the three-phase data surface in the companion design while keeping Next.js pages server-rendered, Supabase reads server-only, and filter state URL-driven.

**Success:** Each phase meets its acceptance checklist and the repository passes `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

## Ground Rules

- Modify only files required by the tasks. Preserve current page eligibility behavior while extending predicates.
- Keep `src/app/**/page.tsx` files as server components. Do not add `"use client"` to a page.
- Keep all Supabase reads in server-only query modules or route handlers. Client components may call same-origin suggestion endpoints.
- Use `SUPABASE_SERVICE_ROLE_KEY`; remove the incorrect `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` reference. Never serialize or log the key.
- Use the URL as the source of truth. Local state is limited to drawer visibility, pending text input, and transient request state.
- Track progress with the checklist below; implementation completed on 2026-08-22.

## Phase 1: Server-Rendered Data Display

### Task 1: Establish Server and Tooling Boundaries

**Files:**

- Modify `src/utils/supabase/server.ts`
- Modify `src/lib/supabase/queries.ts`
- Modify `package.json`
- Modify `package-lock.json`
- Create `eslint.config.mjs`

- [x] Import a server-only guard in the server Supabase module and query module.
- [x] Configure the server client with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; fail clearly when either server requirement is missing.
- [x] Ensure no client component imports `src/utils/supabase/server.ts` or `src/lib/supabase/queries.ts`.
- [x] Add the `typecheck` script as `tsc --noEmit`.
- [x] Replace `lint: next lint` with `lint: eslint .`; add ESLint and the matching Next.js ESLint config as development dependencies and create flat config for Next.js and TypeScript.
- [x] Preserve the existing `test` and `build` scripts.
- [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` after resolving pre-existing script incompatibility.

**Acceptance:**

- [x] `SUPABASE_SERVICE_ROLE_KEY` is referenced only by server-only code and no `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` reference remains.
- [x] The four verification commands exist and invoke tools installed in `package.json`.
- [x] A production build does not expose the service-role key in emitted client assets.

### Task 2: Define Data Types and Formatters

**Files:**

- Modify `src/types.ts`
- Modify `src/lib/jobs/formatters.ts`

- [x] Make nullable scraper fields accurately nullable without inventing fields outside the confirmed schema contract.
- [x] Add a `JobKeywordInsight` type containing `job_id`, `keyword`, `category`, `archetype`, and `provider`.
- [x] Add null-safe display formatters for seen count, repost count, filter reason, dates, and level labels.
- [x] Keep job level query values unchanged; display formatting must accept all seven exact values.
- [x] Add focused formatter tests using the repository's Node test setup where behavior is not already covered.

**Acceptance:**

- [x] Types represent `job_keyword_insights(job_id, keyword, category, archetype, provider)` directly.
- [x] `Not Applicable` and `Mid-Senior level` pass through without lossy normalization.
- [x] Empty optional values render no misleading badge text.

### Task 3: Add Server-Only Detail Queries

**Files:**

- Modify `src/lib/supabase/queries.ts`
- Modify `src/app/jobs/[job_id]/page.tsx`
- Modify `src/components/jobs/JobDetailsClient.tsx`

- [x] Add a server-only query for `job_keyword_insights` filtered by exact `job_id`, ordered by category then keyword.
- [x] Extend the job detail read to include `listing_instances`, or add a separate server query if that preserves existing query behavior more safely.
- [x] Fetch job-related detail datasets on the server and pass serializable results into `JobDetailsClient`.
- [x] Remove any need for detail client effects to fetch Supabase data.
- [x] Expand the detail page container enough for primary content plus the metadata sidebar.
- [x] Render expanded-by-default Filter Info, Job Lifecycle, and Keyword Insights sections with null-safe rows and empty states.
- [x] Group keyword rows by category and retain exact keywords.

**Acceptance:**

- [x] Loading a detail URL causes no browser request to Supabase.
- [x] Keyword data is selected from `job_keyword_insights` by `job_id`.
- [x] Listing instances and all three metadata sections render without hiding the existing description and actions.
- [x] Missing lifecycle or keyword data produces a useful empty state instead of an exception.

### Task 4: Surface Metadata on Job Cards

**Files:**

- Modify `src/components/jobs/TopMatchesList.tsx`
- Modify `src/components/jobs/AppliedJobsList.tsx`

- [x] Add level and archetype badges without changing stored values.
- [x] Show `Seen N×` only for a positive count.
- [x] Show the filter warning only when `is_filtered` is true and a reason exists.
- [x] Preserve card links, actions, responsive truncation, and existing score/status content.

**Phase 1 Gate:**

- [x] New, top-match, applied, and detail pages satisfy all Phase 1 design acceptance criteria.
- [x] `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` pass.

## Phase 2: Shared URL-Driven Filter Drawer

### Task 5: Implement the Shared URL Contract

**Files:**

- Create `src/lib/filters/types.ts`
- Create `src/lib/filters/searchParams.ts`
- Create `src/lib/filters/searchParams.test.ts`

- [x] Define typed filter IDs, page-specific supported-filter lists, sort fields, sort order, and parsed state.
- [x] Define the level options exactly as `Not Applicable`, `Mid-Senior level`, `Associate`, `Entry level`, `Director`, `Executive`, and `Internship`.
- [x] Define application offer as `offer` and reject `offered`.
- [x] Parse both Next.js page `searchParams` records and `URLSearchParams` through one implementation.
- [x] Support repeated `level`, `archetype`, `company`, and `jobTitle` keys without lowercasing or slugging values.
- [x] Validate enum values, trim text, clamp score/page/count/salary inputs, reject inverted ranges, and whitelist sorts by page.
- [x] Add helpers that update one filter, reset pagination, and preserve unrelated parameters.
- [x] Use a URL-backed page-size selector with a default of 25 and choices 10, 25, 100, and unlimited.
- [x] Test defaults, malformed numbers, exact levels, repeated values, `offer`, unsupported values, and chip removal.

**Acceptance:**

- [x] All pages and client controls consume the same parser behavior.
- [x] Invalid URL input cannot become an arbitrary database column, sort direction, or predicate value.
- [x] Updating one filter preserves unrelated search and sort state and removes `page`.

### Task 6: Extend Job Queries with Identical Row/Count Predicates

**Files:**

- Modify `src/lib/supabase/queries.ts`
- Add or modify query tests beside `src/lib/supabase/queries.ts`

- [x] Replace positional query arguments with typed options objects at the touched call sites.
- [x] Apply provider, interest, score, exact levels, archetypes, filter status, salary, repost count, seen count, posted-date cutoff, and text search as applicable.
- [x] Keep each page's current base eligibility predicates unchanged.
- [x] Use the same predicate application for paged rows and exact counts.
- [x] Use direct `jobs` queries where existing RPC signatures cannot safely express the filters.
- [x] Apply only page-whitelisted sort fields, put salary nulls last, add deterministic secondary ordering, and calculate an inclusive page range.
- [x] Ensure the applied page sends application status `offer` unchanged.
- [x] Test representative predicate combinations and count/list parity through query mocks or a development database.

**Acceptance:**

- [x] Every visible filter affects rows and total count identically.
- [x] Existing new/top-match/applied eligibility remains intact when no new filter is present.
- [x] No list query interpolates an unvalidated sort field or raw search expression.

### Task 7: Build the Responsive Drawer and Controls

**Files:**

- Modify `src/components/jobs/FilterButton.tsx`
- Create `src/components/jobs/JobFiltersDrawer.tsx`
- Create `src/components/jobs/FilterChips.tsx`
- Modify `src/components/jobs/SortOptions.tsx`

- [x] Make `FilterButton` own `isOpen` and render both its trigger and `JobFiltersDrawer`.
- [x] Give the trigger stable `aria-controls` and synchronized `aria-expanded` attributes.
- [x] Render a full-screen modal dialog with backdrop, focus containment, Escape close, close button, and scroll lock below the desktop breakpoint.
- [x] Render a fixed, non-modal right drawer with no backdrop or focus trap at the desktop breakpoint.
- [x] Render only the filter groups named in `supportedFilters`.
- [x] Use `<fieldset>`/`<legend>` for grouped choices and associated `<label>` elements for every input.
- [x] Derive selected values from the shared parser; update the URL rather than maintaining duplicate filter state.
- [x] Render removable active chips from parsed URL state and preserve unrelated state on removal.
- [x] Extend sort controls with posted date, resume score, application date where supported, salary, repost count, and seen count.

**Acceptance:**

- [x] `FilterButton` is the only owner of drawer open/close state.
- [x] Mobile and desktop drawer behavior matches the modal/non-modal design exactly.
- [x] Keyboard and screen-reader users can identify, operate, and close every control.
- [x] Back/forward navigation updates controls and chips without state drift.

### Task 8: Integrate Server Job Pages

**Files:**

- Modify `src/app/jobs/new/page.tsx`
- Modify `src/app/jobs/top-matches/page.tsx`
- Modify `src/app/jobs/applied/page.tsx`

- [x] Parse each page's awaited `searchParams` with the shared parser.
- [x] Pass typed filters into row and count queries.
- [x] Render `FilterButton` with the exact per-page supported-filter list.
- [x] Render `FilterChips` above results and page-specific `SortOptions` beside existing header actions.
- [x] Keep all three files as async server components.
- [x] Verify pagination links preserve search, filter, and sort parameters.

**Phase 2 Gate:**

- [x] All three job pages satisfy the Phase 2 URL, accessibility, responsive, and query-parity criteria.
- [x] Exact level values and `offer` are visible in generated URLs and database parameters.
- [x] `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` pass.

## Phase 3: Filtered Insights and Searchable Suggestions

### Task 9: Add Database-Side Aggregation and Suggestions

**Files:**

- Create `supabase/migrations/202606140001_data_surface_rpcs.sql`

- [x] Create `get_filtered_keyword_insights` with optional provider, archetype, level, `is_filtered`, company, job-title, category, minimum-count, limit, and offset parameters.
- [x] Start from `job_keyword_insights`, join `jobs` on `job_id` in SQL, filter before aggregation, group by keyword/category, and count distinct `job_id`.
- [x] Return keyword, category, job count, total aggregate-row count, and deterministic count-descending/keyword-ascending order.
- [x] Create an allowlisted `search_job_filter_suggestions` function accepting only `company` or `jobTitle`, a bounded query string, and a maximum limit of 20.
- [x] Deduplicate, sort, and limit suggestions inside PostgreSQL before returning rows.
- [x] Revoke function execution from public/anonymous/authenticated roles and grant execution to `service_role` only.
- [x] Apply the migration to a development Supabase database and test empty, single-filter, combined-filter, no-result, wildcard-text, and limit-boundary cases.

**Acceptance:**

- [x] Filtered insight aggregation performs one database-side relational operation and transports no intermediate job-ID list.
- [x] Insight counts use distinct matching jobs and pagination reports a stable total.
- [x] Suggestion SQL cannot select an arbitrary column and cannot return more than 20 values.
- [x] Neither RPC is executable by browser roles.

### Task 10: Wire Server-Only Insights Queries

**Files:**

- Modify `src/lib/supabase/queries.ts`
- Modify existing keyword-insight tests under `src/lib/supabase/`

- [x] Replace full-table keyword scans with calls to `get_filtered_keyword_insights`.
- [x] Map parsed insight filters directly to RPC parameters; map `filterStatus=filtered` to true, `unfiltered` to false, and `all`/absent to null.
- [x] Page through aggregate results when the UI needs more than one RPC page; never page through job IDs.
- [x] Preserve controlled server errors and return the total aggregate-row count.
- [x] Update tests to assert RPC name, exact parameters, deterministic pagination, and no client factory use.

**Acceptance:**

- [x] The query layer does not read `jobs` and `job_keyword_insights` separately for filtered aggregation.
- [x] All insight filter combinations map to typed RPC arguments.
- [x] Existing keyword insight tests pass against the RPC-backed behavior.

### Task 11: Add Capped Suggestion APIs and Control

**Files:**

- Create `src/app/api/jobs/companies/route.ts`
- Create `src/app/api/jobs/titles/route.ts`
- Create `src/components/jobs/SearchableMultiSelect.tsx`

- [x] Implement both GET routes as server-only adapters to the allowlisted suggestion RPC.
- [x] Trim and cap `q`, clamp `limit` to `1..20`, and always return `{ data: string[] }` on success.
- [x] Return stable 400 responses for invalid input and sanitized 500 responses for database failures.
- [x] Build a labeled, keyboard-operable multi-select that debounces input and aborts stale requests.
- [x] Provide loading, no-results, and request-error states without clearing selected values.
- [x] Keep only suggestion text/request state local; write selections as repeated exact URL values.
- [x] Add route and component behavior tests compatible with the existing Node test setup where practical.

**Acceptance:**

- [x] Neither endpoint performs or claims an unbounded distinct scan.
- [x] Responses contain at most 20 unique query-matched strings.
- [x] Rapid typing cannot let an older response overwrite newer suggestions.
- [x] Company/title selections survive refresh and back/forward navigation.

### Task 12: Integrate the Insights Server Page

**Files:**

- Modify `src/app/insights/page.tsx`
- Modify `src/components/insights/InsightsClient.tsx`

- [x] Parse insight `searchParams` through the shared parser on the server.
- [x] Fetch aggregated insights with provider, archetype, exact level, filter status, company, title, and category RPC parameters.
- [x] Render `FilterButton` with the insights supported-filter list and render active chips.
- [x] Place company and title searchable controls in the shared drawer.
- [x] Keep `InsightsClient` presentation-only; category actions update the URL rather than filtering a stale unfiltered dataset.
- [x] Preserve word cloud, top list, category labels, aggregate total, empty state, and controlled error state.
- [x] Verify there are no browser Supabase requests and no job-ID payloads.

**Phase 3 Gate:**

- [x] The insights page satisfies every Phase 3 design acceptance criterion.
- [x] Combined provider/archetype/level/filter-status/company/title/category URLs return correct database-aggregated counts.
- [x] Suggestion endpoints remain capped and service-role-only.
- [x] `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` pass.

## Final Verification

- [x] Run `npm test`.
- [x] Run `npm run typecheck`.
- [x] Run `npm run lint`.
- [x] Run `npm run build` with server Supabase environment variables set.
- [x] Test `/jobs/new`, `/jobs/top-matches`, `/jobs/applied`, `/jobs/[job_id]`, and `/insights` at mobile and desktop breakpoints.
- [x] Test keyboard-only drawer open/close, focus behavior, labels, fieldsets, chips, suggestions, and Escape handling.
- [x] Test copied URLs plus browser back/forward for filters, repeated values, category, sort, and pagination.
- [x] Confirm row/count parity and salary null ordering on each job page.
- [x] Confirm exact level values and `applicationStatus=offer` reach server query parameters unchanged.
- [x] Inspect browser network traffic and production client assets for Supabase reads, service-role credentials, and intermediate job-ID lists; none may be present.
