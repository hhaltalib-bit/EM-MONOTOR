import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { safeFrom } from '@/lib/db/safeTable'
import { getCachedRegistry } from '@/lib/utils/getRegistry'
import { getThresholds } from '@/lib/utils/getThresholds'
import { fields } from '@/lib/analytics/schemaFields'
import { growthBetween, severityOf } from '@/lib/analytics/calc'
import { MS_PER_DAY } from '@/lib/constants'
import { logger } from '@/lib/utils/logger'

const ALLOWED_PERIODS = new Set([30, 60, 90])

// Reads the ONE raw *_ts table for the requested window — this is the one tab
// that needs full per-day series rather than the pre-computed summary tables.
export async function GET(request: NextRequest) {
  const auth = await requireAuth(false)
  if (!auth.ok) return auth.response

  const dbKey = request.nextUrl.searchParams.get('db')
  const tsName = request.nextUrl.searchParams.get('ts')
  const period = Number(request.nextUrl.searchParams.get('period') ?? '30')

  if (!dbKey || !tsName) return NextResponse.json({ error: 'Missing db or ts' }, { status: 400 })
  if (!ALLOWED_PERIODS.has(period)) return NextResponse.json({ error: 'Invalid period' }, { status: 400 })

  try {
    const supabase = createServiceClient()
    const [registry, thresholds] = await Promise.all([getCachedRegistry(), getThresholds()])
    const reg = registry.find(r => r.db_key === dbKey)
    if (!reg) return NextResponse.json({ error: 'Unknown db' }, { status: 404 })

    const f = fields(reg.schema_type)

    const { data: latestRow } = await safeFrom(supabase, reg.table_name)
      .select('report_date')
      .eq('tablespace_name', tsName)
      .order('report_date', { ascending: false })
      .limit(1)
      .single()

    if (!latestRow?.report_date) {
      return NextResponse.json({ dates: [], pct: [], size: [], used: [], grw: [], metrics: null })
    }

    const latestDate = latestRow.report_date as string
    const fromDate = new Date(new Date(`${latestDate}T00:00:00Z`).getTime() - period * MS_PER_DAY)
      .toISOString().split('T')[0]

    const cols = new Set<string>(['report_date', f.pct, f.used, f.size])
    if (f.hasAut && f.aut) cols.add(f.aut)

    const { data, error } = await safeFrom(supabase, reg.table_name)
      .select(Array.from(cols).join(', '))
      .eq('tablespace_name', tsName)
      .gte('report_date', fromDate)
      .lte('report_date', latestDate)
      .order('report_date', { ascending: true })

    if (error) throw new Error(error.message)

    const rows = (data ?? []) as Record<string, unknown>[]
    if (rows.length === 0) {
      return NextResponse.json({ dates: [], pct: [], size: [], used: [], grw: [], metrics: null })
    }

    const dates = rows.map(r => r.report_date as string)
    const pct = rows.map(r => r[f.pct] as number)
    const size = rows.map(r => r[f.size] as number)
    const used = rows.map(r => r[f.used] as number)
    const grw = rows.map((r, i) => i === 0 ? 0 : growthBetween(
      { report_date: rows[i - 1].report_date as string, ...rows[i - 1] },
      { report_date: r.report_date as string, ...r },
      f.used,
    ).growthGb)

    const last = rows[rows.length - 1]
    const currentPct = last[f.pct] as number
    const currentSize = last[f.size] as number
    const currentUsed = last[f.used] as number
    const free = currentSize - currentUsed
    const aut = f.hasAut && f.aut ? (last[f.aut] as string) : 'N/A'
    const periodGrowthGb = used[used.length - 1] - used[0]
    const statusText = severityOf(currentPct, thresholds.warn, thresholds.crit).toUpperCase()

    return NextResponse.json({
      dates, pct, size, used, grw,
      metrics: {
        currentPct, currentSize, used: currentUsed, free, aut, periodGrowthGb, statusText,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error('analytics-deepdive', 'failed to load deep dive series', { err: msg, dbKey, tsName })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
