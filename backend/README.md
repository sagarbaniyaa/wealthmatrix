# WealthMatrix Enterprise — Backend

NestJS backend implementing the multi-entity UHNI wealth engine described in
the product spec, on top of the PostgreSQL schema (RLS + audit + FX +
effective-dated ownership) delivered previously.

## Architecture, in one page

**Request lifecycle for every authenticated call:**

1. `JwtAuthGuard` validates the bearer token, decodes `{ sub, firmId, role,
   email, personId }` and sets `req.user`. No DB access happens here.
2. `TenantTransactionInterceptor` (global) opens a single DB transaction on
   a dedicated `QueryRunner`, runs
   `set_config('app.current_firm_id', ...)` / `('app.current_user_id', ...)`
   on that connection, and stores the transaction's `EntityManager` in an
   `AsyncLocalStorage` (`TenantContext`).
3. Every service extends `BaseCrudService`, which pulls its repository from
   `TenantContext.getManager()` — never from the default injected
   repository. This is what makes Postgres RLS actually see the right
   tenant on every query, and what makes the `audit_row_change()` trigger
   able to attribute writes to the acting user.
4. On success the interceptor commits; on any thrown error it rolls back.
   `AllExceptionsFilter` (global) turns Postgres constraint violations
   (unique/check/FK/RLS-denial) into clean 4xx responses instead of leaking
   raw SQL errors — several business rules (ownership % ≤ 100, no
   overlapping ownership stakes, exactly-one-owner-side) are enforced at
   the DB level as the non-bypassable source of truth, with class-validator
   DTOs as the fast-feedback first line.

**Why this matters:** RLS is only a real security boundary if application
code cannot accidentally query through a connection that never had
`app.current_firm_id` set. The ALS + single-QueryRunner-per-request pattern
is the load-bearing piece of this backend — read
`common/database/tenant-transaction.interceptor.ts` first.

## Module map

- `modules/*` — one module per table (`firm`, `currency`, `exchange-rate`,
  `person`, `household`, `household-member`, `adviser-household-assignment`,
  `entity`, `entity-ownership`, `account`, `asset`, `holding`, `transaction`,
  `scenario`, `risk-exposure`, `compliance-log`, `structure-version`), each
  with DTOs + service (extends `BaseCrudService`) + controller (RBAC via
  `@Roles()`) + module.
- `services/wealth-consolidation` — **WealthConsolidationService**: the
  household net-worth engine. Recursive, cycle-safe CTE computes each
  household member's effective % ownership through the entity graph;
  entity NAV is summed from holdings (netting liabilities) and converted to
  the firm's base currency at as-of-date FX rates; personal + Σ(entity NAV ×
  effective %) = household net worth.
- `services/entity-structure` — **EntityStructureService**: builds the
  node/edge graph payload the frontend's entity structure map renders
  directly, current or as-of a historic date.
