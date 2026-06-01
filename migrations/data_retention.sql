-- ============================================================
-- OPTIONAL: Data retention — DELETES old rows
-- READ CAREFULLY before uncommenting and running.
--
-- Default retention: 2 years (730 days). Change the interval
-- before running if you want a different period.
--
-- BACK UP your data before running.
-- Run manually in Supabase SQL Editor when you decide to
-- implement a retention policy. This script is commented out
-- so nothing runs by accident.
--
-- Tip: run a SELECT COUNT(*) ... WHERE report_date < ...
-- version of each statement first to see how many rows
-- would be deleted.
-- ============================================================

-- ── Tablespace tables ──────────────────────────────────────
-- Repeat one block per *_ts table in your db_registry.
-- Run: SELECT table_name FROM db_registry WHERE is_active = true;
-- to get the full list, then uncomment and adapt each block.

-- -- raid_ts
-- DELETE FROM raid_ts
--   WHERE report_date < CURRENT_DATE - INTERVAL '730 days';

-- -- dwh_ts
-- DELETE FROM dwh_ts
--   WHERE report_date < CURRENT_DATE - INTERVAL '730 days';

-- -- isldb_ts
-- DELETE FROM isldb_ts
--   WHERE report_date < CURRENT_DATE - INTERVAL '730 days';

-- -- prod1_ts
-- DELETE FROM prod1_ts
--   WHERE report_date < CURRENT_DATE - INTERVAL '730 days';

-- -- inhouse_ts
-- DELETE FROM inhouse_ts
--   WHERE report_date < CURRENT_DATE - INTERVAL '730 days';

-- -- <table_name>  ← add one block per additional *_ts table
-- DELETE FROM <table_name>
--   WHERE report_date < CURRENT_DATE - INTERVAL '730 days';

-- ── Backup tables ──────────────────────────────────────────

-- -- backup_status
-- DELETE FROM backup_status
--   WHERE report_date < CURRENT_DATE - INTERVAL '730 days';

-- -- backup_report_log
-- DELETE FROM backup_report_log
--   WHERE report_date < CURRENT_DATE - INTERVAL '730 days';

-- ── Ingest log ─────────────────────────────────────────────

-- -- report_log (tablespace ingest audit trail)
-- DELETE FROM report_log
--   WHERE report_date < CURRENT_DATE - INTERVAL '730 days';

-- -- audit_log (admin action trail — consider longer retention)
-- DELETE FROM audit_log
--   WHERE created_at < NOW() - INTERVAL '730 days';
