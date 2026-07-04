import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { safeFrom } from '@/lib/db/safeTable'
import { logger } from '@/lib/utils/logger'

// Distinct tablespace names for one DB, from the pre-computed analytics_ts_metrics
// table (latest available date), used to populate the Deep Dive selector.
export async function GET(request: NextRequest) {
  const auth = await requireAuth(false)
  if (!auth.ok) return auth.response

  const dbKey = request.nextUrl.searchParams.get('db')
  if (!dbKey) return NextResponse.json({ error: 'Missing db' }, { status: 400 })

  try {
    const supabase = createServiceClient()

    const { data: latestRow } = await safeFrom(supabase, 'analytics_ts_metrics')
      .select('report_date')
      .eq('db_key', dbKey)
      .order('report_date', { ascending: false })
      .limit(1)
      .single()

    if (!latestRow?.report_date) {
      return NextResponse.json({ tablespaces: [], latestDate: null })
    }

    const { data, error } = await safeFrom(supabase, 'analytics_ts_metrics')
      .select('ts_name')
      .eq('db_key', dbKey)
      .eq('report_date', latestRow.report_date)
      .order('ts_name')

    if (error) throw new Error(error.message)

    return NextResponse.json({
      tablespaces: (data ?? []).map((r: { ts_name: string }) => r.ts_name),
      latestDate: latestRow.report_date,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error('analytics-tablespaces', 'failed to load tablespaces', { err: msg, dbKey })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
