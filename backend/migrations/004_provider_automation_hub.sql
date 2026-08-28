-- =====================================================================
-- Provider Automation Hub — schema
-- Run as postgres superuser (same reason as prior migrations: the app
-- role has no DDL rights by design). Idempotent — safe to re-run.
--
-- Design notes:
--  - firm_id + RLS + audit trigger on every new table, same pattern as
--    every other tenant table in this schema.
--  - File bytes live in bytea columns (loa_template.file_data,
--    client_document.file_data) rather than a filesystem/S3 path — this
--    keeps everything inside the one Postgres instance the rest of the
--    app already depends on, at the cost of not scaling to large files
--    or large volumes well. Fine for LOA/KYC/ID-sized documents in a
--    demo/single-instance deployment; a production build handling real
--    volume should move these to object storage (S3/Azure Blob) and
--    store only a reference here. See README Known gaps.
--  - provider.provider_email / servicing_email / new_business_email are
--    PLACEHOLDERS (loa@providername.com etc.) — real addresses, but
--    real fund/company NAMES here are simply "which company might this
--    LOA go to", not a fabricated financial record, so this doesn't
--    trip the same "never fabricate data under a real name" rule the
--    fund research module follows. The *emails* are guesses, though,
--    and this module sends real client PII (NI numbers, bank
--    statements) as attachments — so email_verified defaults to false
--    and the frontend requires an explicit override before a send to an
--    unverified address, rather than trusting a guessed inbox blindly.
--  - client_document covers both adviser-uploaded documents (KYC, ID
--    proof, address proof, bank statements — things nobody can
--    legitimately synthesize) and generated documents (fact find,
--    policy summary, adviser details — assembled from data already in
--    this database). `source` distinguishes the two.
-- =====================================================================

BEGIN;

ALTER TABLE person ADD COLUMN IF NOT EXISTS ni_number TEXT;
ALTER TABLE account ADD COLUMN IF NOT EXISTS policy_number TEXT;

-- Adviser contact details for the LOA autofill engine's {{adviser_*}}
-- tokens — nothing in the schema modelled an adviser's name/phone/address
-- before this (app_user only had email; Person is a household-member
-- concept, not an adviser one). Individual FCA numbers aren't modelled
-- either — {{adviser_FCA}} uses the firm's fca_reference, which is the
-- number that actually appears on most firms' LOA templates in practice.
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS address_line1 TEXT;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS postal_code TEXT;

CREATE TABLE IF NOT EXISTS provider (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firm(id) ON DELETE CASCADE,
  provider_name TEXT NOT NULL,
  provider_email TEXT NOT NULL,
  servicing_email TEXT,
  new_business_email TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  required_documents JSONB NOT NULL DEFAULT '["LOA","Client Fact Find","KYC","ID Proof","Address Proof","Bank Statements","Policy Numbers (if available)"]',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (firm_id, provider_name)
);
CREATE INDEX IF NOT EXISTS idx_provider_firm ON provider(firm_id);
ALTER TABLE provider ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_provider ON provider;
CREATE POLICY tenant_isolation_provider ON provider
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid)
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid);
DROP TRIGGER IF EXISTS trg_updated_at_provider ON provider;
CREATE TRIGGER trg_updated_at_provider BEFORE UPDATE ON provider FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_audit_provider ON provider;
CREATE TRIGGER trg_audit_provider AFTER INSERT OR DELETE OR UPDATE ON provider FOR EACH ROW EXECUTE FUNCTION audit_row_change();

CREATE TABLE IF NOT EXISTS loa_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firm(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_data BYTEA NOT NULL,
  -- For a fillable-PDF template: maps our token names (client_name, ...)
  -- to that PDF's actual AcroForm field names. Null/unused for a DOCX
  -- template, which uses {{token}} markers directly in the document text.
  field_map JSONB,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  uploaded_by UUID REFERENCES app_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loa_template_firm ON loa_template(firm_id);
ALTER TABLE loa_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE loa_template FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_loa_template ON loa_template;
CREATE POLICY tenant_isolation_loa_template ON loa_template
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid)
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid);
DROP TRIGGER IF EXISTS trg_updated_at_loa_template ON loa_template;
CREATE TRIGGER trg_updated_at_loa_template BEFORE UPDATE ON loa_template FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_audit_loa_template ON loa_template;
CREATE TRIGGER trg_audit_loa_template AFTER INSERT OR DELETE OR UPDATE ON loa_template FOR EACH ROW EXECUTE FUNCTION audit_row_change();

