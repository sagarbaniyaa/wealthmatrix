-- =====================================================================
-- CGT & Portfolio Intelligence Engine
-- Run as postgres superuser (same reason as prior migrations). Idempotent.
--
-- Design notes:
--  - Personal accounts only (owned directly by a household member) —
--    entity-held (trust/company) assets have their own, more complex
--    CGT treatment (trust rates, business asset disposal relief, etc.)
--    genuinely out of scope here; same boundary WealthConsolidationService
--    already draws between "personal net worth" and "entity-attributed
--    net worth". Documented, not silently ignored — see the service's
--    own gap-reporting.
--  - Cost basis uses UK Section 104 pooling (a running weighted-average
--    cost per holding, walked chronologically through buy/sell
--    transactions) — the correct method for the ordinary case. The
--    same-day and 30-day "bed and breakfast" share-matching rules are
--    NOT implemented; a real edge case (a sale followed by a repurchase
--    within 30 days) would be mis-costed. Flagged in the service's own
--    output, not hidden.
--  - CGT rates and the annual exempt amount are UK constants that
--    change nearly every tax year (see cgt-rates.constants.ts) — this
--    schema doesn't try to encode them; only the computed OUTPUT
--    (which used which rate/allowance) is stored, so a past analysis
--    stays a faithful record even after the constants are next updated.
--  - Append-only (like every other point-in-time recommendation engine
--    here): a CGT position changes with the market and with realised
--    gains, so a stale analysis dated and kept is more honest than one
--    silently overwritten.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS cgt_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firm(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES household(id) ON DELETE CASCADE,

  as_of_date DATE NOT NULL,
  per_person JSONB NOT NULL DEFAULT '[]',      -- PerPersonCgtPosition[]
  recommendations JSONB NOT NULL DEFAULT '[]', -- CgtRecommendation[]
  gaps JSONB NOT NULL DEFAULT '[]',            -- string[] — accounts skipped, missing wrapper, etc.

  created_by UUID REFERENCES app_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cgt_analysis_firm ON cgt_analysis(firm_id);
CREATE INDEX IF NOT EXISTS idx_cgt_analysis_household ON cgt_analysis(household_id);
ALTER TABLE cgt_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE cgt_analysis FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_cgt_analysis ON cgt_analysis;
CREATE POLICY tenant_isolation_cgt_analysis ON cgt_analysis
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid)
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid);
DROP TRIGGER IF EXISTS trg_audit_cgt_analysis ON cgt_analysis;
CREATE TRIGGER trg_audit_cgt_analysis AFTER INSERT OR DELETE OR UPDATE ON cgt_analysis FOR EACH ROW EXECUTE FUNCTION audit_row_change();

GRANT SELECT, INSERT, UPDATE, DELETE ON cgt_analysis TO wealthmatrix_app;

COMMIT;
