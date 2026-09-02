-- =====================================================================
-- DFM + Fund Category Recommendation Engine
-- Run as postgres superuser (same reason as prior migrations). Idempotent.
--
-- Design notes:
--  - This does NOT name a real, specific regulated DFM firm — the
--    platform has no due-diligence/fee-panel relationship with any
--    actual discretionary fund manager to responsibly recommend one by
--    name. What it outputs is a MANDATE TYPE (e.g. "Balanced Growth
--    Mandate") plus a fund-CATEGORY allocation (Global Equity, Multi-
--    Asset, etc.) — matching the spec's own "no fund licensing
--    required" scope for the fund-category half, and applying the same
--    honesty boundary to the DFM half.
--  - Deterministic, not AI-generated: mandate + fund category weights
--    come from a fixed rules table keyed on risk category (the same ATR
--    scale as Fact Find), adjusted for stated liquidity need and
--    investment style preference. Claude is used ONLY to turn the
--    already-computed numbers into a polished suitability paragraph
--    (ai_narrative) — same "compute deterministically, narrate with AI,
--    degrade gracefully" pattern as ChargeProjectionService.
--  - One row per RUN (append-only, like charge_projection/consumer_duty_
--    review) — the household's data changes over time, and a stale
--    recommendation is exactly the kind of thing a regulator would want
--    dated and kept, not silently overwritten.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS dfm_recommendation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firm(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES household(id) ON DELETE CASCADE,

  inputs JSONB NOT NULL DEFAULT '{}',           -- DfmInputs snapshot (risk category, objectives, horizon, liquidity, style)
  mandate TEXT NOT NULL,                        -- e.g. "Balanced Growth Mandate", or "Not enough data"
  risk_alignment TEXT,
  reasoning JSONB NOT NULL DEFAULT '[]',        -- string[]
  indicative_fee_range TEXT,
  fund_categories JSONB NOT NULL DEFAULT '[]',  -- [{category, weightPct}]
  gaps JSONB NOT NULL DEFAULT '[]',             -- string[] — what data was missing

  ai_narrative TEXT,
  ai_narrative_error TEXT,

  created_by UUID REFERENCES app_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dfm_recommendation_firm ON dfm_recommendation(firm_id);
CREATE INDEX IF NOT EXISTS idx_dfm_recommendation_household ON dfm_recommendation(household_id);
ALTER TABLE dfm_recommendation ENABLE ROW LEVEL SECURITY;
ALTER TABLE dfm_recommendation FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_dfm_recommendation ON dfm_recommendation;
CREATE POLICY tenant_isolation_dfm_recommendation ON dfm_recommendation
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid)
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid);
DROP TRIGGER IF EXISTS trg_audit_dfm_recommendation ON dfm_recommendation;
CREATE TRIGGER trg_audit_dfm_recommendation AFTER INSERT OR DELETE OR UPDATE ON dfm_recommendation FOR EACH ROW EXECUTE FUNCTION audit_row_change();

GRANT SELECT, INSERT, UPDATE, DELETE ON dfm_recommendation TO wealthmatrix_app;

COMMIT;