CREATE TABLE IF NOT EXISTS client_document (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firm(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL, -- ClientDocumentType — plain TEXT + app-level @IsIn(), same convention as fund.sector etc.
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_data BYTEA NOT NULL,
  source TEXT NOT NULL DEFAULT 'uploaded', -- 'uploaded' | 'generated'
  uploaded_by UUID REFERENCES app_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_document_firm ON client_document(firm_id);
CREATE INDEX IF NOT EXISTS idx_client_document_household ON client_document(household_id);
CREATE INDEX IF NOT EXISTS idx_client_document_type ON client_document(document_type);
ALTER TABLE client_document ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_document FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_client_document ON client_document;
CREATE POLICY tenant_isolation_client_document ON client_document
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid)
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid);
DROP TRIGGER IF EXISTS trg_audit_client_document ON client_document;
CREATE TRIGGER trg_audit_client_document AFTER INSERT OR DELETE OR UPDATE ON client_document FOR EACH ROW EXECUTE FUNCTION audit_row_change();

CREATE TABLE IF NOT EXISTS compliance_provider_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firm(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES provider(id),
  adviser_id UUID NOT NULL REFERENCES app_user(id),
  loa_template_id UUID REFERENCES loa_template(id),
  loa_version INTEGER,
  documents_sent JSONB NOT NULL DEFAULT '[]', -- [{documentType, fileName}]
  email_status TEXT NOT NULL DEFAULT 'PENDING', -- ProviderActionStatus
  email_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_compliance_provider_actions_firm ON compliance_provider_actions(firm_id);
CREATE INDEX IF NOT EXISTS idx_compliance_provider_actions_household ON compliance_provider_actions(household_id);
CREATE INDEX IF NOT EXISTS idx_compliance_provider_actions_provider ON compliance_provider_actions(provider_id);
ALTER TABLE compliance_provider_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_provider_actions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_compliance_provider_actions ON compliance_provider_actions;
CREATE POLICY tenant_isolation_compliance_provider_actions ON compliance_provider_actions
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid)
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid);
DROP TRIGGER IF EXISTS trg_updated_at_compliance_provider_actions ON compliance_provider_actions;
CREATE TRIGGER trg_updated_at_compliance_provider_actions BEFORE UPDATE ON compliance_provider_actions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_audit_compliance_provider_actions ON compliance_provider_actions;
CREATE TRIGGER trg_audit_compliance_provider_actions AFTER INSERT OR DELETE OR UPDATE ON compliance_provider_actions FOR EACH ROW EXECUTE FUNCTION audit_row_change();

GRANT SELECT, INSERT, UPDATE, DELETE ON provider, loa_template, client_document, compliance_provider_actions TO wealthmatrix_app;

-- Seed the UK provider directory — real, well-known product providers
-- (public fact: these firms do accept LOAs from advisers), but every
-- contact email is an explicit PLACEHOLDER pending verification
-- (email_verified = false), per the note above. One row per existing
-- firm; re-running is a no-op thanks to the UNIQUE(firm_id, provider_name)
-- constraint.
INSERT INTO provider (firm_id, provider_name, provider_email, servicing_email, new_business_email)
SELECT
  f.id,
  v.name,
  'loa@' || lower(regexp_replace(v.name, '[^a-zA-Z0-9]', '', 'g')) || '.com',
  'servicing@' || lower(regexp_replace(v.name, '[^a-zA-Z0-9]', '', 'g')) || '.com',
  'newbusiness@' || lower(regexp_replace(v.name, '[^a-zA-Z0-9]', '', 'g')) || '.com'
FROM firm f
CROSS JOIN (VALUES
  ('Quilter'), ('Aviva'), ('Royal London'), ('AJ Bell'), ('Transact'),
  ('Standard Life'), ('Prudential'), ('Canada Life'), ('Aegon'), ('LV'),
  ('HSBC Life'), ('Hargreaves Lansdown'), ('Fidelity International'), ('Vanguard'),
  ('Phoenix'), ('Scottish Widows'), ('Zurich'), ('Legal & General'), ('Old Mutual'),
  ('MetLife'), ('Allianz'), ('AXA'), ('BNP Paribas'), ('Schroders'), ('JP Morgan'),
  ('BlackRock'), ('HSBC Asset Management'), ('Baillie Gifford'), ('M&G'),
  ('Rathbones'), ('Charles Stanley'), ('Abrdn'), ('Nutmeg'), ('Wealthify')
) AS v(name)
ON CONFLICT (firm_id, provider_name) DO NOTHING;

COMMIT;
