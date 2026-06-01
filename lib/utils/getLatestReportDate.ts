import { createServiceClient } from '@/lib/supabase/server'
import { safeFrom } from '@/lib/db/safeTable'

/**
 * Returns the most recent report_date found across all active tablespace tables.
 * Queries db_registry to discover all table names dynamically, so new databases
 * are automatically included without code changes.
 * Returns null (and logs an error) when no data is found in any table.
 */
export async function getLatestReportDate(): Promise<string | null> {
  const supabase = createServiceClient()

  // Discover all active tablespace table names from the registry
  let tableNames: string[] = []
  try {
    const { data: registries } = await supabase
      .from('db_registry')
      .select('table_name')
      .eq('is_active', true)
    tableNames = (registries ?? []).map((r: { table_name: string }) => r.table_name)
  } catch (err) {
    console.error('[getLatestReportDate] failed to query db_registry:', err)
  }

  for (const table of tableNames) {
    try {
      const { data } = await safeFrom(supabase, table)
        .select('report_date')
        .order('report_date', { ascending: false })
        .limit(1)
        .single()
      if (data?.report_date) return data.report_date
    } catch (err) {
      console.error(`[getLatestReportDate] failed to query ${table}:`, err)
    }
  }

  console.error('[getLatestReportDate] no data found in any tablespace table')
  return null
}
