# AI State: Configurable Career-Lane Web App

## Goal

Provide the database schema and web control center for configurable career lanes shared with `/Users/tmaerz/projects/job-scraper`.

## Implemented

- `src/lib/archetypes/registry.ts`: six canonical lanes and explicit `software_tpm` alias.
- `supabase/migrations/202609010001_configurable_career_lanes.sql`: configuration and revision tables, per-lane geographies and queries, `(job_id, archetype)` memberships, resume profiles, protected RPCs, membership-aware reads, geography compatibility, and historical alias backfill.
- `/config`: authenticated admin editor for searches, filters, geographies, lookback, limits, processing switches, and resume readiness.
- Configuration saves use optimistic revision checks; stale editors receive HTTP 409 and keep their unsaved draft.
- Job list/detail links preserve selected membership context and show the qualifying lane state.
- Filters, insights defaults, labels, formatters, and tests use the canonical registry.

## Selection semantics

- A canonical job appears once even if it matches multiple selected lanes.
- Multi-lane projection selects a qualifying membership deterministically by score, then lane ordering/archetype.
- Details project lane state only when an archetype query parameter is supplied; otherwise legacy/global behavior remains.
- `software_tpm` canonicalizes to `technology_delivery` while legacy rows remain visible.

## Verification

- `npm test`: passes.
- `npm run typecheck`: passes.
- `npm run build`: passes.
- `npm run lint`: completes with pre-existing warnings only.
- `git diff --check`: passes.
- Multiple read-only release reviews were run and identified blockers were fixed.

## Security

- Configuration API requires a valid Supabase user and admin app metadata or an email in server-only `ADMIN_EMAILS`.
- Service role is used only by server modules and protected RPCs.
- Configuration tables use RLS and revoke direct browser access.
- Score and resume workers use separate owner-checked leases with expiry recovery.
- Secrets are not stored in scrape configuration or revisions.

## Working-tree warning

Untracked `.superpowers/` and `docs/superpowers/screenshots/` are outside the intended feature set and must not be committed accidentally. No commit, push, or remote migration was performed.

## Rollout

1. Review and apply `202609010001_configurable_career_lanes.sql` through the normal deployment workflow.
2. Configure Supabase Auth administration for `/config`.
3. Review seeded searches/filters and enable desired geographies.
4. Provision base resume profiles for lanes that should be scored or customized.
5. Run manual samples and tune precision before broad scheduled coverage.
