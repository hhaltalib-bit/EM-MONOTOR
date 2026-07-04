import { createServiceClient } from '@/lib/supabase/server'
import { safeFrom } from '@/lib/db/safeTable'
import { getThresholds } from '@/lib/utils/getThresholds'
import { getCachedRegistry } from '@/lib/utils/getRegistry'
import { getLatestReportDate } from '@/lib/utils/getLatestReportDate'
import { logger } from '@/lib/utils/logger'
import { MS_PER_DAY } from '@/lib/constants'
import { fields } from '@/lib/analytics/schemaFields'
import {
  DateRow,
  daysBetween,
  growthBetween,
  longPctRate,
  recentPctRate,
  daysUntilFull,
  severityOf,
} from '@/lib/analytics/calc'

const HISTORY_WINDOW_DAYS = 40
const SPIKE_WINDOW_DAYS = 14

interface ComputeResult {
  ok: boolean
  targetDate?: string
  tsMetricsWritten?: number
  anomaliesWritten?: number
  snapshotWritten?: boolean
  error?: string
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

interface AnomalyRow {
  db_key: string
  db_name: string
  ts_name: string
  anomaly_type: string
  description: string
  detected_date: string
  pct_at_detect: number
  resolved: boolean
}

interface MetricRow {
  db_key: string
  db_name: string
  ts_name: string
  report_date: string
  schema_type: string
  pct: number
  used_gb: number
  size_gb: number
  max_gb: number | null
  aut: string
  growth_1d_gb: number
  growth_days: number
  rate_7d_pct: number
  rate_full_pct: number
  days_until_full: number | null
  severity: string
}

export async function computeAndStoreMetrics(targetDate?: string): Promise<ComputeResult> {
  try {
    const supabase = createServiceClient()
    const [{ warn, crit }, registry] = await Promise.all([getThresholds(), getCachedRegistry()])

    const date = targetDate ?? (await getLatestReportDate())
    if (!date) {
      return { ok: false, error: 'No report_date available to compute metrics for' }
    }

    const windowStart = toDateStr(new Date(new Date(`${date}T00:00:00Z`).getTime() - HISTORY_WINDOW_DAYS * MS_PER_DAY))

    const metricRows: MetricRow[] = []
    const anomalyRows: AnomalyRow[] = []

    for (const reg of registry) {
      const f = fields(reg.schema_type)
      const cols = new Set<string>(['tablespace_name', 'report_date', f.pct, f.used, f.size, f.max])
      if (f.hasAut && f.aut) cols.add(f.aut)

      let data: Record<string, unknown>[] | null = null
      try {
        const res = await safeFrom(supabase, reg.table_name)
          .select(Array.from(cols).join(', '))
          .gte('report_date', windowStart)
          .lte('report_date', date)
          .order('report_date', { ascending: true })
        data = res.data as Record<string, unknown>[] | null
        if (res.error) throw new Error(res.error.message)
      } catch (err) {
        logger.error('computeMetrics', `failed to fetch history for ${reg.table_name}`, { err: String(err) })
        continue
      }
      if (!data || data.length === 0) continue

      const byTs = new Map<string, DateRow[]>()
      for (const r of data) {
        const key = r.tablespace_name as string
        const row: DateRow = { report_date: r.report_date as string, ...r }
        if (!byTs.has(key)) byTs.set(key, [])
        byTs.get(key)!.push(row)
      }

      for (const [tsName, rows] of byTs) {
        const newest = rows[rows.length - 1]
        if (newest.report_date !== date) continue // no report for this ts on the target date

        const prev = rows.length >= 2 ? rows[rows.length - 2] : null
        const growth = prev ? growthBetween(prev, newest, f.used) : { growthGb: 0, days: 0, ratePerDay: 0 }
        const rate7 = recentPctRate(rows, f.pct, 7)
        const rateFull = longPctRate(rows, f.pct)
        const currentPct = newest[f.pct] as number
        const dtf = daysUntilFull(currentPct, rate7)
        const severity = severityOf(currentPct, warn, crit)
        const autVal = f.hasAut && f.aut ? (newest[f.aut] as string) : 'N/A'

        metricRows.push({
          db_key: reg.db_key,
          db_name: reg.db_name,
          ts_name: tsName,
          report_date: date,
          schema_type: reg.schema_type,
          pct: currentPct,
          used_gb: newest[f.used] as number,
          size_gb: newest[f.size] as number,
          max_gb: (newest[f.max] as number) ?? null,
          aut: autVal,
          growth_1d_gb: growth.growthGb,
          growth_days: growth.days,
          rate_7d_pct: rate7,
          rate_full_pct: rateFull,
          days_until_full: dtf,
          severity,
        })

        // ── Anomaly detection ──
        if (prev) {
          const last15 = rows.slice(-(SPIKE_WINDOW_DAYS + 1))
          let avgGrowth = 0
          if (last15.length >= 2) {
            let sum = 0
            let count = 0
            for (let i = 1; i < last15.length; i++) {
              sum += growthBetween(last15[i - 1], last15[i], f.used).growthGb
              count++
            }
            avgGrowth = count > 0 ? sum / count : 0
          }
          if (avgGrowth > 0 && growth.growthGb > 3 * avgGrowth) {
            anomalyRows.push({
              db_key: reg.db_key, db_name: reg.db_name, ts_name: tsName,
              anomaly_type: 'spike',
              description: `Grew +${growth.growthGb.toFixed(1)} GB in ${growth.days}d — ${(growth.growthGb / avgGrowth).toFixed(1)}x its recent average (${avgGrowth.toFixed(1)} GB/day)`,
              detected_date: date, pct_at_detect: currentPct, resolved: false,
            })
          }

          const prevPct = prev[f.pct] as number
          if (prevPct < crit && currentPct >= crit) {
            anomalyRows.push({
              db_key: reg.db_key, db_name: reg.db_name, ts_name: tsName,
              anomaly_type: 'threshold_cross',
              description: `Crossed ${crit}% threshold — now at ${currentPct.toFixed(1)}%`,
              detected_date: date, pct_at_detect: currentPct, resolved: false,
            })
          } else if (prevPct < warn && currentPct >= warn) {
            anomalyRows.push({
              db_key: reg.db_key, db_name: reg.db_name, ts_name: tsName,
              anomaly_type: 'threshold_cross',
              description: `Crossed ${warn}% threshold — now at ${currentPct.toFixed(1)}%`,
              detected_date: date, pct_at_detect: currentPct, resolved: false,
            })
          }

          if (rateFull > 0 && rate7 > 2 * rateFull) {
            anomalyRows.push({
              db_key: reg.db_key, db_name: reg.db_name, ts_name: tsName,
              anomaly_type: 'rate_change',
              description: `Growth rate changed from ${rateFull.toFixed(2)}%/day to ${rate7.toFixed(2)}%/day`,
              detected_date: date, pct_at_detect: currentPct, resolved: false,
            })
          }
        }

        if (severity === 'critical') {
          const description = f.hasAut && autVal === 'YES'
            ? `At ${currentPct.toFixed(1)}% — autoextend active but MAX_SIZE nearly reached`
            : `At ${currentPct.toFixed(1)}% usage — approaching full`
          anomalyRows.push({
            db_key: reg.db_key, db_name: reg.db_name, ts_name: tsName,
            anomaly_type: 'near_full',
            description,
            detected_date: date, pct_at_detect: currentPct, resolved: false,
          })
        }
      }
    }

    if (metricRows.length > 0) {
      const { error } = await safeFrom(supabase, 'analytics_ts_metrics')
        .upsert(metricRows, { onConflict: 'db_key,ts_name,report_date' })
      if (error) throw new Error(error.message)
    }

    if (anomalyRows.length > 0) {
      const { error } = await safeFrom(supabase, 'analytics_anomalies')
        .upsert(anomalyRows, { onConflict: 'db_key,ts_name,anomaly_type,detected_date' })
      if (error) throw new Error(error.message)
    }

    // ── Fleet snapshot ──
    const fleetTotalGb = metricRows.reduce((sum, r) => sum + (r.size_gb || 0), 0)
    const fleetUsedGb = metricRows.reduce((sum, r) => sum + (r.used_gb || 0), 0)
    const criticalCount = metricRows.filter(r => r.severity === 'critical').length
    const warningCount = metricRows.filter(r => r.severity === 'warning').length
    const healthyCount = metricRows.filter(r => r.severity === 'healthy').length
    const growthSamples = metricRows.filter(r => r.growth_days > 0)
    const avgDailyGrowthGb = growthSamples.length > 0
      ? growthSamples.reduce((sum, r) => sum + r.growth_1d_gb, 0) / growthSamples.length
      : 0
    const dbCount = new Set(metricRows.map(r => r.db_key)).size

    let monthlyGrowthGb: number | null = null
    try {
      const { data: snapHistory } = await safeFrom(supabase, 'analytics_daily_snapshot')
        .select('report_date, fleet_used_gb')
        .lt('report_date', date)
        .order('report_date', { ascending: false })
        .limit(60)
      if (snapHistory && snapHistory.length > 0) {
        const targetMs = new Date(`${date}T00:00:00Z`).getTime() - 30 * MS_PER_DAY
        let closest = snapHistory[0]
        let closestDiff = Infinity
        for (const s of snapHistory as { report_date: string; fleet_used_gb: number }[]) {
          const diff = Math.abs(new Date(`${s.report_date}T00:00:00Z`).getTime() - targetMs)
          if (diff < closestDiff) { closestDiff = diff; closest = s }
        }
        const closestRow = closest as { report_date: string; fleet_used_gb: number }
        if (daysBetween(closestRow.report_date, date) > 0) {
          monthlyGrowthGb = fleetUsedGb - closestRow.fleet_used_gb
        }
      }
    } catch (err) {
      logger.error('computeMetrics', 'failed to compute monthly growth from snapshot history', { err: String(err) })
    }

    if (metricRows.length > 0) {
      const { error } = await safeFrom(supabase, 'analytics_daily_snapshot').upsert(
        {
          report_date: date,
          fleet_total_gb: fleetTotalGb,
          fleet_used_gb: fleetUsedGb,
          critical_count: criticalCount,
          warning_count: warningCount,
          healthy_count: healthyCount,
          avg_daily_growth_gb: avgDailyGrowthGb,
          monthly_growth_gb: monthlyGrowthGb,
          db_count: dbCount,
          ts_count: metricRows.length,
        },
        { onConflict: 'report_date' }
      )
      if (error) throw new Error(error.message)
    }

    return {
      ok: true,
      targetDate: date,
      tsMetricsWritten: metricRows.length,
      anomaliesWritten: anomalyRows.length,
      snapshotWritten: metricRows.length > 0,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('computeMetrics', 'metric computation failed', { err: msg })
    return { ok: false, error: msg }
  }
}
