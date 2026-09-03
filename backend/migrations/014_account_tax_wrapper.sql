-- =====================================================================
-- Account tax wrapper — required for CGT & Portfolio Intelligence
-- Run as postgres superuser (same reason as prior migrations). Idempotent.
--
-- Design notes:
--  - The schema had no way to tell an ISA from a GIA from a bond — both
--    show up as account_type='investment'. That distinction is not
--    optional for a CGT engine: applying CGT to an ISA holding, or
--    missing it on a GIA holding, is a real, embarrassing correctness
--    bug, not a rounding error. This column is that missing fact.
--  - Nullable, no default of 'GIA': an unset wrapper is EXCLUDED from
--    CGT analysis with an explicit "wrapper not set" flag, never
--    silently assumed — guessing wrong in either direction (assuming
--    GIA when it's actually an ISA, or vice versa) is worse than
--    surfacing the gap and asking the adviser to tag the account.
-- =====================================================================

BEGIN;

ALTER TABLE account ADD COLUMN IF NOT EXISTS tax_wrapper TEXT; -- ISA | GIA | SIPP | ONSHORE_BOND | OFFSHORE_BOND | OTHER

COMMIT;
