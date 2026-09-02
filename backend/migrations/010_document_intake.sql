-- =====================================================================
-- Document Intake — OCR/NLP extraction pipeline for uploaded documents
-- Run as postgres superuser (same reason as prior migrations). Idempotent.
--
-- Design notes:
--  - No new table. client_document (migration 004) already stores every
--    uploaded file with its bytes, type, and household link — this just
--    adds the columns needed to record what automated extraction found
--    and what it did with it, right on that same row.
--  - extraction_status is deliberately separate from the existing
--    `source` column ('uploaded'|'generated') — a document can be
--    'uploaded' and still have extraction 'failed' (e.g. a scanned PDF
--    with no text layer) or 'unsupported' (a file type OCR/parsing can't
--    read). The upload itself must never fail because extraction did.
--  - applied_summary is a plain-English audit trail ("Filled: date of
--    birth, NI number. Created draft Fact Find.") — shown to the adviser
--    and readable in the compliance log, not just a machine-readable
--    parsed_data blob nobody will ever open.
-- =====================================================================

BEGIN;

ALTER TABLE client_document ADD COLUMN IF NOT EXISTS extracted_text TEXT;
ALTER TABLE client_document ADD COLUMN IF NOT EXISTS parsed_data JSONB NOT NULL DEFAULT '{}';
ALTER TABLE client_document ADD COLUMN IF NOT EXISTS extraction_status TEXT NOT NULL DEFAULT 'pending'; -- pending | processing | done | failed | unsupported
ALTER TABLE client_document ADD COLUMN IF NOT EXISTS extraction_error TEXT;
ALTER TABLE client_document ADD COLUMN IF NOT EXISTS applied_summary TEXT;
ALTER TABLE client_document ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;

COMMIT;
