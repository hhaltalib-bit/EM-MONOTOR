import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { safeFrom } from '@/lib/db/safeTable'
import { MS_PER_DAY } from '@/lib/constants'
import { logger } from '@/lib/utils/logger'

const WINDOW_DAYS = 30

interface MetricRow {
  report_date: string
  pct: number
  growth_1d_gb: number
  severity: string
  db_name: string
  ts_name: string
}

// Per-item card data for the localStorage-driven Watchlist tab.
export async function GET(request: NextRequest) {
  const auth = await requireAuth(false)
  if (!auth.ok) return auth.response

  const dbKey = request.nextUrl.searchParams.get('db')
  const tsName = request.nextUrl.searchParams.get('ts')
  if (!dbKey || !tsName) return NextResponse.json({ error: 'Missing db or ts' }, { status: 400 })

  try {
    const supabase = createServiceClient()

    const { data: latestRow } = await safeFrom(supabase, 'analytics_ts_metrics')
      .select('report_date')
      .eq('db_key', dbKey)
      .eq('ts_name', tsName)
      .order('report_date', { ascending: false })
      .limit(1)
      .single()

    const latestDate = latestRow?.report_date as string | undefined
    if (!latestDate) return NextResponse.json({ found: false })

    const fromDate = new Date(new Date(`${latestDate}T00:00:00Z`).getTime() - WINDOW_DAYS * MS_PER_DAY)
      .toISOString().split('T')[0]

    const { data, error } = await safeFrom(supabase, 'analytics_ts_metrics')
      .select('report_date, pct, growth_1d_gb, severity, db_name, ts_name')
      .eq('db_key', dbKey)
      .eq('ts_name', tsName)
      .gte('report_date', fromDate)
      .lte('report_date', latestDate)
      .order('report_date', { ascending: true })

    if (error) throw new Error(error.message)

    const rows = (data ?? []) as MetricRow[]
    if (rows.length === 0) return NextResponse.json({ found: false })

    const last = rows[rows.length - 1]

    return NextResponse.json({
      found: true,
      dbName: last.db_name,
      tsName: last.ts_name,
      latestPct: last.pct,
      todayGrowthGb: last.growth_1d_gb,
      severity: last.severity,
      dates: rows.map(r => r.report_date),
      pct: rows.map(r => r.pct),
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error('analytics-watch', 'failed to load watch item', { err: msg, dbKey, tsName })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
