import { createServiceClient } from '@/lib/supabase/server'
import { parseHtmlReport } from '@/lib/parser/html-parser'
import { ParsedStandardRow, ParsedDwhRow } from '@/types'
import { sendRapidGrowthAlert } from '@/lib/email/alerts'
import { safeFrom } from '@/lib/db/safeTable'

export interface IngestResult {
  success: boolean
  report_date?: string
  report_time?: string
  databases_processed: number
  total_rows_inserted: number
  critical_count: number
  warning_count: number
  reason?: string
  errors?: string[]
}

export async function processIngest(
  htmlContent: string,
  isTest: boolean,
): Promise<IngestResult> {
  const parsed = parseHtmlReport(htmlContent, isTest)

  if (!parsed.valid) {
    await logIngest({ status: 'skipped', error_message: `Validation failed: ${parsed.reason}` })
    return { success: false, reason: parsed.reason, databases_processed: 0, total_rows_inserted: 0, critical_count: 0, warning_count: 0 }
  }

  const supabase = createServiceClient()

  const { data: registries } = await supabase
    .from('db_registry')
    .select('db_key, db_name, table_name, schema_type')

  const regMap = new Map(
    (registries || []).map((r: { db_key: string; db_name: string; table_name: string; schema_type: string }) => [
      r.db_key.toLowerCase(), r,
    ])
  )

  let totalInserted = 0
  let dbsProcessed = 0
  const errors: string[] = []

  for (const db of parsed.databases!) {
    const reg = regMap.get(db.db_key.toLowerCase())
    if (!reg) { errors.push(`Unknown db_key: ${db.db_key}`); continue }

    try {
      const tb = safeFrom(supabase, reg.table_name)

      if (db.schema_type === 'standard') {
        const rows = (db.tablespaces as ParsedStandardRow[]).map(ts => ({
          report_date: parsed.report_date,
          tablespace_name: ts.tablespace_name,
          aut: ts.aut,
          max_ts_size: ts.max_ts_size,
          max_ts_pct_used: ts.max_ts_pct_used,
          curr_ts_size: ts.curr_ts_size,
          used_ts_size: ts.used_ts_size,
          ts_pct_used: ts.ts_pct_used,
          free_ts_size: ts.free_ts_size,
          ts_pct_free: ts.ts_pct_free,
        }))
        const { error } = await tb.upsert(rows, { onConflict: 'report_date,tablespace_name', ignoreDuplicates: true })
        if (error) throw new Error(error.message)
        totalInserted += rows.length
      } else {
        const rows = (db.tablespaces as ParsedDwhRow[]).map(ts => ({
          report_date: parsed.report_date,
          tablespace_name: ts.tablespace_name,
          gb_total: ts.gb_total,
          gb_used: ts.gb_used,
          gb_free: ts.gb_free,
          percent_used: ts.percent_used,
        }))
        const { error } = await tb.upsert(rows, { onConflict: 'report_date,tablespace_name', ignoreDuplicates: true })
        if (error) throw new Error(error.message)
        totalInserted += rows.length
      }
      dbsProcessed++
    } catch (err) {
      errors.push(`${db.db_key}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  await logIngest({
    report_date: parsed.report_date,
    report_time: parsed.report_time,
    status: errors.length > 0 && dbsProcessed === 0 ? 'error' : 'success',
    databases_processed: dbsProcessed,
    total_rows_inserted: totalInserted,
    error_message: errors.length > 0 ? errors.join('; ') : null,
    notes: `Ingested ${dbsProcessed} databases, ${totalInserted} rows`,
  })

  // Count critical/warning tablespaces for the caller
  let criticalCount = 0
  let warningCount = 0

  if (parsed.report_date && dbsProcessed > 0) {
    for (const reg of (registries || [])) {
      const pctField = reg.schema_type === 'standard' ? 'max_ts_pct_used' : 'percent_used'
      const { data } = await safeFrom(supabase, reg.table_name)
        .select(`tablespace_name, ${pctField}`)
        .eq('report_date', parsed.report_date)

      if (!data?.length) continue

      const crit = (data as Record<string, unknown>[]).filter(r => (r[pctField] as number) >= 90)
      const warn = (data as Record<string, unknown>[]).filter(r => {
        const p = r[pctField] as number
        return p >= 80 && p < 90
      })

      criticalCount += crit.length
      warningCount += warn.length
    }
  }

  // Check for rapid growth over 7-day window
  if (parsed.report_date && dbsProcessed > 0) {
    try {
      const { data: settingsRow } = await supabase
        .from('system_settings')
        .select('rapid_growth_threshold_gb')
        .limit(1)
        .single()
      const threshold = parseFloat((settingsRow as Record<string, string> | null)?.rapid_growth_threshold_gb ?? '50') || 50
      const sevenDaysAgo = new Date(new Date(parsed.report_date).getTime() - 7 * 86400000).toISOString().split('T')[0]
      const rapidItems: { db_name: string; ts_name: string; growth_gb: number }[] = []

      for (const reg of (registries || [])) {
        const usedField = reg.schema_type === 'standard' ? 'used_ts_size' : 'gb_used'
        const tb = safeFrom(supabase, reg.table_name)
        const [{ data: todayGb }, { data: weekAgoGb }] = await Promise.all([
          tb.select(`tablespace_name, ${usedField}`).eq('report_date', parsed.report_date),
          tb.select(`tablespace_name, ${usedField}`).eq('report_date', sevenDaysAgo),
        ])
        if (!todayGb?.length || !weekAgoGb?.length) continue
        const weekMap = new Map(
          (weekAgoGb as Record<string, unknown>[]).map(r => [r.tablespace_name as string, r[usedField] as number])
        )
        for (const row of todayGb as Record<string, unknown>[]) {
          const name = row.tablespace_name as string
          const todayVal = row[usedField] as number
          const weekVal = weekMap.get(name) ?? todayVal
          const growth = todayVal - weekVal
          if (growth >= threshold) {
            rapidItems.push({ db_name: reg.db_name || reg.db_key, ts_name: name, growth_gb: growth })
          }
        }
      }

      if (rapidItems.length > 0) {
        await sendRapidGrowthAlert(parsed.report_date, rapidItems)
      }
    } catch (err) {
      console.error('[rapid-growth-check] failed:', err)
    }
  }

  return {
    success: true,
    report_date: parsed.report_date,
    report_time: parsed.report_time,
    databases_processed: dbsProcessed,
    total_rows_inserted: totalInserted,
    critical_count: criticalCount,
    warning_count: warningCount,
    errors: errors.length > 0 ? errors : undefined,
  }
}

async function logIngest(data: {
  report_date?: string
  report_time?: string
  status: string
  databases_processed?: number
  total_rows_inserted?: number
  error_message?: string | null
  notes?: string
}) {
  try {
    const supabase = createServiceClient()
    await supabase.from('report_log').insert(data)
  } catch (err) {
    console.error('[ingest-log] failed to write report_log:', err)
  }
}
