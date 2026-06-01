import { createServiceClient } from '@/lib/supabase/server'
import { parseBackupReport, BackupParseResult, ParsedBackupRow } from '@/lib/parser/backup-parser'

/**
 * Fetches the backup registry, parses the HTML, persists rows, and returns the result.
 */
export async function parseAndStoreBackup(
  htmlContent: string,
  reportDate: string,
): Promise<BackupParseResult> {
  const supabase = createServiceClient()

  // Fetch registry for db_key → db_name mapping
  const { data: registry } = await supabase
    .from('backup_registry')
    .select('db_key, db_name')
  const regMap = new Map<string, string>(
    (registry || []).map((r: { db_key: string; db_name: string }) => [
      r.db_key.toLowerCase(),
      r.db_name,
    ])
  )

  // Parse HTML (pure — no DB side effects)
  const result = parseBackupReport(htmlContent, reportDate, regMap)

  if (!result.success || result.rows.length === 0) {
    return result
  }

  // Persist: bulk upsert — single round trip
  await storeBackupRows(supabase, result.rows, reportDate)

  return result
}

async function storeBackupRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  rows: ParsedBackupRow[],
  reportDate: string,
) {
  await supabase.from('backup_status').upsert(
    rows.map(row => ({
      report_date:    reportDate,
      db_key:         row.db_key,
      db_name:        row.db_name,
      backup_type:    row.backup_type,
      start_time:     row.start_time,
      end_time:       row.end_time,
      status:         row.status,
      time_taken:     row.time_taken,
      output_gb:      row.output_gb,
      output_device:  row.output_device,
      age_days:       row.age_days,
      classification: row.classification,
    })),
    { onConflict: 'report_date,db_key', ignoreDuplicates: true }
  )
}
