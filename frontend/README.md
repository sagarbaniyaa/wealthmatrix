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
                                         (Client Journey tracker lives inline on the household page itself)
/advisor/households/[id]/look-through   True underlying exposure across every fund held
/client/look-through                    Same view, client-facing ("What you really own")
/advisor/households/[id]/retirement-cashflow  Monte Carlo retirement sustainability model
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

### Client Journey Pipeline

A 5-step progress tracker (`JourneyTracker.tsx`) embedded directly at the
top of every household's detail page — not a new data source, a rollup
of state that already lives across the modules built this session:

| Step | "Done" means |
|---|---|
| Fact Find | Latest fact find's `status` is `completed` |
| Risk Profile | The primary contact's `person.riskTolerance` is set |
| Suitability | A completed fact find exists |
| LOA / Provider Send | At least one `compliance_provider_actions` row with status `SENT`/`RECEIVED` |
| Report | At least one `report_case` with status `final` |

**One deliberate simplification, documented rather than hidden**: the
"Suitability" step can only report *ready to generate* (a completed fact
find exists), not *actually generated and reviewed* — the Suitability
Report page computes its output fresh on every view and never persists
it (see `SuitabilityReportService`), so there's no record to check
against. Verified live against real usage (not just test data) — an
adviser's own in-progress "Annual Review Report" draft correctly showed
up as "Report: Draft in progress" on this tracker.

### Meeting-to-Fact-Find AI

A collapsible panel at the top of the Fact Find form (`FactFindForm.tsx`)
— paste in raw meeting notes or a call transcript, click **"Parse &
pre-fill"**, and AI extracts what it can into the form's own state:
purposes, personal circumstances, income/expenditure, assets,
liabilities, insurance, investment/retirement questions.

- **`POST ai/fact-find-parse`** — stateless (no `householdId`, not tied
  to any stored record): given raw text, returns `{ parsed, gaps, error
  }`. `FactFindParserService` uses `ClaudeClientService.completeJSON`
  with an explicit target shape in the system prompt.
- **Deliberately excluded from extraction**: the Attitude-to-Risk
  questionnaire and the declaration/signature section. Both need the
  client's own direct answer or signature — inferring an ATR answer from
  a conversational summary would be fabricating suitability-relevant
  data, not "pre-filling a form field", so this simply doesn't attempt it.
