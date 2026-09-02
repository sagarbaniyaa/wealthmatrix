-- =====================================================================
-- Consumer Duty monitoring
-- Run as postgres superuser (same reason as prior migrations). Idempotent.
--
-- Design notes:
--  - FCA Consumer Duty (PRIN 2A) requires firms to actively MONITOR and
--    EVIDENCE outcomes for clients across four outcomes (price & value,
--    products & services, consumer understanding, consumer support) —
--    including specific attention to vulnerable clients. This is a
--    genuine ongoing regulatory obligation, not a one-off form.
--  - Vulnerability itself is NOT duplicated here — fact_find.personal_
--    circumstances already captures it per review (healthStatus,
--    affectsUnderstanding, needsAdditionalSupport, vulnerabilityNotes).
--    ConsumerDutyService reads that JSONB directly. This table exists
--    for the thing that genuinely doesn't have a home yet: a dated,
--    attributable ADVISER ATTESTATION against each of the four outcomes,
--    which is what actually counts as "evidence" for a regulator — not
--    an auto-computed score. We deliberately do NOT invent a formula
--    for "price & value" or "products & services" from data the
--    platform doesn't actually hold (real fee benchmarking, target-
--    market mapping) — see README for the same honesty pattern used by
--    SuitabilityReportService and HouseholdJourneyService.
--  - One row per REVIEW EVENT (append-only), mirroring fact_find: a
--    Consumer Duty review is a point-in-time attestation, and the
--    history of past attestations is itself part of the evidence trail.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS consumer_duty_review (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firm(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  reviewed_by UUID REFERENCES app_user(id),
  review_date DATE NOT NULL DEFAULT CURRENT_DATE,

  price_value_outcome TEXT NOT NULL DEFAULT 'not_assessed',      -- 'met' | 'concern' | 'not_assessed'
  price_value_notes TEXT,
  products_services_outcome TEXT NOT NULL DEFAULT 'not_assessed',
  products_services_notes TEXT,
  understanding_outcome TEXT NOT NULL DEFAULT 'not_assessed',
  understanding_notes TEXT,
  support_outcome TEXT NOT NULL DEFAULT 'not_assessed',
  support_notes TEXT,

  overall_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consumer_duty_review_firm ON consumer_duty_review(firm_id);
CREATE INDEX IF NOT EXISTS idx_consumer_duty_review_household ON consumer_duty_review(household_id);
ALTER TABLE consumer_duty_review ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumer_duty_review FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_consumer_duty_review ON consumer_duty_review;
CREATE POLICY tenant_isolation_consumer_duty_review ON consumer_duty_review
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid)
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid);
DROP TRIGGER IF EXISTS trg_audit_consumer_duty_review ON consumer_duty_review;
CREATE TRIGGER trg_audit_consumer_duty_review AFTER INSERT OR DELETE OR UPDATE ON consumer_duty_review FOR EACH ROW EXECUTE FUNCTION audit_row_change();

GRANT SELECT, INSERT, UPDATE, DELETE ON consumer_duty_review TO wealthmatrix_app;

COMMIT;
