-- =====================================================================
-- Fund Research Module — schema
-- Run as postgres superuser (same reason as migrations 001/002: the app
-- role has no DDL rights by design). Idempotent — safe to re-run.
--
-- Design notes:
--  - firm_id + RLS on every table, per spec — funds are NOT a shared
--    cross-tenant catalogue here (unlike currency/exchange_rate, which
--    have no firm_id at all). Each firm gets its own fund universe. If
--    you'd rather every firm share one catalogue, drop firm_id + RLS
--    from `fund` and reference it read-only from tenant-scoped tables —
--    straightforward follow-up, not done here since the spec asked for
--    firm_id on every fund table explicitly.
--  - No new Postgres enum types for sector/asset_class/period/category —
--    this schema already uses plain TEXT + app-level class-validator
--    @IsIn() for exactly this kind of open-ended categorical (see
--    ownership_class, source_of_funds, risk_tolerance). IA sectors alone
--    number ~50 and change over time; an enum would need a migration
--    every time the IA revises its sector list.
--  - "Versioning" is the existing generic audit_row_change() trigger +
--    audit_log (before/after JSONB per change) already used everywhere
--    else in this schema — not a bespoke parallel version-history table.
--  - currency is a currency_id FK into the existing `currency` table,
--    not a raw text/code column, for consistency with the rest of the
--    schema (account, asset, holding all do this).
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS fund (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firm(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  isin TEXT NOT NULL,
  sedol TEXT,
  sector TEXT NOT NULL,          -- IA sector, e.g. 'IA UK All Companies'
  asset_class TEXT NOT NULL,     -- 'equity' | 'fixed_income' | 'mixed_asset' | 'money_market' | 'property' | 'alternative'
  ocf NUMERIC(6,4),              -- ongoing charges figure, e.g. 0.0075 = 0.75%
  yield_pct NUMERIC(6,4),
  risk_rating SMALLINT CHECK (risk_rating BETWEEN 1 AND 7), -- SRRI-style 1-7 scale
  volatility_pct NUMERIC(6,4),
  max_drawdown_pct NUMERIC(6,4),
  manager TEXT,
  manager_tenure_years NUMERIC(5,2),
  esg_score NUMERIC(5,2),
  currency_id UUID REFERENCES currency(id),
  inception_date DATE,
  aum NUMERIC(20,2),
  description TEXT,
  data_source TEXT,              -- e.g. 'demo_seed', 'csv:filename.csv', 'manual'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (firm_id, isin)
);
CREATE INDEX IF NOT EXISTS idx_fund_firm ON fund(firm_id);
CREATE INDEX IF NOT EXISTS idx_fund_isin ON fund(isin);
CREATE INDEX IF NOT EXISTS idx_fund_sector ON fund(sector);
CREATE INDEX IF NOT EXISTS idx_fund_risk_rating ON fund(risk_rating);
ALTER TABLE fund ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_fund ON fund;
CREATE POLICY tenant_isolation_fund ON fund
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid)
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid);
DROP TRIGGER IF EXISTS trg_updated_at_fund ON fund;
CREATE TRIGGER trg_updated_at_fund BEFORE UPDATE ON fund FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_audit_fund ON fund;
CREATE TRIGGER trg_audit_fund AFTER INSERT OR DELETE OR UPDATE ON fund FOR EACH ROW EXECUTE FUNCTION audit_row_change();

CREATE TABLE IF NOT EXISTS fund_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firm(id) ON DELETE CASCADE,
  fund_id UUID NOT NULL REFERENCES fund(id) ON DELETE CASCADE,
  period TEXT NOT NULL,          -- 'YTD' | '1Y' | '3Y' | '5Y'
  return_pct NUMERIC(8,4) NOT NULL,
  as_of_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fund_id, period, as_of_date)
);
CREATE INDEX IF NOT EXISTS idx_fund_performance_fund ON fund_performance(fund_id);
ALTER TABLE fund_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_performance FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_fund_performance ON fund_performance;
CREATE POLICY tenant_isolation_fund_performance ON fund_performance
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid)
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid);
DROP TRIGGER IF EXISTS trg_audit_fund_performance ON fund_performance;
CREATE TRIGGER trg_audit_fund_performance AFTER INSERT OR DELETE OR UPDATE ON fund_performance FOR EACH ROW EXECUTE FUNCTION audit_row_change();

CREATE TABLE IF NOT EXISTS fund_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firm(id) ON DELETE CASCADE,
  fund_id UUID NOT NULL REFERENCES fund(id) ON DELETE CASCADE,
  holding_name TEXT NOT NULL,
  holding_weight_pct NUMERIC(6,3) NOT NULL,
  as_of_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fund_holdings_fund ON fund_holdings(fund_id, as_of_date DESC);
ALTER TABLE fund_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_holdings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_fund_holdings ON fund_holdings;
CREATE POLICY tenant_isolation_fund_holdings ON fund_holdings
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid)
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid);
DROP TRIGGER IF EXISTS trg_audit_fund_holdings ON fund_holdings;
CREATE TRIGGER trg_audit_fund_holdings AFTER INSERT OR DELETE OR UPDATE ON fund_holdings FOR EACH ROW EXECUTE FUNCTION audit_row_change();

CREATE TABLE IF NOT EXISTS fund_allocation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firm(id) ON DELETE CASCADE,
  fund_id UUID NOT NULL REFERENCES fund(id) ON DELETE CASCADE,
  category TEXT NOT NULL,        -- 'equity' | 'fixed_income' | 'cash' | 'alternatives'
  weight_pct NUMERIC(6,3) NOT NULL,
  as_of_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fund_id, category, as_of_date)
);
CREATE INDEX IF NOT EXISTS idx_fund_allocation_fund ON fund_allocation(fund_id, as_of_date DESC);
ALTER TABLE fund_allocation ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_allocation FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_fund_allocation ON fund_allocation;
CREATE POLICY tenant_isolation_fund_allocation ON fund_allocation
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid)
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid);
DROP TRIGGER IF EXISTS trg_audit_fund_allocation ON fund_allocation;
CREATE TRIGGER trg_audit_fund_allocation AFTER INSERT OR DELETE OR UPDATE ON fund_allocation FOR EACH ROW EXECUTE FUNCTION audit_row_change();

-- Saved screener presets (adviser-scoped) — needed for the "save screens"
-- requirement in the screener page; not in the original table list but
-- has nowhere else to live.
CREATE TABLE IF NOT EXISTS fund_screen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firm(id) ON DELETE CASCADE,
  created_by UUID REFERENCES app_user(id),
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fund_screen_firm ON fund_screen(firm_id);
ALTER TABLE fund_screen ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_screen FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_fund_screen ON fund_screen;
CREATE POLICY tenant_isolation_fund_screen ON fund_screen
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid)
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON fund, fund_performance, fund_holdings, fund_allocation, fund_screen TO wealthmatrix_app;

COMMIT;
