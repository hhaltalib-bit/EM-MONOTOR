-- ============================================================
-- Performance indexes for EM Monitor — ALL tablespace tables
-- MANUAL STEP: Run in Supabase SQL Editor during a low-activity window.
-- Safe to re-run (IF NOT EXISTS makes it idempotent).
-- Each index uses CREATE INDEX (not CONCURRENTLY) — Supabase
-- managed Postgres handles this safely.
-- ============================================================

-- ── Tablespace tables ──────────────────────────────────────
-- Two indexes per table:
--   report_date DESC      → fast "latest report" queries
--   tablespace_name + report_date DESC → fast per-tablespace lookups

-- raid_ts (confirmed from codebase)
CREATE INDEX IF NOT EXISTS idx_raid_ts_report_date
  ON raid_ts(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_raid_ts_name_date
  ON raid_ts(tablespace_name, report_date DESC);

-- dwh_ts (confirmed from codebase)
CREATE INDEX IF NOT EXISTS idx_dwh_ts_report_date
  ON dwh_ts(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_dwh_ts_name_date
  ON dwh_ts(tablespace_name, report_date DESC);

-- isldb_ts (confirmed from codebase)
CREATE INDEX IF NOT EXISTS idx_isldb_ts_report_date
  ON isldb_ts(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_isldb_ts_name_date
  ON isldb_ts(tablespace_name, report_date DESC);

-- prod1_ts (confirmed from codebase)
CREATE INDEX IF NOT EXISTS idx_prod1_ts_report_date
  ON prod1_ts(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_prod1_ts_name_date
  ON prod1_ts(tablespace_name, report_date DESC);

-- inhouse_ts (confirmed from codebase)
CREATE INDEX IF NOT EXISTS idx_inhouse_ts_report_date
  ON inhouse_ts(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_inhouse_ts_name_date
  ON inhouse_ts(tablespace_name, report_date DESC);

-- ── Additional *_ts tables from your db_registry ───────────
-- The remaining tablespace tables are stored in db_registry.table_name.
-- Run this query first to get the full list:
--   SELECT table_name FROM db_registry WHERE is_active = true ORDER BY table_name;
-- Then add a block below for each table_name NOT already listed above.
-- Pattern (replace <table_name> with the actual name):

-- <table_name>
-- CREATE INDEX IF NOT EXISTS idx_<table_name>_report_date
--   ON <table_name>(report_date DESC);
-- CREATE INDEX IF NOT EXISTS idx_<table_name>_name_date
--   ON <table_name>(tablespace_name, report_date DESC);

-- ── Backup and monitoring tables ───────────────────────────

-- backup_status
CREATE INDEX IF NOT EXISTS idx_backup_status_report_date
  ON backup_status(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_backup_status_db_key
  ON backup_status(report_date, db_key);

-- backup_report_log
CREATE INDEX IF NOT EXISTS idx_backup_report_log_date
  ON backup_report_log(report_date DESC);

-- report_log
CREATE INDEX IF NOT EXISTS idx_report_log_report_date
  ON report_log(report_date DESC);

-- db_registry (supports fast db_key lookups)
CREATE UNIQUE INDEX IF NOT EXISTS idx_db_registry_db_key
  ON db_registry(db_key);
