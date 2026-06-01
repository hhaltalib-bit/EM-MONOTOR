-- ============================================================
-- Audit log table for administrative and settings actions
-- MANUAL STEP: Run in the Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id    UUID,
  actor_email TEXT,
  action      TEXT        NOT NULL,
  target      TEXT,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created
  ON audit_log(created_at DESC);

-- Enable RLS: authenticated users can read audit log entries
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_audit" ON audit_log
  FOR SELECT TO authenticated USING (true);

-- Writes happen only via the service role key (bypasses RLS automatically).
