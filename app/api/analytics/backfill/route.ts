import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { secureCompare } from '@/lib/utils/secureCompare'
import { safeFrom } from '@/lib/db/safeTable'
import { getCachedRegistry } from '@/lib/utils/getRegistry'
import { computeAndStoreMetrics } from '@/lib/analytics/computeMetrics'
import { logger } from '@/lib/utils/logger'

// One-time backfill: populates analytics_ts_metrics / analytics_daily_snapshot /
// analytics_anomalies from the 48 days of *_ts history that already exist.
// Idempotent (computeAndStoreMetrics upserts), safe to re-run.
// Trigger with either an admin session cookie, or a Bearer CRON_SECRET header
// (for a one-off curl/Postman call without a browser session).
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const hasValidSecret = !!token && secureCompare(token, process.env.CRON_SECRET ?? '')

  if (!hasValidSecret) {
    const auth = await requireAuth(true)
    if (!auth.ok) return auth.response
  }

  try {
    const supabase = createServiceClient()
    const registry = await getCachedRegistry()
    if (registry.length === 0) {
      return NextResponse.json({ error: 'No active databases in db_registry' }, { status: 500 })
    }

    // Union of every available report_date across all *_ts tables — some
    // tables may have gaps, so we don't assume uniform coverage.
    const allDates = new Set<string>()
    for (const reg of registry) {
      try {
        const { data, error } = await safeFrom(supabase, reg.table_name).select('report_date')
        if (error) throw new Error(error.message)
        for (const r of (data ?? []) as { report_date: string }[]) allDates.add(r.report_date)
      } catch (err) {
        logger.error('backfill', `failed to fetch dates for ${reg.table_name}`, { err: String(err) })
      }
    }

    // Ascending order matters: monthly_growth_gb looks up the closest prior
    // analytics_daily_snapshot row, which must already exist for earlier dates.
    const sortedDates = Array.from(allDates).sort()

    let datesProcessed = 0
    let rowsWritten = 0
    const failures: string[] = []

    for (const date of sortedDates) {
      const result = await computeAndStoreMetrics(date)
      if (result.ok) {
        datesProcessed++
        rowsWritten += result.tsMetricsWritten ?? 0
      } else {
        failures.push(`${date}: ${result.error}`)
      }
    }

    return NextResponse.json({
      success: true,
      totalDates: sortedDates.length,
      datesProcessed,
      rowsWritten,
      failures: failures.length > 0 ? failures : undefined,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error('backfill', 'backfill failed', { err: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
