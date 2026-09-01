-- =====================================================================
-- Report Template Builder
-- Run as postgres superuser. Idempotent.
--
-- Design notes:
--  - report_template holds a REAL example report the adviser has already
--    used (ISA setup, pension transfer, crystallisation, etc.) — its
--    extracted plain text is fed to Claude as a structure/format
--    reference, never verbatim-copied into a new report. Versioned the
--    same way as loa_template (re-upload same name -> bump version,
--    deactivate the old one).
--  - report_case is one generated report instance for one household —
--    the AI's first draft plus whatever the adviser edits afterwards,
--    kept in a single `content` field (plain text with "## Heading"
--    markers the print page renders), not a tree of section rows. A
--    report's shape comes entirely from its template, which varies by
--    report_type — there's no fixed WealthMatrix-defined section list to
--    normalise against.
--  - report_type is plain TEXT, not a Postgres enum — same "open-ended
--    categorical" convention as fund.sector — because the whole point of
--    this feature is that the adviser can add new report types (the user
--    explicitly said "and more") without a schema migration.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS report_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firm(id) ON DELETE CASCADE,
  name TEXT NOT NULL,           -- e.g. "Pension Transfer", "ISA Setup", "Crystallisation"
  report_type TEXT NOT NULL,    -- slug form, e.g. 'pension_transfer' — adviser-defined, open-ended
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_data BYTEA NOT NULL,
  extracted_text TEXT NOT NULL, -- plain text pulled from the docx/pdf at upload time — what actually goes in the AI prompt
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  uploaded_by UUID REFERENCES app_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_report_template_firm ON report_template(firm_id);
CREATE INDEX IF NOT EXISTS idx_report_template_type ON report_template(report_type);
ALTER TABLE report_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_template FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_report_template ON report_template;
CREATE POLICY tenant_isolation_report_template ON report_template
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid)
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid);
DROP TRIGGER IF EXISTS trg_updated_at_report_template ON report_template;
CREATE TRIGGER trg_updated_at_report_template BEFORE UPDATE ON report_template FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_audit_report_template ON report_template;
CREATE TRIGGER trg_audit_report_template AFTER INSERT OR DELETE OR UPDATE ON report_template FOR EACH ROW EXECUTE FUNCTION audit_row_change();

CREATE TABLE IF NOT EXISTS report_case (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firm(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  report_template_id UUID NOT NULL REFERENCES report_template(id),
  report_template_version INTEGER,
  report_type TEXT NOT NULL,
  case_details JSONB NOT NULL DEFAULT '{}', -- {summary: string, facts: [{label, value}]} — the adviser's description of this specific case
  content TEXT,                              -- the report body (AI draft, then adviser-edited)
  status TEXT NOT NULL DEFAULT 'draft',      -- 'draft' | 'final'
  generation_error TEXT,                     -- set if the AI draft failed — content stays null, adviser can retry or write manually
  created_by UUID REFERENCES app_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_report_case_firm ON report_case(firm_id);
CREATE INDEX IF NOT EXISTS idx_report_case_household ON report_case(household_id);
ALTER TABLE report_case ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_case FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_report_case ON report_case;
CREATE POLICY tenant_isolation_report_case ON report_case
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid)
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid);
DROP TRIGGER IF EXISTS trg_updated_at_report_case ON report_case;
CREATE TRIGGER trg_updated_at_report_case BEFORE UPDATE ON report_case FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_audit_report_case ON report_case;
CREATE TRIGGER trg_audit_report_case AFTER INSERT OR DELETE OR UPDATE ON report_case FOR EACH ROW EXECUTE FUNCTION audit_row_change();

GRANT SELECT, INSERT, UPDATE, DELETE ON report_template, report_case TO wealthmatrix_app;

COMMIT;
