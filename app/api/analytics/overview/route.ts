import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { safeFrom } from '@/lib/db/safeTable'
import { logger } from '@/lib/utils/logger'

interface SnapshotRow {
  report_date: string
  fleet_total_gb: number
  fleet_used_gb: number
  critical_count: number
  warning_count: number
  healthy_count: number
  avg_daily_growth_gb: number
  monthly_growth_gb: number | null
  db_count: number
  ts_count: number
}

interface MoverRow {
  ts_name: string
  db_name: string
  db_key: string
  growth_1d_gb: number
  pct: number
  severity: string
}

// Reads pre-computed analytics_daily_snapshot + analytics_ts_metrics — no
// on-the-fly computation, no raw *_ts queries.
export async function GET() {
  const auth = await requireAuth(false)
  if (!auth.ok) return auth.response

  try {
    const supabase = createServiceClient()

    const { data: snapshot, error: snapErr } = await safeFrom(supabase, 'analytics_daily_snapshot')
      .select('report_date, fleet_total_gb, fleet_used_gb, critical_count, warning_count, healthy_count, avg_daily_growth_gb, monthly_growth_gb, db_count, ts_count')
      .order('report_date', { ascending: false })
      .limit(1)
      .single()

    if (snapErr || !snapshot) {
      return NextResponse.json({
        reportDate: null, fleetTotalGb: 0, fleetGrowthMonth: null, criticalCount: 0,
        warningCount: 0, avgDailyGrowthGb: 0, topMovers: [], insights: [],
      })
    }

    const snap = snapshot as SnapshotRow

    const { data: movers, error: moversErr } = await safeFrom(supabase, 'analytics_ts_metrics')
      .select('ts_name, db_name, db_key, growth_1d_gb, pct, severity')
      .eq('report_date', snap.report_date)
      .order('growth_1d_gb', { ascending: false })
      .limit(6)

    if (moversErr) throw new Error(moversErr.message)

    const topMovers = (movers ?? []) as MoverRow[]

    const { data: criticalDbRows } = await safeFrom(supabase, 'analytics_ts_metrics')
      .select('db_key')
      .eq('report_date', snap.report_date)
      .eq('severity', 'critical')

    const criticalDbCount = new Set((criticalDbRows ?? []).map((r: { db_key: string }) => r.db_key)).size
    const totalDbCount = snap.db_count

    const insights: string[] = []
    if (snap.monthly_growth_gb != null && topMovers.length > 0) {
      insights.push(`Fleet grew ${Math.round(snap.monthly_growth_gb)} GB over the last ~30 days. ${topMovers[0].ts_name} is the main driver.`)
    } else if (topMovers.length > 0) {
      insights.push(`${topMovers[0].ts_name} is the fastest-growing tablespace in the last available day (+${topMovers[0].growth_1d_gb.toFixed(1)} GB).`)
    }
    insights.push(`${Math.max(0, totalDbCount - criticalDbCount)} of ${totalDbCount} databases have no critical tablespaces. ${criticalDbCount} need attention.`)

    return NextResponse.json({
      reportDate: snap.report_date,
      fleetTotalGb: snap.fleet_total_gb,
      fleetGrowthMonth: snap.monthly_growth_gb,
      criticalCount: snap.critical_count,
      warningCount: snap.warning_count,
      avgDailyGrowthGb: snap.avg_daily_growth_gb,
      topMovers,
      insights,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error('analytics-overview', 'failed to load overview', { err: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
