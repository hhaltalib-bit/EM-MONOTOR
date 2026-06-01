import { createServiceClient } from '@/lib/supabase/server'
import { safeFrom } from '@/lib/db/safeTable'

const FALLBACK_TABLES = ['raid_ts', 'dwh_ts', 'prod1_ts', 'inhouse_ts']

export async function getLatestReportDate(): Promise<string> {
  const supabase = createServiceClient()
  for (const table of FALLBACK_TABLES) {
    try {
      const { data } = await safeFrom(supabase, table)
        .select('report_date')
        .order('report_date', { ascending: false })
        .limit(1)
        .single()
      if (data?.report_date) return data.report_date
    } catch { /* try next table */ }
  }
  return new Date().toISOString().split('T')[0]
}
