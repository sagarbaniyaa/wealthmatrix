-- =====================================================================
-- Email Integration — read provider replies
-- Run as postgres superuser (same reason as prior migrations). Idempotent.
--
-- Design notes:
--  - Per-ADVISER, not per-firm: "adviser connects their email" (spec)
--    means each adviser's own mailbox, one row per adviser (unique on
--    adviser_id). A firm with several advisers can have several
--    connections; each poll only ever reads that one adviser's inbox.
--  - IMAP + an app-specific password, not full OAuth (Gmail API /
--    Microsoft Graph): OAuth would require the adviser (or firm) to
--    first register a developer app in Google Cloud Console or Azure —
--    a real account-creation step outside what this backend can do or
--    should silently assume. IMAP with an app password is something
--    Gmail, Outlook.com, and most providers support natively today, no
--    developer registration needed, and connects immediately.
--  - The password is stored ENCRYPTED at rest (AES-256-GCM, see
--    CredentialCipherService) using a server-side ENCRYPTION_KEY (env,
--    same pattern as JWT_SECRET) — never plaintext in the database,
--    unlike this platform's own demo DB password in .env.example. It is
--    still, ultimately, a secret sitting in this application's
--    database; a production deployment would want a proper secrets
--    manager instead. Documented, not hidden.
--  - No separate "email_message" log table: a received reply becomes a
--    normal client_document row (Document Intake handles the extraction
--    the exact same way as any other upload) plus the existing
--    compliance_provider_actions row flips to RECEIVED — nothing new to
--    duplicate.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS adviser_email_connection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firm(id) ON DELETE CASCADE,
  adviser_id UUID NOT NULL UNIQUE REFERENCES app_user(id) ON DELETE CASCADE,

  imap_host TEXT NOT NULL,
  imap_port INT NOT NULL DEFAULT 993,
  imap_secure BOOLEAN NOT NULL DEFAULT true,
  username TEXT NOT NULL,
  encrypted_password TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'pending', -- pending | connected | error
  last_error TEXT,
  last_polled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_adviser_email_connection_firm ON adviser_email_connection(firm_id);
ALTER TABLE adviser_email_connection ENABLE ROW LEVEL SECURITY;
ALTER TABLE adviser_email_connection FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_adviser_email_connection ON adviser_email_connection;
CREATE POLICY tenant_isolation_adviser_email_connection ON adviser_email_connection
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid)
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid);
DROP TRIGGER IF EXISTS trg_updated_at_adviser_email_connection ON adviser_email_connection;
CREATE TRIGGER trg_updated_at_adviser_email_connection BEFORE UPDATE ON adviser_email_connection FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- Deliberately NOT audited via audit_row_change() — that trigger's
-- before/after JSON diff would capture the encrypted_password column on
-- every insert/update. Connection status changes are still visible via
-- last_error/last_polled_at on the row itself and via compliance_log
-- entries written on every poll.

GRANT SELECT, INSERT, UPDATE, DELETE ON adviser_email_connection TO wealthmatrix_app;

COMMIT;
