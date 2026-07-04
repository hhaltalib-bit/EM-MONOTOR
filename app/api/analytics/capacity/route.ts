import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { safeFrom } from '@/lib/db/safeTable'
import { getThresholds } from '@/lib/utils/getThresholds'
import { logger } from '@/lib/utils/logger'

interface SnapshotRow {
  report_date: string
  fleet_total_gb: number
  fleet_used_gb: number
  monthly_growth_gb: number | null
}

// Reads the real historical fleet series from analytics_daily_snapshot, then
// appends a clearly-labeled forward projection derived from the real
// monthly_growth_gb figure (not fabricated history — a labeled projection).
export async function GET() {
  const auth = await requireAuth(false)
  if (!auth.ok) return auth.response

  try {
    const supabase = createServiceClient()
    const { crit } = await getThresholds()

    const { data, error } = await safeFrom(supabase, 'analytics_daily_snapshot')
      .select('report_date, fleet_total_gb, fleet_used_gb, monthly_growth_gb')
      .order('report_date', { ascending: true })

    if (error) throw new Error(error.message)

    const rows = (data ?? []) as SnapshotRow[]
    if (rows.length === 0) {
      return NextResponse.json({
        insight: null, monthlyFleetGrowthGb: 0, projected3moGb: 0, needed3moGb: 0,
        projected6moGb: 0, needed6moGb: 0, series: { dates: [], actualGb: [], projectedGb: [] },
      })
    }

    const latest = rows[rows.length - 1]
    const monthlyGrowthGb = latest.monthly_growth_gb ?? 0

    const needed3moGb = Math.max(0, 3 * monthlyGrowthGb)
    const needed6moGb = Math.max(0, 6 * monthlyGrowthGb)
    const projected3moGb = latest.fleet_total_gb + needed3moGb
    const projected6moGb = latest.fleet_total_gb + needed6moGb

    const insight = monthlyGrowthGb > 0
      ? `At the current rate, the fleet needs +${Math.round(needed3moGb)} GB of storage over the next 3 months to stay under ${crit}%.`
      : `Fleet growth over the last ~30 days is flat or negative — no additional capacity is currently projected to be needed.`

    const dates = rows.map(r => r.report_date)
    const actualGb = rows.map(r => r.fleet_total_gb)
    const projectedGb: (number | null)[] = dates.map(() => null)
    projectedGb[projectedGb.length - 1] = latest.fleet_total_gb

    const lastDate = new Date(`${latest.report_date}T00:00:00Z`)
    for (let m = 1; m <= 6; m++) {
      const d = new Date(lastDate)
      d.setUTCDate(d.getUTCDate() + m * 30)
      dates.push(d.toISOString().split('T')[0])
      actualGb.push(null as unknown as number)
      projectedGb.push(latest.fleet_total_gb + m * monthlyGrowthGb)
    }

    return NextResponse.json({
      insight,
      monthlyFleetGrowthGb: monthlyGrowthGb,
      projected3moGb, needed3moGb, projected6moGb, needed6moGb,
      series: { dates, actualGb, projectedGb },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error('analytics-capacity', 'failed to load capacity data', { err: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
