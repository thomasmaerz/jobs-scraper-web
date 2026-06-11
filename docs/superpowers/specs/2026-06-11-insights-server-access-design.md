# Insights Server Access Design

## Goal

Make `/insights` use the same Supabase access model as the rest of the web UI by moving data fetching to the server-side service-role path instead of browser anon access.

## Current Problem

The current insights page is a client component that creates its own browser Supabase client with `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The rest of the application primarily reads data through server-side helpers in `src/lib/supabase/queries.ts`, which use `createSupabaseServerClient()` and the service-role key. This mismatch causes `/insights` to see zero rows when Row Level Security blocks anon reads on `keyword_insights`, even though the data exists and other server-side contexts can read it.

## Recommended Approach

Convert the insights feature to the same pattern used elsewhere in the application:

1. Add a server-side query function in `src/lib/supabase/queries.ts` for reading `keyword_insights`.
2. Make `src/app/insights/page.tsx` a server-rendered page that fetches insights data before rendering.
3. Move interactive tab/filter behavior into a dedicated client component that receives already-fetched data as props.
4. Remove direct Supabase browser access from the insights feature.

This keeps data access consistent across the app and avoids making `/insights` depend on anon-role RLS policies.

## File Responsibilities

### `src/lib/supabase/queries.ts`
- Add a `getKeywordInsights()` server query.
- Optionally add small helper types for the returned rows if needed.

### `src/app/insights/page.tsx`
- Become a server component.
- Fetch insights rows with the server-side query helper.
- Handle top-level empty and error states consistently with the rest of the app.
- Pass loaded data into a presentational/interactivity client component.

### `src/components/insights/InsightsClient.tsx`
- New client component.
- Own category switching, counts, word cloud rendering, and top list rendering.
- Receive fetched rows as props instead of fetching them directly.

## Data Flow

1. Request comes in for `/insights`.
2. Server page calls `getKeywordInsights()`.
3. Query runs with the existing server-side Supabase helper.
4. Rows are returned to the server page.
5. Server page renders the page and passes rows to `InsightsClient`.
6. Client component handles category switching locally in React state.

## Error Handling

- If the query throws, the server page should render a clear error state.
- If the query succeeds with zero rows, the page should render a clear empty state.
- The client component should not contain any direct networking logic.

## Testing and Verification

- Verify `npm run build` still passes.
- Verify `/insights` route is registered.
- Verify `/insights` shows real data when service-role server access can read `keyword_insights`.
- Verify category switching still works after the refactor.
- Verify no direct `createClient()`/browser Supabase usage remains in the insights feature.

## Scope Boundaries

This change does not:

- redesign the visuals of the insights page,
- add new analytics calculations,
- change the database schema,
- require adding or modifying RLS policies for `keyword_insights`.

## Decision

Approved approach: use server-side/service-role access for `/insights` so it matches the rest of this app.
