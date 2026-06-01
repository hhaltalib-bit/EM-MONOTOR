-- ============================================================
-- Performance indexes for EM Monitor
-- MANUAL STEP: Run this in the Supabase SQL Editor
-- Do NOT run automatically — execute once per environment
-- ============================================================

-- raid_ts
CREATE INDEX IF NOT EXISTS idx_raid_ts_report_date
  ON raid_ts(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_raid_ts_name_date
  ON raid_ts(tablespace_name, report_date DESC);

-- dwh_ts
CREATE INDEX IF NOT EXISTS idx_dwh_ts_report_date
  ON dwh_ts(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_dwh_ts_name_date
  ON dwh_ts(tablespace_name, report_date DESC);

-- isldb_ts
CREATE INDEX IF NOT EXISTS idx_isldb_ts_report_date
  ON isldb_ts(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_isldb_ts_name_date
  ON isldb_ts(tablespace_name, report_date DESC);

-- prod1_ts
CREATE INDEX IF NOT EXISTS idx_prod1_ts_report_date
  ON prod1_ts(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_prod1_ts_name_date
  ON prod1_ts(tablespace_name, report_date DESC);

-- inhouse_ts
CREATE INDEX IF NOT EXISTS idx_inhouse_ts_report_date
  ON inhouse_ts(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_inhouse_ts_name_date
  ON inhouse_ts(tablespace_name, report_date DESC);

-- Add one CREATE INDEX pair per additional *_ts table in db_registry.
-- Pattern: idx_{table}_report_date and idx_{table}_name_date

-- backup_status
CREATE INDEX IF NOT EXISTS idx_backup_status_report_date
  ON backup_status(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_backup_status_db_key
  ON backup_status(report_date, db_key);

-- backup_report_log
CREATE INDEX IF NOT EXISTS idx_backup_report_log_date
  ON backup_report_log(report_date DESC);
