# WealthMatrix Enterprise — Frontend

Next.js 14 (App Router) frontend for the WealthMatrix backend. The app is
now three separate surfaces sharing one Next.js project: a public
marketing site, an adviser/admin platform, and a client portal.

## Site structure

```
/                     Public marketing site (no auth) — hero, services,
                      features, pricing (placeholder), about, contact.
/login/advisor        Adviser & admin sign-in (firm reference + email + password)
/login/advisor/forgot-password   Placeholder — no self-service reset flow yet
/login/client         Client sign-in — same auth call, friendlier styling
/login/client/forgot-password    Placeholder, same caveat

/advisor/*            Adviser & admin platform (was `/dashboard`, `/households`,
                      `/compliance`, `/reports`)
/advisor/research/*   Fund Research Module — funds, screener, compare,
                      suitability, switch-impact tool, model portfolios
/advisor/providers    Provider Automation Hub — provider directory + compliance send log
/advisor/households/[id]/provider-hub  Per-client LOA autofill, pack, one-click send
/advisor/households/[id]/fact-find     Fact Find + Attitude-to-Risk questionnaire, versioned per review
/print/suitability/[id]                AI-assisted Suitability Report draft
/advisor/report-templates              Report Template Builder — upload real example reports per type
/advisor/households/[id]/report-builder  Generate a new report of any uploaded type for this client
/print/report-case/[id]                 The generated report, printable
/advisor/households/[id]/projections    Pension/plan transfer charge & growth projection calculator
/client/*             Client portal (was `/portal`)

/print/*              Standalone print/export pages (no sidebar), each with a
                      "Print / Save as PDF" button — the browser's own print
                      dialog is the PDF export mechanism, no server-side
                      PDF library involved.
```

### `/advisor/*` — adviser & admin platform

- `/advisor/dashboard` — whole-book triage: every household the caller can
  see (all of them for admin, only assigned ones for an adviser — see
  Roles below), sorted worst-first by compliance/risk.
- `/advisor/households`, `/advisor/households/new`,
  `/advisor/households/[id]` — roster, client intake form, and
  per-household net-worth + AI risk-insights panel.
- `/advisor/households/[id]/profile` — the client-360 CRM view: personal
  details, income, assets & liabilities, notes — editable.
- `/advisor/households/[id]/structure` — the ownership graph, with NAV +
  effective-ownership hover tooltips.
- `/advisor/households/[id]/scenarios`, `.../[scenarioId]` — scenario
  builder + result (net-worth chart, tax/liquidity/entity-valuation
  breakdown, AI summary).
- `/advisor/compliance` — firm-wide compliance log, a "Run compliance
  scan" button (rule-based breach detection, no AI call), the audit trail
  viewer (admin only), and a PDF export link.
- `/advisor/reports` — household/entity/scenario reports plus, for admins,
  the adviser-performance report — each with an "Export →" link to the
  matching `/print/*` page.

### `/client/*` — client portal

Deliberately excludes everything adviser-only (whole-book triage,
compliance findings, other households, adviser tools):

- `/client` — dashboard: net worth, total assets/liabilities, entity
  attribution.
- `/client/profile` — read-only personal details + KYC status.
- `/client/income` — their income entries.
- `/client/assets` — their accounts and holdings (assets & liabilities).
- `/client/structure` — their ownership graph.
- `/client/notes` — read-only feed of adviser-authored notes, scoped
  server-side to their own household (`ClientNoteController` ignores any
  `householdId` a client role passes and substitutes their own).
- `/client/reports` — net worth + risk profile, printable — **no**
  compliance section (that stays adviser/admin-only).

### `/advisor/research/*` — Fund Research Module

Adviser/admin only (enforced by `middleware.ts` here and, for real,
`RolesGuard` on the backend's `FundController`/`AiController` fund
routes — a client role gets zero access, tampered cookie or not). Built
similarly to FE Analytics/Morningstar/Defaqto, but wired into the
existing wealth/risk/compliance/AI stack rather than as a bolted-on tool.

