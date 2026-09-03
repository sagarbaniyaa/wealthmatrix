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

- `services/document-intake` (`IdentityExtractorService`, `DocumentSummarizerService`,
  `DocumentIntakeService`), wired into `modules/client-document` — Document
  Intake: OCR (tesseract.js, images) + the existing DOCX/PDF text
  extractors feed a per-document-type Claude pass that runs automatically
  right after upload. `FACT_FIND_SOURCE` fills identity fields onto the
  client's Person record (fill-empty-only, never overwrites) and creates
  a draft Fact Find via the existing `FactFindParserService`/`FactFindService`
  — the same "extract from raw text" engine Meeting-to-Fact-Find AI uses,
  just fed an uploaded document instead of meeting notes. KYC/ID/address
  proof fill identity fields only. Risk profile/bank/provider statements/
  file notes are deliberately NOT auto-written into structured fields —
  they're summarised into a client note instead, since a figure or risk
  category from an arbitrary uploaded document isn't safe to silently
  merge into fields that have their own specific provenance (WealthMatrix's
  own ATR score, adviser-verified financials). Every run writes a
  `compliance_log` entry and always saves the document even if extraction
  fails (`extraction_status`: pending/processing/done/failed/unsupported)
  — see the frontend README's Document Intake section for the known
  scanned-PDF gap and the upload UI.
- `services/email-ingestion` — reads provider replies from an adviser's
  own mailbox via IMAP + an app-specific password (not full OAuth/Gmail
  API/Microsoft Graph, which would need a Google Cloud/Azure developer
  app registered first — an app password connects immediately, at the
  cost of polling every 10 minutes instead of an instant push). A reply
  is matched to the right `compliance_provider_actions` row via a
  reference code embedded in the ORIGINAL outbound subject/body
  (`ProviderSendService` now puts `Ref: <first 8 hex chars of the
  action's own id>` in every send) — not by trusting the provider to
  preserve email threading headers. Every attachment on a matched reply
  goes through the exact same Document Intake pipeline as a manual
  upload (`DocumentIntakeService`, migration 010) — this is deliberately
  not a second extraction path. A match flips the action to RECEIVED and
  writes a `compliance_log` entry either way. Credentials are encrypted
  at rest (`CredentialCipherService`, AES-256-GCM, `ENCRYPTION_KEY` env)
  — see `common/database/run-in-tenant-context.ts` for how the `@Cron`
  poller gets a correctly tenant-scoped `EntityManager` despite having
  no HTTP request behind it (it loops every firm via the RLS-exempt
  `firm` table, then opens a proper tenant transaction per firm).