- `services/scenario-engine` — **ScenarioEngineService**: pluggable
  per-event-type handlers (`EVENT_HANDLERS` map). `business_sale` is fully
  implemented (baseline vs projected net worth, net-of-CGT proceeds,
  removes the sold entity's attributed value) as the flagship example
  matching the product spec's own worked example. Other event types have
  working-but-simplified handlers with their assumptions called out in
  comments — treat as a scaffold for the tax/legal team, not compliant
  advice as shipped.
- `services/audit-log` — read-only interface over `audit_log`. Writes are
  exclusively via the Postgres trigger; there is deliberately no
  `create()` here.
- `services/fx-conversion` — **FXConversionService**: point-in-time FX
  conversion (latest rate on/before a date, falls back to the inverse pair),
  per-request memoised.
- `auth/` — JWT strategy + login. `app_user.password_hash` is a schema
  addendum not in the original DDL (see `auth.service.ts`) — real
  deployments will likely swap this for an OIDC/SSO strategy instead of
  local credentials.
- `ai/` — endpoint contract stubs for `POST /ai/insights/:householdId` and
  `POST /ai/scenario-explain/:scenarioId`, scaffolded so the frontend can
  build against a stable contract before the AI layer (WealthAnalystService)
  lands as its own deliverable.
- `modules/fund*`, `services/fund-research` — the Fund Research Module
  (fund universe, screener, comparison, suitability, switch-impact tool,
  AI fund analyst, CSV import pipeline). See the frontend README's Fund
  Research Module section for the full endpoint/page map.
- `modules/provider`, `modules/loa-template`, `modules/client-document`,
  `modules/provider-pack`, `services/provider-hub` — the Provider
  Automation Hub (provider directory, LOA autofill engine, generated +
  uploaded client documents, one-click "Send to Provider", compliance
  logging). See the frontend README's Provider Automation Hub section for
  the full endpoint map, the autofill engine's DOCX/PDF support boundary,
  and the SMTP configuration this needs to actually send email.
- `modules/fact-find`, `services/fact-find`, `services/suitability-report`
  — Fact Find + Attitude-to-Risk questionnaire (versioned per household
  review, mostly JSONB) plus the AI-assisted Suitability Report that
  reads a household's latest completed fact find alongside its net worth/
  risk metrics/fund suitability shortlist. See the frontend README's Fact
  Find + Suitability Report section for the full data model and the
  ATR scoring model's own scoring formula.
- `modules/report-template`, `modules/report-case`, `services/report-builder`
  — the Report Template Builder: upload a real example report per type
  (ISA setup, pension transfer, crystallisation, open-ended list), extract
  its text (`mammoth` for docx, `pdf-parse` for pdf), and generate new
  reports of that type for a specific household from its fact find +
  net worth + adviser-entered case details. See the frontend README's
  Report Template Builder section for the generation prompt discipline
  and the print page's heading-parsing approach.
- `modules/charge-projection`, `services/charge-projection` — pension/plan
  transfer charge & growth projections. Both arrangements are manual
  entry (a real transfer's "old" side is very often a legacy provider not
  in our fund database); the year-by-year series is computed once and
  stored, not recalculated per view. See the frontend README's
  Pension/Plan Transfer Projections section for the "reduction in yield"
  methodology.
- `modules/household-journey`, `services/household-journey` — the Client
  Journey Pipeline: a read-only rollup of fact find / risk profile /
  provider-send / report status across every other module, no new source
  of truth. See the frontend README's Client Journey Pipeline section for
  exactly what "done" means per step, including one documented
  simplification (Suitability = ready, not generated).

- `services/fact-find/fact-find-parser.service.ts` (wired into
  `AiController` as `POST ai/fact-find-parse`) — Meeting-to-Fact-Find:
  stateless text-to-structured-JSON extraction from meeting notes/call
  transcripts, deliberately excluding the ATR questionnaire and
  declaration (those need the client's own direct answer, not an
  inference). See the frontend README's Meeting-to-Fact-Find AI section.

- `modules/portfolio-lookthrough`, `services/portfolio-lookthrough` —
  true underlying exposure across every fund a household holds, matching
  held assets to `fund.isin` and weighting by that fund's own
  `fund_holdings`/`fund_allocation`. Available to the client role too
  (their own household only) — see the frontend README's Portfolio
  Look-Through section for the matching logic and known simplifications.

- `modules/retirement-cashflow`, `services/retirement-cashflow` — Monte
  Carlo retirement sustainability modelling (2,000 simulated real-return
  paths per run, path-dependent success criterion, stored not
  recalculated per view). See the frontend README's Retirement Cashflow
  Monte Carlo section for the full methodology.

## Running it

```bash
cp .env.example .env   # fill in DB + JWT_SECRET
npm install
# Fresh database: restore db/full_dump.sql (schema + fictional demo data),
# a pg_dump of the working local database — there is no standalone base
# schema.sql in this repo; migrations/002 onward are incremental on top
# of what full_dump.sql already contains.
psql "$DATABASE_URL" -f db/full_dump.sql
npm run start:dev
```

The runtime DB role in `DB_USERNAME` **must not** have `BYPASSRLS`. Every
RLS-protected table in this schema uses `FORCE ROW LEVEL SECURITY`, so a
plain (non-superuser) database-owner role — e.g. what a managed Postgres
provider hands you by default — is enforced correctly without needing a
second, more-restricted role. See DEPLOYMENT.md at the repo root for a
full guide to deploying this to Render.

## Known gaps / next steps

- `app_user` needs a `password_hash` column added (or swap `AuthService`
  for an OIDC strategy) — not in the base schema by design.
- `WealthConsolidationService` queries per-account in a loop; fine at
  current scale, but the schema's hardening notes (materialized net-worth
  view refreshed nightly) are the intended fix once household counts grow.
- `ScenarioEngineService` runs synchronously; swap for a queued job
  (BullMQ) for long-running/Monte-Carlo-style projections without changing
  the controller contract.
- `risk_exposure` / `compliance_log` rows are written by a monitoring job
  that isn't included here — these modules are currently read + resolve
  only. A `RiskMonitoringService` (scheduled, computing leverage/
  concentration/liquidity/FX exposure per household and writing breaches
  to `compliance_log`) is a natural next addition alongside the AI layer.
