-- =====================================================================
-- Client 360 profile extensions (Intelliflo-style adviser CRM fields)
-- Run as a superuser (postgres) — the app role (wealthmatrix_app) has no
-- schema-level CREATE or table-ownership rights by design (see backend
-- .env: "this DB role must NOT have BYPASSRLS"), so DDL must come from
-- an admin connection. Safe to re-run (every statement is idempotent).
-- =====================================================================

BEGIN;

-- Person: contact info + KYC/risk profile
ALTER TABLE person ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE person ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE person ADD COLUMN IF NOT EXISTS address_line1 TEXT;
ALTER TABLE person ADD COLUMN IF NOT EXISTS address_line2 TEXT;
ALTER TABLE person ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE person ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE person ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE person ADD COLUMN IF NOT EXISTS risk_tolerance TEXT; -- 'conservative' | 'moderate' | 'aggressive'
ALTER TABLE person ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'pending'; -- 'pending' | 'verified' | 'expired'
ALTER TABLE person ADD COLUMN IF NOT EXISTS kyc_verified_at DATE;
ALTER TABLE person ADD COLUMN IF NOT EXISTS source_of_wealth TEXT;

-- Asset: tag where the money came from (covers "inheritance" vs
-- "invested via the platform" vs other provenance)
ALTER TABLE asset ADD COLUMN IF NOT EXISTS source_of_funds TEXT; -- 'inheritance' | 'platform_investment' | 'employment_income' | 'business_sale' | 'other'

-- Income (not previously modelled at all — assets/liabilities existed via
-- asset+holding, income had no home)
CREATE TABLE IF NOT EXISTS income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firm(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  income_type TEXT NOT NULL, -- 'employment' | 'self_employment' | 'rental' | 'dividend' | 'pension' | 'other'
  description TEXT,
  amount NUMERIC(20,2) NOT NULL,
  currency_id UUID NOT NULL REFERENCES currency(id),
  frequency TEXT NOT NULL DEFAULT 'annual', -- 'annual' | 'monthly' | 'quarterly' | 'one_off'
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_income_person ON income(person_id);
CREATE INDEX IF NOT EXISTS idx_income_firm ON income(firm_id);
ALTER TABLE income ENABLE ROW LEVEL SECURITY;
ALTER TABLE income FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_income ON income;
CREATE POLICY tenant_isolation_income ON income
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid)
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid);
DROP TRIGGER IF EXISTS trg_updated_at_income ON income;
CREATE TRIGGER trg_updated_at_income BEFORE UPDATE ON income FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_audit_income ON income;
CREATE TRIGGER trg_audit_income AFTER INSERT OR DELETE OR UPDATE ON income FOR EACH ROW EXECUTE FUNCTION audit_row_change();

-- Adviser notes / activity log, one per household
CREATE TABLE IF NOT EXISTS client_note (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firm(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  author_id UUID REFERENCES app_user(id),
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_note_household ON client_note(household_id, created_at DESC);
ALTER TABLE client_note ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_note FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_client_note ON client_note;
CREATE POLICY tenant_isolation_client_note ON client_note
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid)
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid);
DROP TRIGGER IF EXISTS trg_audit_client_note ON client_note;
CREATE TRIGGER trg_audit_client_note AFTER INSERT OR DELETE OR UPDATE ON client_note FOR EACH ROW EXECUTE FUNCTION audit_row_change();

-- Grants for the app role — this DB has no default-privilege rule, so new
-- tables need this explicitly (mirrors the ALL-privilege grants already
-- present on every other table).
GRANT SELECT, INSERT, UPDATE, DELETE ON income TO wealthmatrix_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON client_note TO wealthmatrix_app;

COMMIT;
