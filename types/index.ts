// Standard database tablespace row
export interface StandardTablespace {
  id: string
  report_date: string
  tablespace_name: string
  aut: 'YES' | 'NO'
  max_ts_size: number | null
  max_ts_pct_used: number
  curr_ts_size: number | null
  used_ts_size: number
  ts_pct_used: number | null
  free_ts_size: number | null
  ts_pct_free: number | null
  created_at: string
}

// DWH tablespace row
export interface DwhTablespace {
  id: string
  report_date: string
  tablespace_name: string
  gb_total: number | null
  gb_used: number
  gb_free: number | null
  percent_used: number
  created_at: string
}

// Database summary for overview cards
export interface DatabaseSummary {
  key: string
  name: string
  table_name: string
  schema_type: 'standard' | 'dwh'
  worst_pct: number
  severity: Severity
  critical_count: number
  warning_count: number
  healthy_count: number
  total_tablespaces: number
}

// DB Registry entry from Supabase
export interface DbRegistry {
  db_key: string
  db_name: string
  table_name: string
  schema_type: 'standard' | 'dwh'
  host_ip: string | null
  is_active: boolean
}

// Severity levels
export type Severity = 'critical' | 'warning' | 'healthy'

// Toast types
export type ToastType = 'ok' | 'wa' | 'cr'

export interface ToastMessage {
  text: string
  type: ToastType
}

// Notification / Alert
export interface Notification {
  id: string
  ingested_at: string
  report_date: string | null
  report_time: string | null
  status: string
  databases_processed: number
  total_rows_inserted: number
  error_message: string | null
  notes: string | null
}

// Settings
export interface AlertSettings {
  warning_threshold: number
  critical_threshold: number
  alert_email: string
  expected_report_time: string
  missing_alert_delay: number
}

// Parsed HTML report structures
export interface ParsedStandardRow {
  tablespace_name: string
  aut: 'YES' | 'NO'
  max_ts_size: number | null
  max_ts_pct_used: number
  curr_ts_size: number | null
  used_ts_size: number
  ts_pct_used: number | null
  free_ts_size: number | null
  ts_pct_free: number | null
}

export interface ParsedDwhRow {
  tablespace_name: string
  gb_total: number | null
  gb_used: number
  gb_free: number | null
  percent_used: number
}

export interface ParsedDatabase {
  db_key: string
  schema_type: 'standard' | 'dwh'
  tablespaces: ParsedStandardRow[] | ParsedDwhRow[]
}

export interface ParseResult {
  valid: boolean
  reason?: string
  report_date?: string
  report_time?: string
  expected_date?: string
  databases?: ParsedDatabase[]
  noChange?: boolean
}

// Top growing tablespace
export interface TopGrowing {
  db_key: string
  db_name: string
  tablespace_name: string
  growth_gb: number
  current_pct: number
}