- `/advisor/research/funds` — the fund universe, server-side paginated
  and filtered (`components/research/FundsExplorer.tsx`) — every
  filter/sort/page change is a fresh query, never a client-side filter
  over an already-loaded table, so it stays fast whether there are 15
  demo funds or the real ~3,700.
- `/advisor/research/funds/[fundId]` — fund detail: stat tiles, YTD/1Y/3Y/5Y
  performance, asset allocation, top holdings, fund details, and an AI
  summary (`POST ai/fund-summary/:fundId`).
- `/advisor/research/screener` — the same explorer against
  `GET funds/screener`, plus save/apply/delete named filter sets
  (`fund_screen` table, `POST funds/screener/save`,
  `GET funds/screener/saved`, `DELETE funds/screener/saved/:id`).
  Applying a saved screen remounts the explorer (`key` bump) seeded with
  its filters — the explorer itself has no notion of "saved screens".
- `/advisor/research/compare` — pick 2–5 funds (`FundsExplorer
  mode="select"`), see cost/risk/performance/allocation side by side
  (`POST funds/compare`) plus an AI comparison summary
  (`POST ai/fund-comparison`).
- `/advisor/research/suitability/[householdId]` — funds matching a
  household's risk tolerance (`GET funds/suitability/:householdId`,
  banding the primary contact's `riskTolerance` onto the fund universe's
  1–7 risk rating) plus AI suitability notes
  (`POST ai/fund-suitability/:householdId`). Linked from the household
  detail page ("Fund suitability →").
