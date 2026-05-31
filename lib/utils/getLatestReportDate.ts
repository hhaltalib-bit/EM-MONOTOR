import { createServiceClient } from '@/lib/supabase/server'

const FALLBACK_TABLES = ['raid_ts', 'dwh_ts', 'prod1_ts', 'inhouse_ts']

export async function getLatestReportDate(): Promise<string> {
  const supabase = createServiceClient()
  for (const table of FALLBACK_TABLES) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from(table) as any)
        .select('report_date')
        .order('report_date', { ascending: false })
        .limit(1)
        .single()
      if (data?.report_date) return data.report_date
    } catch { /* try next table */ }
  }
  return new Date().toISOString().split('T')[0]
}
