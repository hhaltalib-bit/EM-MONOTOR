import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { safeFrom } from '@/lib/db/safeTable'
import { daysBetween } from '@/lib/analytics/calc'
import { MS_PER_DAY } from '@/lib/constants'
import { logger } from '@/lib/utils/logger'

const MAX_ITEMS = 3
const WINDOW_DAYS = 30

interface MetricRow {
  report_date: string
  ts_name: string
  db_name: string
  pct: number
}

// Reads 30-day pct series per item from the pre-computed analytics_ts_metrics table.
export async function GET(request: NextRequest) {
  const auth = await requireAuth(false)
  if (!auth.ok) return auth.response

  const itemsParam = request.nextUrl.searchParams.get('items') ?? ''
  const parsed = itemsParam
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      const [db, ts] = s.split(':')
      return { db, ts }
    })
    .filter(i => i.db && i.ts)
    .slice(0, MAX_ITEMS)

  if (parsed.length === 0) return NextResponse.json({ items: [], rows: [] })

  try {
    const supabase = createServiceClient()

    const { data: latestOverall } = await safeFrom(supabase, 'analytics_ts_metrics')
      .select('report_date')
      .order('report_date', { ascending: false })
      .limit(1)
      .single()

    const latestDate = latestOverall?.report_date as string | undefined
    if (!latestDate) return NextResponse.json({ items: [], rows: [] })

    const fromDate = new Date(new Date(`${latestDate}T00:00:00Z`).getTime() - WINDOW_DAYS * MS_PER_DAY)
      .toISOString().split('T')[0]

    const items: { db_key: string; ts_name: string; db_name: string; dates: string[]; pct: number[] }[] = []
    const rateRows: { ts_name: string; db_name: string; currentPct: number; growth30d: number; ratePerDay: number }[] = []

    for (const { db, ts } of parsed) {
      const { data, error } = await safeFrom(supabase, 'analytics_ts_metrics')
        .select('report_date, ts_name, db_name, pct')
        .eq('db_key', db)
        .eq('ts_name', ts)
        .gte('report_date', fromDate)
        .lte('report_date', latestDate)
        .order('report_date', { ascending: true })

      if (error) { logger.error('analytics-compare', 'failed to load series', { err: error.message, db, ts }); continue }
      const rows = (data ?? []) as MetricRow[]
      if (rows.length === 0) continue

      items.push({
        db_key: db, ts_name: ts, db_name: rows[0].db_name,
        dates: rows.map(r => r.report_date), pct: rows.map(r => r.pct),
      })

      const first = rows[0]
      const last = rows[rows.length - 1]
      const days = daysBetween(first.report_date, last.report_date)
      const growth30d = last.pct - first.pct
      const ratePerDay = days > 0 ? growth30d / days : 0
      rateRows.push({ ts_name: ts, db_name: rows[0].db_name, currentPct: last.pct, growth30d, ratePerDay })
    }

    const maxRate = rateRows.length > 0 ? Math.max(...rateRows.map(r => r.ratePerDay)) : 0
    const rows = rateRows.map(r => ({
      ...r,
      trend: r.ratePerDay <= 0 ? 'stable'
        : r.ratePerDay === maxRate && maxRate > 0 ? 'fastest'
        : r.ratePerDay > 0.02 ? 'rising'
        : 'stable',
    }))

    return NextResponse.json({ items, rows })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error('analytics-compare', 'failed to load compare data', { err: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
