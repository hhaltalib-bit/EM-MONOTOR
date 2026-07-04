-- ============================================================
-- Analytics pre-computed metric tables — EM Monitor
-- MANUAL STEP: Run in Supabase SQL Editor.
-- These tables are ADDITIVE ONLY — they do not alter, rename, or
-- touch any of the 20 existing *_ts tables, backup tables, or any
-- other existing table. Safe to run alongside the live system.
-- Idempotent: safe to re-run (IF NOT EXISTS / OR REPLACE throughout).
-- ============================================================

-- ── TABLE 1: analytics_ts_metrics ──────────────────────────
-- One row per tablespace per report_date, pre-computed at ingest time.
CREATE TABLE IF NOT EXISTS analytics_ts_metrics (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  db_key           text NOT NULL,
  db_name          text NOT NULL,
  ts_name          text NOT NULL,
  report_date      date NOT NULL,
  schema_type      text NOT NULL,
  pct              numeric,
  used_gb          numeric,
  size_gb          numeric,
  max_gb           numeric,
  aut              text,
  growth_1d_gb     numeric,
  growth_days      int,
  rate_7d_pct      numeric,
  rate_full_pct    numeric,
  days_until_full  int,
  severity         text,
  created_at       timestamptz DEFAULT now(),
  CONSTRAINT analytics_ts_metrics_unique UNIQUE (db_key, ts_name, report_date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_ts_metrics_key_ts_date
  ON analytics_ts_metrics (db_key, ts_name, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_ts_metrics_report_date
  ON analytics_ts_metrics (report_date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_ts_metrics_severity
  ON analytics_ts_metrics (severity);

ALTER TABLE analytics_ts_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS auth_read ON analytics_ts_metrics;
CREATE POLICY auth_read ON analytics_ts_metrics FOR SELECT TO authenticated USING (true);

-- ── TABLE 2: analytics_daily_snapshot ───────────────────────
-- One row per report_date, fleet-wide aggregate.
CREATE TABLE IF NOT EXISTS analytics_daily_snapshot (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date           date NOT NULL UNIQUE,
  fleet_total_gb        numeric,
  fleet_used_gb         numeric,
  critical_count        int,
  warning_count         int,
  healthy_count         int,
  avg_daily_growth_gb   numeric,
  monthly_growth_gb     numeric,
  db_count              int,
  ts_count              int,
  created_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_snapshot_report_date
  ON analytics_daily_snapshot (report_date DESC);

ALTER TABLE analytics_daily_snapshot ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS auth_read ON analytics_daily_snapshot;
CREATE POLICY auth_read ON analytics_daily_snapshot FOR SELECT TO authenticated USING (true);

-- ── TABLE 3: analytics_anomalies ────────────────────────────
-- Historical log of detected anomalies. Never deleted, only appended.
CREATE TABLE IF NOT EXISTS analytics_anomalies (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  db_key         text NOT NULL,
  db_name        text NOT NULL,
  ts_name        text NOT NULL,
  anomaly_type   text NOT NULL,
  description    text NOT NULL,
  detected_date  date NOT NULL,
  pct_at_detect  numeric,
  resolved       boolean DEFAULT false,
  created_at     timestamptz DEFAULT now(),
  CONSTRAINT analytics_anomalies_unique UNIQUE (db_key, ts_name, anomaly_type, detected_date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_anomalies_detected_date
  ON analytics_anomalies (detected_date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_anomalies_resolved
  ON analytics_anomalies (resolved);

ALTER TABLE analytics_anomalies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS auth_read ON analytics_anomalies;
CREATE POLICY auth_read ON analytics_anomalies FOR SELECT TO authenticated USING (true);
