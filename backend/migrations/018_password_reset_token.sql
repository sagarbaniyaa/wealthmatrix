-- =====================================================================
-- Self-service password reset. Run as postgres superuser (same reason
-- as prior migrations). Idempotent.
--
-- Design notes:
--  - Only the token's HASH is stored (sha256 of a high-entropy random
--    value) — the raw token exists only in the emailed link and the
--    requester's browser, never at rest. A fast hash (not bcrypt) is
--    fine here: this is a single-use, short-expiry, high-entropy
--    lookup value, not a low-entropy password.
--  - firm_id is denormalized onto this table (derivable via app_user,
--    but every other RLS-protected table in this schema stores it
--    directly rather than via a join) — this is also what lets the
--    RESET step resolve tenant context before it has looked anything
--    else up, the same "identifier embedded in the link" pattern
--    telephony's status-callback webhook already uses.
--  - used_at (not a delete) preserves an audit trail of reset activity
--    and makes replay of an already-used token detectable, not just
--    "not found".
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS password_reset_token (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firm(id) ON DELETE CASCADE,
  app_user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_token_hash ON password_reset_token (token_hash);

ALTER TABLE password_reset_token ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_token FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_password_reset_token ON password_reset_token;
CREATE POLICY tenant_isolation_password_reset_token ON password_reset_token
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid)
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid);
DROP TRIGGER IF EXISTS trg_audit_password_reset_token ON password_reset_token;
CREATE TRIGGER trg_audit_password_reset_token AFTER INSERT OR DELETE OR UPDATE ON password_reset_token FOR EACH ROW EXECUTE FUNCTION audit_row_change();

GRANT SELECT, INSERT, UPDATE, DELETE ON password_reset_token TO wealthmatrix_app;

COMMIT;