- `services/telephony` — real outbound calling ("Call Client"), separate
  from `services/call-session`'s transcription (see below for how they
  relate). Uses Twilio's "click-to-call bridge" pattern: the platform
  rings the ADVISER's own phone first (a normal call, no app/softphone
  needed), and once they answer, `<Dial>`s the client's number in —
  never a browser-based WebRTC dialer, which would need its own
  capability-token auth and audio plumbing this platform doesn't take
  on. Client/adviser numbers come from `person.phone`/`app_user.phone`
  (both pre-existing columns; `app_user.phone` gained its first real
  UI in this pass — `PATCH users/me`, self-service only, never another
  user's record). Call status (ringing/answered/completed/duration)
  arrives asynchronously via `POST /telephony/status-callback` — a
  webhook Twilio calls directly, so it has no JWT; authenticity is
  instead verified via Twilio's own HMAC request-signature scheme
  (`twilio.validateRequest`, checked against the exact public URL —
  hence `app.set('trust proxy', true)` in `main.ts`, required for
  `req.protocol`/`req.get('host')` to report correctly behind Render's
  reverse proxy). `firm_id` travels in that webhook's query string
  because `client_call_log` is RLS-protected and the webhook has no
  other way to establish tenant context before reading it — see
  `common/database/run-in-tenant-context.ts` (the same helper the email
  poller's `@Cron` job uses, for the same reason: a non-HTTP or
  externally-triggered entry point still needs one). Append-only
  (`client_call_log`, migration 016). Requires a real Twilio account —
  see `.env.example` for the exact setup steps; degrades to a clear 503
  if unconfigured, same as every other optional integration here.
- `services/call-session` — "Start Client Call" (live TEXT
  transcription — unrelated to whether Telephony is configured; you can
  transcribe a call placed any other way, or transcribe the actual
  Telephony-placed call if you have the page open and aren't on a
  headset). Two deliberately
  separate pieces:
  1. **Live suggestions** (`call-suggestion.constants.ts` +
     `getSuggestions()`) — deterministic keyword matching over the
     running transcript, not an AI call, so it can react instantly and
     for free while the adviser is mid-conversation. Each trigger
     points at a real page already built elsewhere on this platform
     (Client Action, CGT Analysis, Retirement Cashflow, Provider Hub,
     DFM Recommendation, Fact Find) — this is a router, not a new
     source of advice.
  2. **"End Call"** (`finishCall()`) — the full transcript is saved as a
     `CALL_TRANSCRIPT` client document and routed through the EXACT SAME
     Document Intake pipeline (migration 010) a manually uploaded Fact
     Find document uses — no second extraction engine. `FactFindParserService`
     was extended (three new optional fields: `lifeEvents`, `taxConcerns`,
     `riskBehaviourNotes`, folded into `personalCircumstances` — no schema
     change) rather than duplicated, since a call transcript and meeting
     notes are the same kind of input to that engine.
  There is deliberately no audio recording/storage — the frontend uses
  the browser's own free, built-in speech recognition to produce a live
  TEXT transcript, which sidesteps both a paid transcription API's cost
  and the extra data-protection burden of retaining an actual voice
  recording, while still giving a searchable, timestamped compliance
  record.
- `services/cgt-intelligence` — CGT & Portfolio Intelligence. Analyses a
  household's PERSONALLY-held investment accounts (entity/trust-held
  assets are out of scope — their CGT treatment is genuinely different
  and more complex) for unrealised gains, using UK Section 104 pooling
  (a chronological running weighted-average cost per holding, walked
  through its `transaction` BUY/SELL history) — same-day/30-day "bed and
  breakfast" share-matching is NOT implemented, a documented gap, not a
  silent one. Requires `account.tax_wrapper` to be set (migration 014) —
  an ISA/SIPP is excluded as CGT-exempt, a bond is excluded as taxed on
  chargeable-event gains instead, and an UNSET wrapper is excluded too
  rather than guessed either way, since guessing wrong is worse than
  flagging the gap. Outputs, per person (the CGT allowance is personal,
  not household-level): net unrealised gain, remaining annual exempt
  amount, estimated tax at both current UK rates (basic/higher — it
  never picks one for you, since that needs a full income-tax
  computation this platform doesn't attempt) alongside a same-caveat
  "likely" band estimated from recorded `income` rows, and concrete
  recommendations (cheapest to sell, already-zero-CGT holdings, the
  largest embedded gain to avoid disturbing, and how much of this year's
  allowance is unused). Entirely deterministic arithmetic — see
  `cgt-rates.constants.ts` for the one place the UK constants
  (annual exempt amount, rates, higher-rate threshold) live, since
  those change nearly every tax year. Append-only (`cgt_analysis`,
  migration 015).
- `services/dfm-recommendation` — deterministic DFM mandate + fund
  category recommendation engine. Never names a real regulated DFM firm
  (no due-diligence/fee-panel relationship exists to back that) — outputs
  a mandate TYPE (e.g. "Balanced Growth Mandate") and a fund-category
  allocation (Global Equity/Multi-Asset/etc., no fund licensing needed)
  from a fixed rules table keyed on the household's ATR risk category,
  adjusted for stated liquidity need and investment style. Claude only
  polishes the already-computed numbers into a suitability paragraph
  (same compute-then-narrate-with-graceful-fallback shape as
  ChargeProjectionService) — never invents the mandate or weights
  itself. Append-only (`dfm_recommendation`, migration 011).
- `services/client-action` — the "What are we doing for this client?"
  selector (spec: Pension Transfer/Investment Review/New Investment/DFM
  Recommendation/ISA-GIA Setup/Retirement Planning/Consolidation/
  Protection Review). Selecting an action doesn't create new data — it
  picks a fixed requirements table (`action-requirements.constants.ts`)
  to check LIVE against every other module's real data: uploaded
  documents, Fact Find completion/risk profile, Charge Projections,
  Consumer Duty reviews, matching Report Templates/Cases, provider send
  status, DFM recommendations, and LOA template availability. Nothing is
  auto-marked "done" without a real underlying record — see
  `getChecklist()`. Append-only history (`household_action`, migration 012).
- `modules/consumer-duty`, `services/consumer-duty` — FCA Consumer Duty
  (PRIN 2A) monitoring. Vulnerability is NOT a new data model: it's read
  straight off each household's latest `fact_find.personal_circumstances`
  (health status, affects-understanding, needs-additional-support,
  vulnerability notes — already captured by the Fact Find). The four
  Consumer Duty outcomes (price & value, products & services, consumer
  understanding, consumer support) are a separate, append-only, dated
  adviser attestation (`consumer_duty_review`, migration 009) — the
  service deliberately does not compute an automatic score for price &
  value or products & services, since the platform holds no real fee-
  benchmarking or target-market data to score them honestly from; an
  outcome is either a genuine dated "met"/"concern" call or shows
  plainly as "not assessed". `GET consumer-duty` is the firm-wide
  register (scoped the same way `findAllForUser` scopes the household
  list); `GET/POST households/:householdId/consumer-duty` is the
  household-level read-off + review history.

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
