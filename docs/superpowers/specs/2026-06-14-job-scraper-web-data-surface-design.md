# Job Scraper Web Data Surface Design

## Goal

Surface the scraper's job metadata and keyword insights, then add one URL-driven filter experience across the job and insights pages. The rollout has three independently verifiable phases.

## Confirmed Constraints

- Pages remain Next.js App Router server pages. Server components parse `searchParams`, perform Supabase reads, and pass serializable data to client components.
- Browser code never creates a Supabase client or imports server query modules. Client-side suggestion controls call same-origin API routes only.
- Supabase uses `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The service-role key is read only from server-only modules and must never use a `NEXT_PUBLIC_` name.
- The URL is the source of truth for search, filters, sorting, and pagination. Drawer state and suggestion input text are the only local UI state.
- `FilterButton` owns drawer open/close state and renders the trigger plus the drawer. Pages stay server components.
- On mobile, filters open as a full-screen modal drawer. On desktop, they open as a non-modal fixed right drawer while page content remains interactive.
- Filter controls use native form semantics: `<fieldset>` and `<legend>` for groups, and an associated `<label>` for every input.
- The database contains `jobs` and denormalized `job_keyword_insights(job_id, keyword, category, archetype, provider)`.
- Filtered insights are aggregated in PostgreSQL through an RPC. The application must not join datasets in the browser or send large job-ID lists between queries.
- Company and title endpoints return capped, query-matched suggestions. They are not APIs for scanning every distinct value.

## Shared Data Contract

### Job Levels

The only level values emitted to the URL or database predicates are:

1. `Not Applicable`
2. `Mid-Senior level`
3. `Associate`
4. `Entry level`
5. `Director`
6. `Executive`
7. `Internship`

Labels may be styled, but values must not be lowercased, slugged, or shortened before querying. The application-status offer value is exactly `offer`, never `offered`.

### URL Contract

`src/lib/filters/searchParams.ts` provides the single parser used by all four server pages and by client filter/chip components. It validates values, ignores unsupported values, clamps numeric ranges, applies page defaults, and returns a typed filter object. Repeated keys represent multi-select values.

| Concern | Search parameter | Rules |
|---|---|---|
| Pagination | `page` | Positive integer; default `1` |
| Page size | `pageSize` | `10`, `25`, `100`, or `all`; default `25` |
| Text search | `query` | Trimmed string |
| Provider | `provider` | Single known provider |
| Interest | `interest` | `true`, `false`, or `null` |
| Score | `minScore`, `maxScore` | Integers from `0` through `100`; min must not exceed max |
| Level | `level` | Repeated exact database values listed above |
| Archetype | `archetype` | Repeated non-empty values |
| Filter state | `filterStatus` | Absent excludes filtered jobs; `show_filtered` includes all jobs; `entry_level` selects entry-level-filtered jobs |
| Salary | `hasSalary`, `salaryMin`, `salaryMax` | `hasSalary=true` enables non-negative range values |
| Lifecycle | `minRepostCount`, `minSeenCount` | Non-negative integers |
| Posted date | `datePosted` | `24h`, `7d`, `30d`, or absent for all time |
| Application | `applicationStatus` | Applied page only; offer is `offer` |
| Insights entities | `company`, `jobTitle` | Repeated exact suggestion values |
| Geography | `province`, `locationScope`, `excludeMetro` | Repeated province codes, local/province/country scope, and metropolitan exclusions |
| Insights category | `category` | `all`, `skill`, `technology`, `certification`, or `attribute` |
| Sorting | `sortBy`, `sortOrder` | Page-specific field whitelist; order is `asc` or `desc` |

Changing any search or filter value removes `page`; changing only sort also removes `page`. Removing a chip removes only that key/value and preserves unrelated URL state. Empty/default values are omitted where absence has the same meaning.

## Phase 1: Server-Rendered Data Display

### Job Cards

Add compact metadata to cards used by new, top-match, and applied lists:

- Level badge using the stored level value.
- Archetype badge when present.
- `Seen N×` when `seen_count` is positive.
- A warning badge containing `filter_reason` only when `is_filtered` is true.

Shared formatter functions handle nulls and display text; they do not transform query values.

### Job Detail

The job detail server page fetches the job, listing instances, and matching `job_keyword_insights` rows by `job_id` in parallel. `JobDetailsClient` receives all data as props; it does not fetch Supabase data.

The detail layout contains the existing primary content and a right metadata sidebar with three expanded-by-default sections:

1. Filter Info: archetype, filter profile, search query, filtered state/reason, and entry-level-filtered state.
2. Job Lifecycle: canonical key, first/last seen timestamps, seen/repost counts, original/latest job IDs, and listing instances.
3. Keyword Insights: keywords grouped by category, with category-specific badge styling and an empty state.

### Phase 1 Acceptance Criteria

- [ ] New, top-match, and applied cards render available level, archetype, seen-count, and filter-reason metadata without changing card navigation.
- [ ] Exact job level values render correctly, including `Not Applicable` and `Mid-Senior level`.
- [ ] The detail page performs all job, lifecycle, and keyword reads on the server.
- [ ] Keyword detail data comes directly from `job_keyword_insights` filtered by `job_id`.
- [ ] The three detail sections are visible, expanded initially, responsive, and have useful empty states.
- [ ] No service-role credential or Supabase read is present in a client bundle.

## Phase 2: Shared URL-Driven Filter Drawer

### Component Boundaries

- `FilterButton.tsx` is the client boundary that owns `isOpen`, renders the trigger, and renders `JobFiltersDrawer`.
- `JobFiltersDrawer.tsx` receives `isOpen`, `onClose`, and `supportedFilters`; it derives selected values from the shared URL parser and writes URL updates through Next.js navigation.
- `FilterChips.tsx` derives chips from the same parser and removes one URL value at a time.
- `SortOptions.tsx` uses the same URL update utility and a page-specific sort whitelist.
- Server pages parse the URL once and pass the typed result to server-only query functions for both rows and counts.

Mobile behavior uses a full-viewport dialog with backdrop, `aria-modal="true"`, focus containment, Escape close, explicit close button, and body-scroll lock. Desktop behavior uses a fixed right panel with no modal semantics, no backdrop, and no focus trap. The trigger's `aria-expanded` and `aria-controls` reflect drawer state in both modes.

### Supported Filters

| Page | Filters |
|---|---|
| `/jobs/new` | provider, interest, score, level, archetype, filter status, salary, repost count, seen count, date posted |
| `/jobs/top-matches` | provider, interest, score, level, archetype, filter status, salary, repost count, seen count, date posted |
| `/jobs/applied` | provider, application status, level, archetype, filter status, salary, repost count, seen count, date posted |
| `/insights` | provider, archetype, level, filter status, company, job title |

All list queries and their count queries apply identical predicates. Job-list filtering may use direct `jobs` queries. Existing page eligibility rules remain intact. Supported sorts are posted date, resume score, application date on the applied page, salary, repost count, and seen count; salary nulls sort last.

### Phase 2 Acceptance Criteria

- [ ] All job pages remain server pages and share one validated `searchParams` parser.
- [ ] Refresh, back/forward navigation, copied URLs, and pagination reproduce the same result and visible controls.
- [ ] `FilterButton` alone owns drawer state; no page is converted to a client component to open filters.
- [ ] Mobile uses a full-screen modal drawer and desktop uses a non-modal right drawer.
- [ ] Every filter input has a native label, and related radios/checkboxes are grouped by fieldset and legend.
- [ ] The level filter submits only the seven exact database values.
- [ ] The application status option and predicate use `offer`.
- [ ] Active chips remove one value without dropping search, sort, or unrelated filters.
- [ ] Row and count queries use identical predicates, validated sort fields, deterministic secondary ordering, and page bounds.
- [ ] No browser-side Supabase read is introduced.

## Phase 3: Filtered Insights and Searchable Suggestions

### Insights Aggregation RPC

Add a versioned database migration defining `get_filtered_keyword_insights`. It starts from `job_keyword_insights`, joins `jobs` on `job_id` inside PostgreSQL, applies optional provider, archetype, level, filtered-state, company, job-title, and category predicates, then groups by keyword and category. Counts use distinct `job_id`. Results are ordered by count descending and keyword ascending and support aggregate-result limit/offset plus a total aggregate-row count.

The server-only insights query calls this RPC directly with parsed URL filters. No job IDs are returned as an intermediate result, and `InsightsClient` only handles presentation such as category display and word-cloud/list rendering.

### Suggestion Endpoints

`GET /api/jobs/companies` and `GET /api/jobs/titles` accept `q` and optional `limit`. Each route:

- Runs only on the server with the service-role client.
- Trims and bounds `q`, clamps `limit` to `1..20`, and returns at most that many unique matching suggestions.
- Calls a database-side, allowlisted suggestion function so deduplication and limiting occur before rows reach Next.js.
- Returns `{ data: string[] }` and a controlled error response; it never returns arbitrary rows or credentials.

`SearchableMultiSelect` debounces requests, cancels stale requests, exposes loading/empty/error states, uses native labels and keyboard-operable options, and writes selected exact values to repeated URL parameters. Its text query remains ephemeral local state.

### Phase 3 Acceptance Criteria

- [ ] Filtered insights are produced by `get_filtered_keyword_insights` from `job_keyword_insights` plus `jobs` entirely inside PostgreSQL.
- [ ] Provider, archetype, exact level, filter status, company, title, and category filters compose correctly and survive URL navigation.
- [ ] Insight counts represent distinct matching jobs and have deterministic ordering and pagination.
- [ ] No client-side join, unbounded distinct scan, or job-ID fan-out is used.
- [ ] Company and title endpoints return no more than 20 query-matched unique suggestions.
- [ ] Suggestion routes and RPCs are service-role-only, validate inputs, and return controlled errors.
- [ ] Searchable multi-selects are labeled, keyboard operable, race-safe, and preserve exact selected URL values.
- [ ] Existing insights category views, word cloud, top list, empty state, and error state continue to work with filtered server data.

## Verification

The npm package setup must provide `typecheck` as `tsc --noEmit` and replace the obsolete `next lint` script with ESLint CLI configuration. Verification for every phase is:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Manual checks cover desktop and mobile drawer semantics, keyboard navigation, URL back/forward behavior, exact level and `offer` values, count/list agreement, detail empty states, capped suggestions, and filtered-insight combinations.

## Out of Scope

- Client-side Supabase reads or client-side relational joins.
- Fetching complete company/title dictionaries.
- A separate client filter store or filter hook.
- Changes to scraper ingestion or the meaning of existing database fields.
