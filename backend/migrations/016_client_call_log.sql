-- =====================================================================
-- Telephony — outbound calling via Twilio
-- Run as postgres superuser (same reason as prior migrations). Idempotent.
--
-- Design notes:
--  - The platform places a real PSTN call: Twilio rings the ADVISER's
--    own phone first, and once they answer, bridges them to the
--    client's number. The adviser's phone rings like a normal call —
--    no WebRTC/browser-audio plumbing, no softphone. This is the
--    standard "click-to-call" pattern and the one genuinely testable/
--    verifiable server-side pattern without needing browser microphone
--    access to double as the calling device.
--  - Client phone comes from person.phone (already existed); adviser
--    phone from app_user.phone (already existed, previously only used
--    for LOA autofill) — no new columns needed on either.
--  - One row per call attempt (append-only) — a genuine outbound-call
--    compliance record (who was called, when, how long, whether it
--    connected), not just a status flag overwritten in place.
--  - status/duration are updated asynchronously via Twilio's status
--    callback webhook (POST /telephony/status-callback, Twilio-signature
--    verified, not JWT-authenticated — Twilio itself is the caller).
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS client_call_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firm(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES household(id) ON DELETE CASCADE,
  adviser_id UUID NOT NULL REFERENCES app_user(id),
  client_person_id UUID NOT NULL REFERENCES person(id),

  to_number TEXT NOT NULL,      -- client's number actually dialled
  from_number TEXT NOT NULL,    -- the Twilio number used as caller ID
  adviser_number TEXT NOT NULL, -- the adviser's own phone, rung first

  twilio_call_sid TEXT,
  status TEXT NOT NULL DEFAULT 'initiated', -- initiated | ringing | in-progress | completed | failed | no-answer | busy | canceled
  duration_seconds INT,
  error_message TEXT,

  initiated_by UUID REFERENCES app_user(id),
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_client_call_log_firm ON client_call_log(firm_id);
CREATE INDEX IF NOT EXISTS idx_client_call_log_household ON client_call_log(household_id);
CREATE INDEX IF NOT EXISTS idx_client_call_log_sid ON client_call_log(twilio_call_sid);
ALTER TABLE client_call_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_call_log FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_client_call_log ON client_call_log;
CREATE POLICY tenant_isolation_client_call_log ON client_call_log
  USING (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid)
  WITH CHECK (firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid);
DROP TRIGGER IF EXISTS trg_audit_client_call_log ON client_call_log;
CREATE TRIGGER trg_audit_client_call_log AFTER INSERT OR DELETE OR UPDATE ON client_call_log FOR EACH ROW EXECUTE FUNCTION audit_row_change();

GRANT SELECT, INSERT, UPDATE, DELETE ON client_call_log TO wealthmatrix_app;

COMMIT;