- **`gaps`** is the other half of the honesty story: rather than only
  reporting what it found, the model is asked to name what a proper Fact
  Find would need that the notes never mentioned (e.g. "Date of birth not
  mentioned") — shown to the adviser as a follow-up checklist, not
  silently left blank.
- Parsing **merges** into whichever section state already exists in the
  form (only sections the AI actually returned anything for are
  touched) — it doesn't create a new fact find or wipe fields the
  adviser already typed in a section the notes didn't cover.

### Portfolio Look-Through

**`/advisor/households/[id]/look-through`** (and a client-facing
`/client/look-through`, "What you really own") — true underlying
exposure across every fund a household holds, not just a list of which
funds they own.

- **How the match works**: for each of a household's held assets
  (`account` → `holding` → `asset`, scoped to accounts owned directly by
  household members), `asset.identifier` is checked against `fund.isin`.
  Where it matches, the holding's value is distributed across that
  fund's own `fund_holdings` (top constituents) and `fund_allocation`
  (asset-class weights) — e.g. a client's £50,000 in a fund that's 5%
  Apple contributes £2,500 to their aggregate Apple exposure, combined
  with Apple exposure from every *other* fund they hold and any Apple
  shares they hold directly.
- **Nothing is silently dropped**: an asset that doesn't match any
  researched fund (a direct stock, cash, property, or a fund outside our
  universe) still counts in full under its own name and its own
  `asset.assetClass` — shown plainly as "Not matched" in the holdings
  table rather than being excluded from the totals.
- **`lookedThroughPct`** on the result tells you how much of the total
  portfolio actually got broken down this way vs. shown at face value —
  worth watching, since a low number means the picture is mostly
  face-value holdings, not a real look-through yet (expected for
  households whose assets predate the Fund Research Module, or that
  don't hold researched funds at all).
- **Known simplifications**: scoped to personally-owned accounts only
  (entity-attributed holdings via a trust/company aren't included, unlike
  `WealthConsolidationService`'s net-worth figure), and `fund_holdings`
  in this schema is only ever a fund's *top* constituents — the
  look-through covers what that data actually has, not 100% of every
  matched fund's book.
- Purely deterministic aggregation (`PortfolioLookThroughService`) — no
  AI involved, computed fresh on every request like
  `WealthConsolidationService.getHouseholdNetWorth`.

### Retirement Cashflow Monte Carlo

**`/advisor/households/[id]/retirement-cashflow`** — a genuine Monte
Carlo retirement sustainability model, not a single-line deterministic
projection: 2,000 simulated annual-return paths per run
(`RetirementCashflowService.simulate`), producing a **success
probability** (the % of simulations where the pot never hits zero
through the plan-to age) and a 10th/50th/90th percentile fan chart
(`RetirementFanChart.tsx`, raw SVG, no charting library).

- **Everything is modelled in real (inflation-adjusted) terms** —
  contributions and the desired retirement income stay constant in
  today's money throughout, and the return assumption is a real
  (post-inflation) return. Deliberate: a separate nominal-return +
  inflation-rate pair would only cancel back out arithmetically, so this
  skips it rather than pretending to more sophistication than that buys.
- **Return model**: each simulated year draws from
  Normal(expectedReturnPct, volatilityPct), floored at −95% in any single
  year. Chosen over a stricter lognormal model for the same reason as the
  ATR scoring and charge-projection methodology — transparent and
  documented over a claim of institutional-grade realism.
- **"Success" is path-dependent, not just the final balance**: a
  simulation counts as failed the moment the pot hits zero at any point
  during retirement, not only if the final year is negative — this
  avoids the common mistake of a model calling a path "successful" after
  it already ran out of money and recovered on paper.
- The computed series is **stored**, not recalculated per view — Monte
  Carlo is inherently random, so re-running it live would show a
  different-shaped chart on every visit to the same saved scenario.
- Verified directly against the API: a £500k pot + £500/month to 65,
  £30k/year real withdrawal to 95, 4%/12% return/volatility produced a
  71.7% success probability with sensible percentile spread (p10 hits £0
  by 95, p50 lands at ~£480k, p90 at ~£2.9m) in well under a second for
  all 2,000 simulations.

### Document Intake

**`/advisor/households/[id]/documents`** — upload a Fact Find, risk
profile, KYC/ID, proof of address, bank statement, provider statement,
or file note (PDF, DOCX, or a photo/scan as PNG/JPG); OCR + Claude
extraction runs automatically and the result shows immediately under
the file, no separate "process" step:

- **Fact Find upload** is the highest-automation path: it fills identity
  fields (name, DOB, address, email, phone, NI number) onto the client's
  record and creates a draft Fact Find from the document — reusing the
  same `FactFindParserService` that powers Meeting-to-Fact-Find AI, just
  pointed at a document's text instead of meeting notes. Anything the
  document didn't cover shows up as a "needs following up" gap, same
  discipline as that feature.
- **KYC / ID / address proof** fill identity fields only, and only ever
  fill an *empty* field — an OCR read never overwrites something already
  on file.
- **Risk profile / bank statement / provider statement / file note**
  are summarised into a client note instead of auto-written into
  structured fields, on purpose: a stated risk category or figure from
  an arbitrary uploaded document doesn't have the same provenance as
  WealthMatrix's own ATR questionnaire score or adviser-verified
  financials, so mixing it in silently would be worse than flagging it
  for the adviser to apply themselves.
- **A failed extraction never blocks the upload** — the file is always
  saved; only its status (`Processed`/`Failed`/`Unsupported file`)
  reflects what happened, with the underlying error shown so it's
  obvious why (e.g. Claude unavailable, or an unreadable file).
- **Known gap, by design, not silently**: a *scanned PDF* (a photo/scan
  saved as a PDF, with no real text layer) can't be read — rendering PDF
  pages to images for OCR needs a native PDF-rasteriser this platform
  deliberately doesn't take on as a dependency. The upload is rejected
  with a clear message asking for a PNG/JPG instead, which OCR reads
  directly.
- **Image OCR runs via `tesseract.js`** (WASM, no native binary, no paid
  API key) — the free/no-cost path this platform has used throughout.
  Trade-off: it downloads ~15MB of core+language data from a public CDN
  on first use per process, so the very first OCR request after a
  Render free-tier cold start is noticeably slower than a warm one.

### Email Sync

**`/advisor/settings/email`** — connect your own mailbox so the platform
detects a provider's reply automatically instead of you watching your
inbox and re-uploading attachments by hand.

- **IMAP with an app-specific password, not "Sign in with Google/
  Microsoft"**: real OAuth would require registering a developer app in
  Google Cloud Console or Azure first — a genuine account-setup step
  outside what this platform can or should do silently on your behalf.
  An app password (Gmail: Account → Security → 2-Step Verification →
  App passwords; Outlook/Microsoft 365: account security settings) works
  immediately, with presets for Gmail/Outlook/Yahoo host+port.
- **Reply matching uses a reference code**, not email threading: every
  LOA send now includes `Ref: XXXXXXXX` in its subject and body — Email
  Sync greps incoming unread mail for that same code to know exactly
  which household/provider action a reply belongs to, since not every
  provider's mail system preserves threading headers reliably.
- **Every attachment on a matched reply runs through Document Intake**
  — the identical pipeline a manual upload uses (OCR/NLP extraction,
  identity fields, summarised notes for anything not safe to auto-write)
  — and the provider action flips to RECEIVED automatically.
- Polled automatically every 10 minutes, or immediately via "Check for
  replies now" (useful right after you know a reply has landed, or
  while testing).
- Credentials are encrypted at rest, never shown again after saving.

### CGT & Portfolio Intelligence

**`/advisor/households/[id]/cgt-analysis`** — tag each investment
account's tax wrapper (ISA/GIA/SIPP/Onshore Bond/Offshore Bond/Other),
then run the analysis. Real arithmetic, not AI: UK Section 104 pooling
over each holding's buy/sell transaction history gives a genuine cost
basis, compared against current market value for the unrealised gain.

- **Per person, not per household** — the CGT annual exempt amount
  (£3,000) is a personal allowance, so results and recommendations are
  broken out by household member.
- **An unset tax wrapper excludes the account, on purpose** — assuming
  GIA when it's actually an ISA (or the reverse) is a real correctness
  bug for a platform giving tax guidance, not a rounding error. The
  gaps list says exactly which accounts need tagging.
- **Both CGT rates always shown, never one picked for you** — basic
  (18%) and higher (24%) are both computed; a "likely" band is
  estimated from recorded income only as a label, never used to hide
  the other number.
- **Recommendations are concrete, not generic advice text**: the
  specific holding cheapest to sell, which ones already carry zero CGT,
  the one with the largest gain worth leaving alone, and exactly how
  much of this year's unused allowance could be realised tax-free.
- **Known, documented gap**: the 30-day "bed and breakfast" share-
  matching rule (selling and repurchasing the same holding within 30
  days) isn't implemented — an edge case that would mis-cost a holding
  if it applies. Flagged in the module's own code comments, not hidden.

### DFM & Fund Category Recommendation

**`/advisor/households/[id]/dfm-recommendation`** — a deterministic
mandate + fund-category allocation computed from the household's latest
Fact Find (risk category, objectives, time horizon, liquidity need,
investment style). **No real DFM firm is named** — the platform has no
due-diligence/fee-panel relationship with any actual discretionary fund
manager to responsibly recommend one by name, so the output is a mandate
TYPE ("Balanced Growth Mandate") and a category allocation (Global
Equity, Multi-Asset, Corporate Bond, Index Funds, Diversified Growth,
Alternatives, Cash, Short-Duration Bonds — no fund licensing needed).
The mandate/weights are looked up from a fixed rules table by risk
band, then adjusted for stated liquidity need and passive/active
preference — entirely deterministic and re-derivable by hand. Claude is
used only to turn the already-computed numbers into one polished
suitability paragraph; if that fails, the numbers and reasoning still
show, with the AI failure flagged rather than hidden. Missing inputs
(no risk category, no stated horizon) show up as explicit "gaps" rather
than being silently defaulted.

### Client Action

**`/advisor/households/[id]/action`** — "What are we doing for this
client?" Pick from the 8 standard actions (Pension Transfer, Investment
Review, New Investment, DFM Recommendation, ISA/GIA Setup, Retirement
Planning, Consolidation, Protection Review) and the page turns into a
live checklist: required documents (cross-checked against Document
Intake), compliance checks (Fact Find completion, risk profile, Charge
Projections, Consumer Duty reviews), whether a matching suitability
template/report case exists, provider send status, whether a DFM
recommendation exists (where relevant), and LOA template availability —
each pulled live from the actual other feature, never a separately
maintained "done" flag. Selecting an action is itself kept as history
(a household's workstream changes over time), so past selections stay
visible even after the current one changes.

### Consumer Duty register

**`/advisor/compliance/consumer-duty`** (firm-wide) and
**`/advisor/households/[id]/consumer-duty`** (per household) — FCA
Consumer Duty (PRIN 2A) monitoring, built entirely from data the
platform already holds honestly rather than a fabricated compliance
score:

- **Vulnerability** is read straight off each household's latest Fact
  Find (`personal_circumstances`: health status, affects-understanding,
  needs-additional-support, vulnerability notes) — nothing new to fill
  in, this dashboard just surfaces what's already been declared,
  firm-wide, sorted vulnerable-first.
- **"Support documented"** specifically checks that
  `additionalSupportProvided` was actually filled in whenever
  `needsAdditionalSupport` is true — flags the gap between "we know this
  client is vulnerable" and "we can evidence we did something about it",
  which is the actual regulatory distinction that matters.
- **Review currency**: a household with no completed Fact Find in the
  last 365 days shows as overdue. Fixed cycle, not a regulatory citation
  — a firm with a different service proposition would want this
  configurable.
- **The four Consumer Duty outcomes** (price & value, products &
  services, consumer understanding, consumer support) are a dated
  adviser attestation, not an auto-score — deliberately. The platform
  doesn't hold real fee-benchmarking or target-market data, so scoring
  "price & value" automatically would misrepresent what's actually been
  evidenced; an adviser records "met"/"concern"/"not assessed" with
  notes per outcome instead, and every attestation is kept (append-only)
  as its own evidence trail rather than overwritten.
- Same access scoping as the household list itself: admin sees the
  firm's whole book, an adviser sees only their assigned households.

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
