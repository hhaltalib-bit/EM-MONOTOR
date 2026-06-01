-- ============================================================
-- Enable Row-Level Security on all data tables
-- MANUAL STEP: Run in the Supabase SQL Editor
--
-- Policy: authenticated users may SELECT from all tables.
-- Writes (INSERT / UPDATE / UPSERT / DELETE) are performed
-- only via the service role key, which bypasses RLS
-- automatically — no write policy is needed here.
--
-- After running this migration, the dashboard will continue
-- to work because all users are authenticated. The service
-- role (used by server-side API routes and crons) bypasses
-- RLS entirely and is unaffected.
-- ============================================================

-- ── Tablespace tables ──────────────────────────────────────
-- Add one block per *_ts table present in your db_registry.
-- The list below covers all tables referenced in the codebase;
-- add more if your db_registry has additional entries.

ALTER TABLE raid_ts    ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_raid_ts"    ON raid_ts    FOR SELECT TO authenticated USING (true);

ALTER TABLE dwh_ts     ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_dwh_ts"     ON dwh_ts     FOR SELECT TO authenticated USING (true);

ALTER TABLE isldb_ts   ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_isldb_ts"   ON isldb_ts   FOR SELECT TO authenticated USING (true);

ALTER TABLE prod1_ts   ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_prod1_ts"   ON prod1_ts   FOR SELECT TO authenticated USING (true);

ALTER TABLE inhouse_ts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_inhouse_ts" ON inhouse_ts FOR SELECT TO authenticated USING (true);

-- IMPORTANT: Repeat the two lines above for every additional
-- *_ts table in your db_registry that is NOT listed here.
-- Pattern:
--   ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY "auth_read_<table_name>" ON <table_name>
--     FOR SELECT TO authenticated USING (true);

-- ── Monitoring / system tables ─────────────────────────────

ALTER TABLE backup_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_backup_status" ON backup_status
  FOR SELECT TO authenticated USING (true);

ALTER TABLE backup_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_backup_registry" ON backup_registry
  FOR SELECT TO authenticated USING (true);

ALTER TABLE backup_report_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_backup_report_log" ON backup_report_log
  FOR SELECT TO authenticated USING (true);

ALTER TABLE report_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_report_log" ON report_log
  FOR SELECT TO authenticated USING (true);

ALTER TABLE db_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_db_registry" ON db_registry
  FOR SELECT TO authenticated USING (true);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_system_settings" ON system_settings
  FOR SELECT TO authenticated USING (true);

-- Note: user_profiles already has RLS + authenticated SELECT policy
-- from migrations/create_user_profiles.sql — no change needed.

-- Note: audit_log RLS is handled in migrations/add_audit_log.sql.
