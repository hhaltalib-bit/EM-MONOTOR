// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

// Explicit allowlist for non-tablespace system tables.
const ALLOWED_SYSTEM_TABLES = new Set<string>([
  'backup_status',
  'backup_registry',
  'backup_report_log',
  'db_registry',
  'report_log',
  'system_settings',
  'user_profiles',
  'audit_log',
  'analytics_ts_metrics',
  'analytics_daily_snapshot',
  'analytics_anomalies',
])

// All Oracle tablespace tables follow the naming convention *_ts.
// This pattern covers all 20+ databases in db_registry without requiring
// the full list to be hardcoded (which would need a DB query to enumerate).
const TABLESPACE_TABLE_PATTERN = /^[a-z][a-z0-9_]*_ts$/

function isAllowed(tableName: string): boolean {
  return (
    ALLOWED_SYSTEM_TABLES.has(tableName) ||
    TABLESPACE_TABLE_PATTERN.test(tableName)
  )
}

export function safeFrom(supabase: AnyClient, tableName: string) {
  if (!isAllowed(tableName)) {
    throw new Error(`Table not allowed: ${tableName}`)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase.from(tableName) as any
}
