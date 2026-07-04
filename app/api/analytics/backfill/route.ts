import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { secureCompare } from '@/lib/utils/secureCompare'
import { computeAndStoreMetrics } from '@/lib/analytics/computeMetrics'
import { logger } from '@/lib/utils/logger'

// Computes and upserts analytics metrics for ONE report_date per call.
// A full 48-day backfill in a single serverless invocation was timing out
// (504) on Vercel's 60s limit, so the loop now lives client-side (see the
// Backfill panel on the Analytics page), which calls this route once per
// date. Idempotent (computeAndStoreMetrics upserts), safe to re-run.
// Trigger with either an admin session cookie, or a Bearer CRON_SECRET
// header (for a one-off curl/Postman call without a browser session).
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const hasValidSecret = !!token && secureCompare(token, process.env.CRON_SECRET ?? '')

  if (!hasValidSecret) {
    const auth = await requireAuth(true)
    if (!auth.ok) return auth.response
  }

  const body = await request.json().catch(() => ({}))
  const singleDate: string | null = body?.date ?? null

  if (singleDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(singleDate)) {
      return NextResponse.json({ error: 'invalid date format' }, { status: 400 })
    }
    try {
      const result = await computeAndStoreMetrics(singleDate)
      if (!result.ok) {
        logger.error('backfill', 'single-date backfill failed', { err: result.error, date: singleDate })
        return NextResponse.json({ ok: false, date: singleDate, error: result.error }, { status: 500 })
      }
      return NextResponse.json({
        ok: true,
        date: singleDate,
        rowsWritten: result.rowsWritten ?? 0,
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logger.error('backfill', 'single-date backfill threw', { err: msg, date: singleDate })
      return NextResponse.json({ ok: false, date: singleDate, error: msg }, { status: 500 })
    }
  }

  // No date provided: don't run the full multi-date backfill — it's what
  // caused the timeout. Point callers at single-date mode instead.
  return NextResponse.json({
    message: 'Use the Analytics page Backfill panel (Admin only) to run backfill',
    hint: 'POST with { "date": "yyyy-MM-dd" } to compute a single date',
  })
}
