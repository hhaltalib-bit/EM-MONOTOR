import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { safeFrom } from '@/lib/db/safeTable'
import { MS_PER_DAY } from '@/lib/constants'
import { logger } from '@/lib/utils/logger'

const TABLE_LIMIT = 15

interface MetricRow {
  ts_name: string
  db_name: string
  pct: number
  rate_7d_pct: number
  days_until_full: number
  report_date: string
}

// Reads days_until_full — already computed at ingest time — from analytics_ts_metrics.
export async function GET() {
  const auth = await requireAuth(false)
  if (!auth.ok) return auth.response

  try {
    const supabase = createServiceClient()

    const { data: latestRow } = await safeFrom(supabase, 'analytics_ts_metrics')
      .select('report_date')
      .order('report_date', { ascending: false })
      .limit(1)
      .single()

    const latestDate = latestRow?.report_date as string | undefined
    if (!latestDate) return NextResponse.json({ rows: [], alertCount: 0 })

    const { data, error } = await safeFrom(supabase, 'analytics_ts_metrics')
      .select('ts_name, db_name, pct, rate_7d_pct, days_until_full, report_date')
      .eq('report_date', latestDate)
      .not('days_until_full', 'is', null)
      .order('days_until_full', { ascending: true })

    if (error) throw new Error(error.message)

    const rows = (data ?? []) as MetricRow[]
    const alertCount = rows.filter(r => r.days_until_full < 30).length

    const table = rows.slice(0, TABLE_LIMIT).map(r => {
      const predictedDate = new Date(new Date(`${latestDate}T00:00:00Z`).getTime() + r.days_until_full * MS_PER_DAY)
        .toISOString().split('T')[0]
      return {
        ts_name: r.ts_name, db_name: r.db_name, pct: r.pct,
        rate: r.rate_7d_pct, days: r.days_until_full, predictedDate,
      }
    })

    return NextResponse.json({ rows: table, alertCount })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error('analytics-forecast', 'failed to load forecast', { err: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
