-- ============================================================
-- Add warn/crit threshold columns to system_settings
-- MANUAL STEP: Run in the Supabase SQL Editor
--
-- system_settings uses a single-row (id=1) schema with named
-- columns — NOT a key/value table. New columns are added via
-- ALTER TABLE, not INSERT.
-- ============================================================

ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS warn_threshold int DEFAULT 80;

ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS crit_threshold int DEFAULT 90;
