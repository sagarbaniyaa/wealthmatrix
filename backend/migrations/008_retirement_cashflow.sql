-- =====================================================================
-- Retirement Cashflow Monte Carlo
-- Run as postgres superuser. Idempotent.
--
-- Design notes:
--  - Everything is modelled in REAL (inflation-adjusted, "today's money")
--    terms throughout — contributions and the desired retirement income
--    stay constant in real terms, and the assumed return is a real
--    (post-inflation) return. This is a deliberate simplification: it
--    avoids a separate inflation assumption that would otherwise just
--    cancel back out arithmetically, without pretending the model is
--    more sophisticated than it is.
--  - The simulated percentile series is stored, not recalculated per
--    view, same reasoning as charge_projection — Monte Carlo is
--    inherently random, so re-running it would show a client a
--    different-looking chart on every visit to the same saved scenario.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS retirement_cashflow_scenario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firm(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  name TEXT,
  inputs JSONB NOT NULL DEFAULT '{}',   -- {currentAge, retirementAge, planToAge, currentPotValue, monthlyContribution, desiredAnnualIncome, expectedReturnPct, returnVolatilityPct}
  results JSONB NOT NULL DEFAULT '{}',  -- {successProbabilityPct, series: [{age, p10, p50, p90}], simulationCount}
  ai_narrative TEXT,
  ai_narrative_error TEXT,
  created_by UUID REFERENCES app_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_retirement_cashflow_scenario_firm ON retirement_cashflow_scenario(firm_id);
CREATE INDEX IF NOT EXISTS idx_retirement_cashflow_scenario_household ON retirement_cashflow_scenario(household_id);
ALTER TABLE retirement_cashflow_scenario ENABLE ROW LEVEL SECURITY;
ALTER TABLE retirement_cashflow_scenario FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_retirement_cashflow_scenario ON retirement_cashflow_scenario;
CREATE POLICY tenant_isolation_retirement_cashflow_scenario ON retirement_cashflow_scenario
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid)
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid);
DROP TRIGGER IF EXISTS trg_updated_at_retirement_cashflow_scenario ON retirement_cashflow_scenario;
CREATE TRIGGER trg_updated_at_retirement_cashflow_scenario BEFORE UPDATE ON retirement_cashflow_scenario FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_audit_retirement_cashflow_scenario ON retirement_cashflow_scenario;
CREATE TRIGGER trg_audit_retirement_cashflow_scenario AFTER INSERT OR DELETE OR UPDATE ON retirement_cashflow_scenario FOR EACH ROW EXECUTE FUNCTION audit_row_change();

GRANT SELECT, INSERT, UPDATE, DELETE ON retirement_cashflow_scenario TO wealthmatrix_app;

COMMIT;
