-- =====================================================================
-- Pension/Plan Transfer Charge Projections
-- Run as postgres superuser. Idempotent.
--
-- Design notes:
--  - Both the "old" and "new" arrangement are free-text/manual — a real
--    transfer very often involves a legacy insurance-company pension
--    (Aviva, Standard Life, etc.) that will never appear in our
--    researched fund database, so this deliberately does NOT try to
--    join against `fund` the way the Switch Impact tool does. It's a
--    charges-and-growth-assumption calculator, not a fund-vs-fund one.
--  - The computed year-by-year series is stored, not just the inputs —
--    if the projection formula is ever refined, a previously-generated
--    projection a client was shown stays exactly reproducible rather
--    than silently recalculating differently on next view.
--  - old_arrangement / new_arrangement / assumptions / results are JSONB
--    — same "flexible record, no bespoke normalised columns" convention
--    used throughout this schema for structured-but-variable data.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS charge_projection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firm(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  name TEXT,                                   -- adviser's label, e.g. "Aviva -> Fidelity transfer"
  old_arrangement JSONB NOT NULL DEFAULT '{}', -- {name, currentValue, ongoingChargePct, exitPenaltyPct}
  new_arrangement JSONB NOT NULL DEFAULT '{}', -- {name, ongoingChargePct, initialChargePct}
  assumptions JSONB NOT NULL DEFAULT '{}',     -- {projectionYears, grossGrowthRatePct}
  results JSONB NOT NULL DEFAULT '{}',         -- computed year-by-year series + summary, stored not recomputed
  ai_narrative TEXT,
  ai_narrative_error TEXT,
  created_by UUID REFERENCES app_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_charge_projection_firm ON charge_projection(firm_id);
CREATE INDEX IF NOT EXISTS idx_charge_projection_household ON charge_projection(household_id);
ALTER TABLE charge_projection ENABLE ROW LEVEL SECURITY;
ALTER TABLE charge_projection FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_charge_projection ON charge_projection;
CREATE POLICY tenant_isolation_charge_projection ON charge_projection
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid)
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid);
DROP TRIGGER IF EXISTS trg_updated_at_charge_projection ON charge_projection;
CREATE TRIGGER trg_updated_at_charge_projection BEFORE UPDATE ON charge_projection FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_audit_charge_projection ON charge_projection;
CREATE TRIGGER trg_audit_charge_projection AFTER INSERT OR DELETE OR UPDATE ON charge_projection FOR EACH ROW EXECUTE FUNCTION audit_row_change();

GRANT SELECT, INSERT, UPDATE, DELETE ON charge_projection TO wealthmatrix_app;

COMMIT;
