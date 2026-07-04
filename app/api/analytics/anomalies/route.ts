import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { safeFrom } from '@/lib/db/safeTable'
import { logger } from '@/lib/utils/logger'

const LIMIT = 20

interface AnomalyRow {
  ts_name: string
  db_name: string
  anomaly_type: string
  description: string
  detected_date: string
  pct_at_detect: number
}

// Reads the historical anomaly log — detection runs once at ingest time
// in computeAndStoreMetrics, never in this route.
export async function GET() {
  const auth = await requireAuth(false)
  if (!auth.ok) return auth.response

  try {
    const supabase = createServiceClient()

    const { data, error } = await safeFrom(supabase, 'analytics_anomalies')
      .select('ts_name, db_name, anomaly_type, description, detected_date, pct_at_detect')
      .order('detected_date', { ascending: false })
      .limit(LIMIT)

    if (error) throw new Error(error.message)

    const rows = (data ?? []) as AnomalyRow[]

    return NextResponse.json({
      anomalies: rows.map(r => ({
        ts_name: r.ts_name,
        db_name: r.db_name,
        type: r.anomaly_type,
        description: r.description,
        date: r.detected_date,
        pct: r.pct_at_detect,
      })),
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error('analytics-anomalies', 'failed to load anomalies', { err: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
