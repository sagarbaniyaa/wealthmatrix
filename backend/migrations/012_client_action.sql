-- =====================================================================
-- Client Action Selector — "What are we doing for this client?"
-- Run as postgres superuser (same reason as prior migrations). Idempotent.
--
-- Design notes:
--  - One row per SELECTION (append-only, like fact_find/consumer_duty_
--    review/charge_projection/dfm_recommendation) — a household's active
--    workstream changes over time (a Protection Review this year, a
--    Pension Transfer next), and the history of what was being worked on
--    when is itself worth keeping, not overwritten.
--  - No new "requirements" table: what documents/compliance-checks/
--    suitability-section/provider a given action needs is a fixed rules
--    table in code (action-requirements.constants.ts), not adviser-
--    editable data — same reasoning as the ATR question bank and the
--    DFM mandate table. ClientActionService cross-references that rules
--    table against every OTHER module's real data (documents, Fact
--    Find, charge projections, Consumer Duty reviews, DFM
--    recommendations, provider sends, report templates/cases) to build
--    a live checklist — nothing here duplicates data that already has a
--    home elsewhere.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS household_action (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firm(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- see ACTION_TYPES in action-requirements.constants.ts
  notes TEXT,
  selected_by UUID REFERENCES app_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_household_action_firm ON household_action(firm_id);
CREATE INDEX IF NOT EXISTS idx_household_action_household ON household_action(household_id);
ALTER TABLE household_action ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_action FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_household_action ON household_action;
CREATE POLICY tenant_isolation_household_action ON household_action
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid)
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid);
DROP TRIGGER IF EXISTS trg_audit_household_action ON household_action;
CREATE TRIGGER trg_audit_household_action AFTER INSERT OR DELETE OR UPDATE ON household_action FOR EACH ROW EXECUTE FUNCTION audit_row_change();

GRANT SELECT, INSERT, UPDATE, DELETE ON household_action TO wealthmatrix_app;

COMMIT;
