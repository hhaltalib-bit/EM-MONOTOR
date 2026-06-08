import { createServiceClient } from '@/lib/supabase/server'
import { parseHtmlReport } from '@/lib/parser/html-parser'
import { ParsedStandardRow, ParsedDwhRow } from '@/types'
import { sendRapidGrowthAlert, sendMissingTablespaceAlert } from '@/lib/email/alerts'
import { safeFrom } from '@/lib/db/safeTable'
import { getThresholds } from '@/lib/utils/getThresholds'
import { RAPID_GROWTH_DEFAULT_GB, GROWTH_WINDOW_DAYS, MS_PER_DAY } from '@/lib/constants'
import { logger } from '@/lib/utils/logger'

export interface IngestResult {
  success: boolean
  report_date?: string
  report_time?: string
  expected_date?: string
  databases_processed: number
  total_rows_inserted: number
  critical_count: number
  warning_count: number
  critical_dbs: Array<{ name: string; pct: number }>
  warning_dbs:  Array<{ name: string; pct: number }>
  reason?: string
  errors?: string[]
}

export async function processIngest(
  htmlContent: string,
  isTest: boolean,
  traceId?: string,
): Promise<IngestResult> {
  const parsed = parseHtmlReport(htmlContent, isTest)

  if (!parsed.valid) {
    if (parsed.reason === 'date_mismatch') {
      logger.warn('ingest', 'tablespace report rejected', {
        traceId,
        reason: 'date_mismatch',
        reportDate: parsed.report_date,
        expectedDate: parsed.expected_date,
        htmlSize: htmlContent.length,
      })
      try {
        await sendMissingTablespaceAlert(parsed.expected_date ?? '', 'date_mismatch')
      } catch (e) {
        logger.error('ingest', 'missing tablespace alert email failed', { traceId, err: String(e) })
      }
      await logIngest({
        status: 'skipped',
        error_message: `date_mismatch: reportDate=${parsed.report_date}, expected=${parsed.expected_date}`,
      })
      return {
        success: false,
        reason: 'date_mismatch',
        report_date:        parsed.report_date,
        expected_date:      parsed.expected_date,
        databases_processed: 0,
        total_rows_inserted: 0,
        critical_count: 0,
        warning_count:  0,
        critical_dbs:   [],
        warning_dbs:    [],
      }
    }
    await logIngest({ status: 'skipped', error_message: `Validation failed: ${parsed.reason}` })
    return { success: false, reason: parsed.reason, databases_processed: 0, total_rows_inserted: 0, critical_count: 0, warning_count: 0, critical_dbs: [], warning_dbs: [] }
  }

  const supabase = createServiceClient()
  const thresholds = await getThresholds()

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
  let criticalCount = 0
  let warningCount = 0
  const criticalDbs: Array<{ name: string; pct: number }> = []
  const warningDbs:  Array<{ name: string; pct: number }> = []
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

        // Count in-memory — no second DB query needed
        const worstPctStd = Math.max(...rows.map(r => r.max_ts_pct_used))
        if (worstPctStd >= thresholds.crit) {
          criticalDbs.push({ name: reg.db_name, pct: Math.round(worstPctStd) })
          criticalCount += rows.filter(r => r.max_ts_pct_used >= thresholds.crit).length
        } else if (worstPctStd >= thresholds.warn) {
          warningDbs.push({ name: reg.db_name, pct: Math.round(worstPctStd) })
          warningCount += rows.filter(r => r.max_ts_pct_used >= thresholds.warn).length
        }
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

        // Count in-memory — no second DB query needed
        const worstPctDwh = Math.max(...rows.map(r => r.percent_used))
        if (worstPctDwh >= thresholds.crit) {
          criticalDbs.push({ name: reg.db_name, pct: Math.round(worstPctDwh) })
          criticalCount += rows.filter(r => r.percent_used >= thresholds.crit).length
        } else if (worstPctDwh >= thresholds.warn) {
          warningDbs.push({ name: reg.db_name, pct: Math.round(worstPctDwh) })
          warningCount += rows.filter(r => r.percent_used >= thresholds.warn).length
        }
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

  // Check for rapid growth over GROWTH_WINDOW_DAYS-day window
  if (parsed.report_date && dbsProcessed > 0) {
    try {
      const { data: settingsRow } = await supabase
        .from('system_settings')
        .select('rapid_growth_threshold_gb')
        .limit(1)
        .single()
      const threshold = parseFloat((settingsRow as Record<string, string> | null)?.rapid_growth_threshold_gb ?? String(RAPID_GROWTH_DEFAULT_GB)) || RAPID_GROWTH_DEFAULT_GB
      const windowAgo = new Date(new Date(parsed.report_date).getTime() - GROWTH_WINDOW_DAYS * MS_PER_DAY).toISOString().split('T')[0]
      const rapidItems: { db_name: string; ts_name: string; growth_gb: number }[] = []

      for (const reg of (registries || [])) {
        const usedField = reg.schema_type === 'standard' ? 'used_ts_size' : 'gb_used'
        const tb = safeFrom(supabase, reg.table_name)
        const [{ data: todayGb }, { data: weekAgoGb }] = await Promise.all([
          tb.select(`tablespace_name, ${usedField}`).eq('report_date', parsed.report_date),
          tb.select(`tablespace_name, ${usedField}`).eq('report_date', windowAgo),
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
      logger.error('rapid-growth-check', 'rapid growth check failed', { err: String(err) })
    }
  }

  criticalDbs.sort((a, b) => b.pct - a.pct)
  warningDbs.sort((a, b) => b.pct - a.pct)

  return {
    success: true,
    report_date:        parsed.report_date,
    report_time:        parsed.report_time,
    databases_processed: dbsProcessed,
    total_rows_inserted: totalInserted,
    critical_count:     criticalCount,
    warning_count:      warningCount,
    critical_dbs:       criticalDbs,
    warning_dbs:        warningDbs,
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
    logger.error('ingest-log', 'failed to write report_log', { err: String(err) })
  }
}