- `/advisor/research/impact` — the "Fund → Household Impact" tool: pick a
  household and two funds, see the annual cost/OCF/risk-rating/volatility
  delta and a liquidity-change note for switching between them
  (`POST funds/impact`). Linked from a fund's detail page ("Use in switch
  impact tool →", prefilling Fund A via `?fundA=`). Fund pickers here are
  plain `<select>`s over the first 100 funds — fine at demo scale, but
  would need to become a searchable combobox (same pattern as
  `FundsExplorer`'s search field) at the real ~3,700-fund scale.
- `/advisor/research/model-portfolios` — placeholder; not built.

**Ingestion.** `POST funds/import` (adviser/admin) takes a CSV body and
upserts by ISIN via a hand-rolled parser (no new dependency) with
ISIN/SEDOL format validation. A nightly `@Cron` job
(`FundImportService.runNightlyUpdate`) is wired up but a no-op until
`FUND_DATA_SOURCE_URL` is configured with a licensed data provider — see
Known gaps below for why no real fund data ships with this repo.

### Provider Automation Hub

Adviser/admin only, same enforcement pattern as Fund Research above. Lets
an adviser fill out a Letter of Authority from data already in the
platform, assemble it with the client's other documents into one pack,
and email the whole thing to a product provider in one click — with a
compliance log of every send.

- **`/advisor/providers`** — the firm's provider directory: 34 real UK
  product providers (Quilter, Aviva, Royal London, AJ Bell, Transact,
  Standard Life, Prudential, Canada Life, Aegon, LV, HSBC Life,
  Hargreaves Lansdown, Fidelity International, Vanguard, Phoenix,
  Scottish Widows, Zurich, Legal & General, Old Mutual, MetLife, Allianz,
  AXA, BNP Paribas, Schroders, JP Morgan, BlackRock, HSBC Asset
  Management, Baillie Gifford, M&G, Rathbones, Charles Stanley, Abrdn,
  Nutmeg, Wealthify — seeded by migration `004`), each with a **guessed
  placeholder** contact email (`loa@providername.com` etc.) that starts
  unverified. Advisers can edit any of the three email fields inline and
  mark one verified (`PATCH providers/:id`, `PATCH providers/:id/verify-email`).
  Admins also see the firm-wide compliance send log here
  (`GET compliance-provider-actions`, admin-only — same pattern as the
  existing audit trail viewer).
- **`/advisor/households/[id]/provider-hub`** — the per-client workflow:
  pick a provider, pick/upload an LOA template, upload KYC/ID/address
  proof/bank statements, then **Auto-fill preview** (build the pack and
  show what's included/missing without sending — `POST
  households/:id/provider-pack/preview`), **Generate pack** (download the
  zip — `POST .../generate`), or **Send to Provider** (`POST .../send`).
  Linked from the household detail page ("Provider Hub →") and from a
  fund/household's own context where relevant.

**LOA autofill engine** (`LoaAutofillService`). Two supported template
kinds, uploaded via `POST loa-templates` (`.docx` or `.pdf`, versioned —
re-uploading the same `name` bumps `version` and deactivates the old one,
same generic-audit-trigger pattern as everywhere else rather than a
bespoke history table):
- **DOCX with `{{token}}` markers** — the reliable, general case
  (docxtemplater). An unrecognised `{{token}}` renders blank rather than
  throwing.
- **Fillable PDF forms** — `field_map` (set at upload) maps our token
  names onto that PDF's actual AcroForm field names; filled via pdf-lib,
  then flattened into a clean, non-editable document.
- **Not supported**: a flat/scanned PDF with literal `{{token}}` text and
  no form fields. Genuinely rewriting text inside an arbitrary PDF's
  content stream is a materially harder problem than either case above —
  not implemented. Use a DOCX template, or a fillable PDF, instead.

Tokens available: `client_name`, `client_first_name`, `client_last_name`,
`client_DOB`, `client_address`, `client_email`, `client_phone`,
`client_NI`, `policy_number`, `existing_provider`, `household_name`,
`adviser_name`, `adviser_email`, `adviser_phone`, `adviser_address`,
`adviser_firm`, `adviser_FCA`, `today_date`, `provider_name` (filled in
per-send once the provider is chosen). Built from whichever household
member has `relationship='head'` (else the first member) — a household
with joint applicants only autofills the primary contact, same
simplification as Fund Suitability's risk-tolerance lookup.

**The pack** (`ProviderPackService.buildPack`) always contains the filled
LOA plus three documents generated on the fly from data already in the
database — `fact_find.pdf`, `policy_summary.pdf`, `adviser_details.pdf`
(plain single-column PDFs via pdf-lib, not a polished design) — plus
whichever of KYC / ID proof / address proof / bank statements have
actually been uploaded for that household. Nothing fabricates an ID
document or bank statement; a missing one is flagged (`missingRequired`
in the preview/send response) by cross-referencing the chosen provider's
`requiredDocuments`, never silently omitted without comment.

**Sending never lies about what happened.** `ProviderMailerService` wraps
nodemailer; if `SMTP_HOST` isn't set in `.env`, or the send throws, the
logged `compliance_provider_actions` row gets `emailStatus: 'FAILED'` and
a real `emailError` message — never a fake `SENT`. A provider whose email
is still unverified blocks the send with a 400 the UI turns into a
confirm dialog ("Send anyway"); passing `overrideUnverifiedEmail: true`
proceeds. Every attempt (success or failure) is logged with the adviser,
household, provider, LOA template + version, and the exact document list
sent — status (`PENDING`/`SENT`/`RECEIVED`/`FAILED`) can be corrected
manually afterwards (`PATCH compliance-provider-actions/:id/status`) once
a provider actually confirms receipt by some other channel.

### Fact Find + Suitability Report

Modelled directly on a real UK advisory firm's Fact Find + Attitude-to-Risk
document (9 sections: purposes/objectives, personal circumstances,
income & expenditure, assets, liabilities, insurance, further
investment/retirement questions, risk profile, declaration) so it
captures what a genuine regulated fact find needs, not a simplified
stand-in.

- **`/advisor/households/[id]/fact-find`** — list of past fact finds for
  the household + "New fact find". A fact find is one row per **review**,
  not one row edited forever — circumstances (income, objectives, risk
  tolerance) genuinely change between reviews, so history accumulates
  rather than being overwritten (same versioning philosophy as LOA
  templates: a new row per version, not in-place mutation).
- **`/advisor/households/[id]/fact-find/[id]`** (or `.../new`) — the
  10-section form (`FactFindForm.tsx`), all client-side state, saved as
  one PATCH/POST (`households/:id/fact-finds`). Most sections are opaque
  JSONB on the backend (`fact_find` table) — same "flexible collection ->
  JSONB" convention as `fund_screen.filters` — rather than a dozen new
  normalised tables for every repeatable list (income sources,
  assets/pensions, liabilities, insurance policies, dependents).
  **Deliberately not integrated** with the existing Income/Account/Holding
  entities: a fact find captures the client's own declaration at
  interview time, which is a distinct concept from the platform's
  adviser-verified, custodian-fed data used everywhere else — this schema
  doesn't attempt automatic reconciliation between the two.
- **Attitude-to-risk questionnaire** (section 9) — 8 original questions
  (`GET fact-find-risk-questionnaire` serves the question bank so
  frontend and backend can't drift), each answer A-E scored 1-5
  (reverse-scored where agreeing means *lower* risk tolerance), averaged
  and rescaled to a 0-100 **WealthMatrix ATR score**, banded into
  risk_averse/conservative/balanced/adventurous/aggressive. This is
  WealthMatrix's own transparent scoring model — not a reproduction of
  any third-party proprietary risk-profiling methodology (the uploaded
  reference document's own "AHP Score" formula is undisclosed and isn't
  replicated here).
- **Marking a fact find "completed" syncs the ATR category onto
  `person.riskTolerance`** (mapped down to the simpler
  conservative/moderate/aggressive 3-band scale) for the household's
  primary contact — so Fund Suitability results
  (`/advisor/research/suitability/[id]`) stay current automatically
  without a separate manual step. Verified live: switching a
  questionnaire's answers from all-"C" (score 50, balanced) to all-"E"
  (score 87.5, aggressive) flips `person.risk_tolerance` from `moderate`
  to `aggressive` and the suitability shortlist's risk band shifts with it.
- **`/print/suitability/[id]`** — the Suitability Report: pulls the
  household's latest **completed** fact find, net worth
  (`WealthConsolidationService`), risk metrics
  (`WealthAnalystService.computeHouseholdRiskMetrics`), and a
  suitability-matched fund shortlist (`FundSuitabilityService`) into one
  document, then asks Claude to narrate — not invent — a formal
  suitability rationale from those pre-computed numbers
  (`POST ai/suitability-report/:householdId`), same discipline as every
  other AI feature in this app. Explicitly labelled "AI-assisted working
  draft... not independent financial advice" in the report itself. If no
  fact find has been completed yet, the page says so plainly instead of
  generating a report from nothing.

### Report Template Builder

A different, more general mechanism than the single fixed Suitability
Report above: the adviser uploads a **real example** of any report type
their firm produces (ISA setup, pension transfer, crystallisation — the
list is entirely open-ended, advisers introduce new types just by
uploading one), and the platform drafts *new* reports of that same type
for a specific client, in that same format, from that client's real data.

- **`/advisor/report-templates`** — upload a `.docx` or `.pdf` example
  report (`POST report-templates`, multipart). Text is extracted at
  upload time (`mammoth` for docx, `pdf-parse` for pdf) and stored
  alongside the original file — the extracted text is what actually goes
  into the AI prompt as a structure/format reference; the file itself is
  kept only so it can be re-downloaded. Same versioning convention as LOA
  templates: re-uploading the same `name` bumps `version` and retires the
  previous one.
- **`/advisor/households/[id]/report-builder`** — pick an uploaded
  template, describe the specific case in plain English (e.g. "Pension
  transfer from Aviva to Fidelity — client wants a wider fund range and
  lower charges") plus optional key-fact rows (transfer value, provider
  names, etc.), and generate (`POST households/:id/report-cases`). The
  household's latest **completed** fact find is pulled in automatically —
  no need to re-type objectives or risk profile that already exist there.
- **How generation actually works**: Claude is given the uploaded
  template's extracted text as a reference, told explicitly that it shows
  *format only* — no client-identifying detail from the reference (names,
  amounts, dates) may appear in the output — plus the new household's
  fact find summary, net worth, and the adviser's case description. It's
  instructed to mirror the reference's section structure (marked with
  `## Heading` lines) and write `[Not provided — adviser to complete]`
  anywhere it would otherwise have to invent a fact. The result is always
  editable before being marked final — a plain textarea, not a locked
  document — and if the AI call fails (e.g. no Anthropic credits), the
  case is still created with a clear `generationError` so the adviser can
  write it manually rather than losing the case details they entered.
- **`/print/report-case/[id]`** — the printable output. A small
  line-by-line renderer turns `## Heading` lines into section headers and
  everything else into paragraphs — deliberately not a full markdown
  library, since this is the one constrained subset the AI is asked to
  produce.

### Pension/Plan Transfer Projections

**`/advisor/households/[id]/projections`** — a charges-and-growth calculator, separate from (and simpler than) the Fund Research Module's Switch Impact tool: both the "old" and "new" arrangement are **manual entry** here, deliberately, because a real transfer very often involves a legacy insurance-company pension (Aviva, Standard Life, etc.) that will never be in our researched fund database — this tool doesn't assume either side is one of our funds.

- Old arrangement: name, current value, ongoing charge %, exit penalty %.
- New arrangement: name, ongoing charge %, initial charge % (reduces the amount that actually starts growing in the new plan).
- Shared assumptions: projection term (years), one gross growth rate applied to **both** sides.
- **Methodology**: standard "reduction in yield" style approach — since both arrangements compound at the *same* assumed gross rate before their own charges are deducted, 100% of the gap between the two projected curves is the charge difference, nothing else. `ChargeProjectionService.compute()` in the backend is the whole calculation, pure arithmetic, no AI involved in the numbers themselves.
- The year-by-year series is **stored**, not recalculated on every view — if the formula is ever refined later, a projection a client has already been shown stays exactly reproducible.
- An optional AI note (`ClaudeClientService`) explains the result in plain English — same non-recommending, numbers-already-computed discipline as every other AI feature here; it narrates, it doesn't judge suitability.
- Rendered with a small original SVG line chart (`ChargeProjectionChart.tsx`) — no charting library, same convention as `FundPerformanceChart`.

## Architecture

**Token handling.** The backend issues a bearer JWT; this frontend never
lets browser JS touch it. `POST /api/auth/login` (Next.js route handler,
shared by both login pages) exchanges credentials with the backend and
stores the token in an `httpOnly` cookie (`wm_token`), plus a small
non-httpOnly `wm_role` cookie purely so `middleware.ts` can redirect by
role without decoding a JWT on the edge. Every real API call goes through:

- **Server Components** — `lib/server-api.ts` (`serverApiGet` /
  `serverApiPost`), reading the httpOnly cookie server-side and calling
  the backend directly.
- **Client Components** — `lib/api.ts`, calling `/api/proxy/[...path]`,
  which attaches the httpOnly cookie server-side and forwards the request.
  Browser JS calls `api.get('households')`, never sees a token.

**Role-based routing.** `middleware.ts` gates `/advisor/*` and `/client/*`
by the `wm_role` cookie, redirecting to whichever login page matches the
path a signed-out visitor requested. This is a UX convenience only — the
real authorization boundary is the backend's `RolesGuard` + Postgres RLS
+ the adviser-household-assignment check in `HouseholdService`: a
tampered `wm_role` cookie gets a client past the Next.js redirect but
every subsequent data call still 403s, because the JWT's actual
role/firmId (verified server-side) is what the backend trusts.

**Design system.** Dark "ledger" palette — ink surfaces, brass for
ownership/value figures, verdigris for compliance/positive, rust for
breach/negative — deliberately not the generic cream+terracotta-serif or
near-black+neon defaults. Fraunces (display, used sparingly) + IBM Plex
Sans (UI) + IBM Plex Mono (every number, tabular figures). The public
site and adviser login carry this same identity; the client login is
deliberately lighter/friendlier (white "paper" surface, verdigris accent,
rounded-full buttons) while using the identical auth flow underneath.
Signature element: `components/graph/EntityStructureGraph.tsx` renders
the ownership graph as "ledger seal" nodes (double-ring circles) — the
one place the visual metaphor is spent, kept quiet everywhere else. The
`/print/*` pages and `/client/reports` deliberately switch to a light
"paper" surface instead, since those are meant to be printed/saved as PDF.

## Roles

- **Admin** — sees the whole firm's book (`/advisor/*`), manages adviser
  assignments (`/advisor/households` has an inline assign/unassign
  control), sees the audit trail and adviser-performance report.
- **Adviser** — sees only households they're assigned to
  (`adviser_household_assignment`), enforced both in the list endpoint
  and on direct-ID access (`HouseholdService.ensureAccessible`).
  Creating a household auto-assigns the creator. *Not yet extended to
  every household-scoped sub-resource* (scenarios, compliance-log,
  risk-exposure by household ID still rely on firm-level RLS only — see
  Known gaps).
- **Client** — sees only their own household, resolved from their JWT's
  `personId` (`GET /households/me`), enforced the same way on direct-ID
  access. Never sees other households, compliance findings, or the
  whole-book view.

## Running it

```bash
cp .env.example .env.local   # set BACKEND_API_URL
npm install
npm run dev
```

## Known gaps / next steps

- **Password reset** is a placeholder page on both login flows — no
  token-based reset endpoint exists on the backend yet.
- **RBAC hardening is partial**: adviser-household-assignment is enforced
  for `households/:id` and `net-worth`, but not yet for every other
  household-scoped endpoint (scenarios, compliance-log, risk-exposure) —
  those still only enforce the firm boundary via RLS.
- **Postgres `NUMERIC` columns return as strings** from the driver
  (`ownershipPct`, `income.amount`, `holding.marketValue` all hit this) —
  every known call site now coerces with `Number(...)`, but a new call
  site that forgets to will silently break (string concatenation instead
  of addition, or `NaN` from `.toFixed()`). The robust fix is a TypeORM
  value transformer on the backend's numeric columns; not done yet.
- **Multi-member households**: the client-intake form and CRM profile
  page both assume one primary contact per household — a couple or a
  household with dependents isn't modelled in the UI yet, even though
  `household_member` supports it.
- Reports are live-rendered, not stored — there's no history of a
  previously-generated report, only "generate now."
- No optimistic UI / toast system on mutations — currently a full
  `router.refresh()`.
- Entity/account/holding CRUD outside the client-profile page (e.g. a
  dedicated `/advisor/households/[id]/entities` screen) isn't built —
  entities/accounts are currently only created inline from the client
  profile page's "Add asset" flow.
- **No real fund data ships with this repo.** The `fund` table holds 15
  fictional "WealthMatrix Demo …" funds (unambiguously fake ISINs,
  `(Demo)` manager suffixes, "Not a real fund." descriptions) — enough to
  exercise every screen, but nowhere near the ~3,700 UK-regulated funds
  the module is architected for. Getting there needs a licensed data feed
  (real fund houses/ISINs are never something to fabricate) wired into
  `FundImportService`'s CSV pipeline and `FUND_DATA_SOURCE_URL`.
- **A `WHERE id IN (...)` query does not preserve input order** — Postgres
  is free to return matching rows in whatever order it finds them. This
  bit `FundAnalyticsService.compareFundSwitchImpact`, which destructured
  `FundService.findOneOrFailByIdList([fundAId, fundBId])` positionally as
  `[fundA, fundB]`; on some runs the DB handed rows back reversed, silently
  swapping which fund was "switching from" and which was "switching to"
  (and flipping every delta's sign). Fixed by making
  `findOneOrFailByIdList` re-sort its result to match the input id order
  explicitly — worth remembering before adding any other `IN (:...ids)`
  query whose caller relies on positional/array-index results rather than
  looking each one up by id.
- Model portfolios (`/advisor/research/model-portfolios`) is a stated
  placeholder — no data model or backend endpoints exist for it yet.
- **Email is unconfigured by default.** Without `SMTP_HOST` set, "Send to
  Provider" still generates the pack and logs the attempt, but every send
  logs `FAILED` with a clear reason — this is expected, not a bug, exactly
  like the AI features' Claude-billing gap above. Set `SMTP_HOST` (and
  `SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM`) in the backend's `.env`
  to actually send.
- **Provider contact emails are guessed placeholders**
  (`loa@providername.com` etc.) seeded by migration `004`, not verified
  real addresses — `email_verified` defaults to `false` per provider and
  the send flow blocks (with an explicit override) until someone confirms
  the real address on `/advisor/providers`. Treat every one as unverified
  until checked against the provider's actual published contact details.
- **LOA autofill only handles a "head" household member** — a joint
  application's second applicant isn't in any token yet (same
  simplification as Fund Suitability's risk-tolerance lookup).
- **Adviser contact fields** (`display_name`, `phone`, `address_line1`,
  `city`, `postal_code` on `app_user`) have no settings-page UI to edit
  them yet — they're used by the `{{adviser_*}}` LOA tokens and
  `adviser_details.pdf`, but currently need a direct DB update to set.
- **Files live in Postgres `bytea` columns**, not object storage —
  `loa_template.file_data` and `client_document.file_data` keep every
  KYC scan/bank statement/LOA template's bytes in the one Postgres
  instance the rest of the app depends on. Fine for demo-scale document
  sizes and counts; a production build handling real client-document
  volume should move these to S3/Azure Blob and store only a reference
  here.
- **Fact Find data doesn't reconcile with Income/Account/Holding.** The
  income sources, assets and pensions declared in a fact find are a
  separate, point-in-time client declaration from the platform's
  adviser-verified data used in net worth/reports — completing a fact
  find does not create or update any Income/Account/Holding rows. A
  reconciliation step (or at least a diff view) between "what the client
  told us" and "what we actually hold" is a natural next addition.
- **Fact Find only captures one primary contact fully** — partner
  details live as plain fields inside `personal_circumstances`
  (name/DOB/sex/occupation), not as a linked Person/HouseholdMember, so a
  joint household's second applicant isn't queryable as their own record
  (same simplification noted for LOA autofill and Fund Suitability).
- **`/print/report-case/[id]` needs `?householdId=` in the URL** — report
  cases are only ever listed/fetched under `households/:householdId/
  report-cases/:id`, and the print route has no way to resolve a bare
  case ID back to its household on its own. `ReportBuilderClient` always
  includes the query param when linking to this page, but a bookmarked
  or hand-typed URL without it will bounce to the households list rather
  than the report — a `report_case` lookup-by-id-only endpoint would be
  the cleaner fix if this becomes annoying in practice.
- **Report Template Builder's generated reports are single blobs of
  text**, not a tree of section rows — editing happens in one plain
  textarea, and the print page's heading detection is a deliberately thin
  line-by-line parser (`## Heading` only), not real markdown. Fine for
  what the AI is instructed to produce; would need a proper rich-text
  editor and a real markdown renderer if reports need inline formatting
  (bold, tables, bullet lists) beyond section headings and paragraphs.
- **Fund → Household Impact's `WHERE id IN (...)` ordering bug applies
  more broadly than that one call site** — any future `IN (:...ids)`
  query whose caller relies on the result coming back in the same order
  as the input array needs the same explicit re-sort `FundService.
  findOneOrFailByIdList` now does; Postgres never guarantees `IN` result
  order.
