-- =====================================================================
-- Fact Find + Attitude-to-Risk module
-- Run as postgres superuser (same reason as prior migrations). Idempotent.
--
-- Design notes:
--  - One row per REVIEW, not per household — a fact find is a point-in-
--    time declaration ("what the client told us"), and circumstances
--    (income, assets, objectives, risk tolerance) genuinely change
--    between reviews. A household accumulates a history of fact_find
--    rows rather than one row being edited in place forever; the existing
--    audit_row_change trigger still captures in-progress edits to a
--    single draft.
--  - Almost everything below is JSONB, not a dozen new normalised tables.
--    This mirrors the existing "flexible categorical/collection data ->
--    JSONB" convention already used for fund_screen.filters and
--    compliance_provider_actions.documents_sent — a fact find's nested
--    repeatable sections (income sources, assets, pensions, liabilities,
--    insurance policies, dependents, risk-questionnaire answers) vary in
--    shape and count per household in a way that doesn't benefit from
--    being individually queryable rows.
--  - DELIBERATE non-integration with Account/Holding/Income: the income
--    sources, assets and pensions captured here are the CLIENT'S OWN
--    DECLARATION at fact-find time, which is a distinct concept from the
--    platform's adviser-verified, custodian-fed Account/Holding data used
--    everywhere else (client profile, net worth, reports). Real advice
--    practice keeps these separate until reconciled; this schema doesn't
--    attempt automatic reconciliation between the two. See README.
--  - risk_score / risk_category are WealthMatrix's own transparent
--    scoring of the 8-question attitude-to-risk questionnaire (see
--    RiskQuestionnaireService) — not a reproduction of any third-party
--    proprietary risk-profiling methodology.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS fact_find (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firm(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'completed'

  review_purposes JSONB NOT NULL DEFAULT '{}',        -- {selected: string[], otherDetails, reviewNotes}
  personal_circumstances JSONB NOT NULL DEFAULT '{}', -- health, vulnerability, PEP, will, POA, marital status, partner snapshot, smoker, dependents[]
  income_expenditure JSONB NOT NULL DEFAULT '{}',      -- {client: {...}, partner: {...}}
  assets JSONB NOT NULL DEFAULT '{}',                  -- {nonPension: [...], pensions: [...], notes}
  liabilities JSONB NOT NULL DEFAULT '{}',             -- {items: [...], notes}
  insurance JSONB NOT NULL DEFAULT '{}',                -- {hasLifeInsurance, whyNot, policies: [...], notes}
  investment_questions JSONB NOT NULL DEFAULT '{}',
  retirement_questions JSONB NOT NULL DEFAULT '{}',
  risk_capacity JSONB NOT NULL DEFAULT '{}',            -- {assessmentBasis, netWorthExclHome, monthlyDisposableIncome, withdrawalHorizon}
  risk_questionnaire JSONB NOT NULL DEFAULT '[]',       -- [{questionKey, selectedOption}]
  risk_score NUMERIC(5,2),                              -- 0-100, WealthMatrix ATR scale
  risk_category TEXT,                                   -- risk_averse | conservative | balanced | adventurous | aggressive
  declaration JSONB NOT NULL DEFAULT '{}',              -- {infoAccurate, termsAccepted, completionMethod, fullName}

  completed_on DATE,
  signed_on DATE,
  created_by UUID REFERENCES app_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fact_find_firm ON fact_find(firm_id);
CREATE INDEX IF NOT EXISTS idx_fact_find_household ON fact_find(household_id);
ALTER TABLE fact_find ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_find FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_fact_find ON fact_find;
CREATE POLICY tenant_isolation_fact_find ON fact_find
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid)
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid);
DROP TRIGGER IF EXISTS trg_updated_at_fact_find ON fact_find;
CREATE TRIGGER trg_updated_at_fact_find BEFORE UPDATE ON fact_find FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_audit_fact_find ON fact_find;
CREATE TRIGGER trg_audit_fact_find AFTER INSERT OR DELETE OR UPDATE ON fact_find FOR EACH ROW EXECUTE FUNCTION audit_row_change();

GRANT SELECT, INSERT, UPDATE, DELETE ON fact_find TO wealthmatrix_app;

COMMIT;
