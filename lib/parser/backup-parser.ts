import { createServiceClient } from '@/lib/supabase/server'

export interface ParsedBackupRow {
  db_key: string
  db_name: string
  backup_type: string | null
  start_time: string | null
  end_time: string | null
  status: string | null
  time_taken: string | null
  output_gb: number | null
  output_device: string | null
  age_days: number
  classification: 'healthy' | 'delayed' | 'failed' | 'ignored'
}

export interface BackupParseResult {
  success: boolean
  reportDate: string
  rows: ParsedBackupRow[]
  databasesCount: number
  healthyCount: number
  delayedCount: number
  failedCount: number
  ignoredCount: number
  reason?: string
}

const MONTH_MAP: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
}

function parseOracleTimestamp(s: string): string | null {
  const trimmed = s?.trim()
  if (!trimmed) return null

  // Normalize: collapse internal newlines/whitespace into a single space.
  // SQL*Plus splits "2025-05-12\n 06:56:15" across two lines in the HTML cell.
  const normalized = trimmed.replace(/[\r\n]+\s*/g, ' ').trim()

  // ISO format: "2026-05-15 02:00:17" or "2026-05-15T02:00:17"
  if (/^\d{4}-\d{2}-\d{2}/.test(normalized)) {
    const d = new Date(normalized.replace(' ', 'T'))
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

  // Oracle: 15-MAY-26 02.00.17 AM  or  15-MAY-2026 02.00.17 AM
  const m = normalized.match(/(\d{1,2})-([A-Z]{3})-(\d{2,4})\s+(\d{1,2})\.(\d{2})\.(\d{2})\s*(AM|PM)?/i)
  if (m) {
    const mon = MONTH_MAP[m[2].toUpperCase()]
    if (mon === undefined) return null
    const day = parseInt(m[1])
    let year = parseInt(m[3])
    if (year < 100) year += 2000
    let hour = parseInt(m[4])
    const min = parseInt(m[5])
    const sec = parseInt(m[6])
    const ampm = m[7]?.toUpperCase()
    if (ampm === 'PM' && hour < 12) hour += 12
    if (ampm === 'AM' && hour === 12) hour = 0
    const d = new Date(year, mon, day, hour, min, sec)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

  return null
}

function extractText(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .trim()
}

function parseTableRows(tableHtml: string): string[][] {
  const rows: string[][] = []
  const rowMatches = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || []
  for (const rowHtml of rowMatches) {
    const cells = rowHtml.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || []
    const vals = cells.map(c => extractText(c))
    if (vals.length > 0) rows.push(vals)
  }
  return rows
}

function calcAgeDays(startTimeIso: string | null): number {
  if (!startTimeIso) return 0
  const startTime = new Date(startTimeIso)
  const now = new Date()
  const diffMs = Math.abs(now.getTime() - startTime.getTime())
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

function classify(
  status: string | null,
  ageDays: number,
): 'healthy' | 'delayed' | 'failed' | 'ignored' {
  if (status?.includes('FAILED')) return 'failed'
  if (ageDays > 90) return 'ignored'
  if (ageDays >= 1) return 'delayed'
  return 'healthy'
}

// Convert output size — handles bytes, MB, or GB depending on scale
function normalizeOutputGb(raw: string): number | null {
  const n = parseFloat(raw)
  if (isNaN(n)) return null
  // Values > 1 billion are likely bytes
  if (n > 1_000_000_000) return Math.round((n / 1_073_741_824) * 100) / 100
  // Values > 1 million are likely MB (from v$backup_piece OUTPUT_BYTES_DISPLAY sometimes uses MB)
  if (n > 100_000) return Math.round((n / 1024) * 100) / 100
  // Treat as GB already
  return Math.round(n * 100) / 100
}

export async function parseBackupReport(
  htmlContent: string,
  reportDate: string,
): Promise<BackupParseResult> {
  const supabase = createServiceClient()

  // Pre-scan for "Database Name" labels (same pattern as tablespace html-parser)
  const dbKeyPositions: Array<{ pos: number; key: string }> = []
  const labelPattern = /Database Name[\s\S]*?<td[^>]*>\s*([A-Za-z0-9_]+)\s*[:\-]/gi
  let lm: RegExpExecArray | null
  while ((lm = labelPattern.exec(htmlContent)) !== null) {
    dbKeyPositions.push({ pos: lm.index, key: lm[1].toLowerCase() })
  }
  // Also check for "DB Name" style headers common in RMAN output
  const dbNamePattern = /DB Name\s*[:\s]+([A-Za-z0-9_]+)/gi
  while ((lm = dbNamePattern.exec(htmlContent)) !== null) {
    if (!dbKeyPositions.find(d => Math.abs(d.pos - lm!.index) < 50)) {
      dbKeyPositions.push({ pos: lm.index, key: lm[1].toLowerCase() })
    }
  }

  // Fetch backup registry once for name lookups
  const { data: registry } = await supabase
    .from('backup_registry')
    .select('db_key, db_name')
  const regMap = new Map<string, string>(
    (registry || []).map((r: { db_key: string; db_name: string }) => [
      r.db_key.toLowerCase(),
      r.db_name,
    ])
  )

  const rows: ParsedBackupRow[] = []
  const seenKeys = new Set<string>()

  const tablePattern = /<table[\s\S]*?<\/table>/gi
  let tm: RegExpExecArray | null
  while ((tm = tablePattern.exec(htmlContent)) !== null) {
    const tableHtml = tm[0]
    const tablePos = tm.index
    const tableRows = parseTableRows(tableHtml)
    if (tableRows.length < 2) continue

    const header = tableRows[0].map(h => h.toUpperCase().trim())

    // Only process RMAN backup tables that have INPUT_TYPE column
    const inputTypeIdx = header.findIndex(h => h === 'INPUT_TYPE')
    if (inputTypeIdx === -1) continue

    const statusIdx       = header.findIndex(h => h === 'STATUS')
    const startTimeIdx    = header.findIndex(h => h.startsWith('START_TIME'))
    const endTimeIdx      = header.findIndex(h => h.startsWith('END_TIME'))
    const timeTakenIdx    = header.findIndex(h => h.startsWith('TIME_TAKEN'))
    const outputGbIdx     = header.findIndex(h => h.startsWith('OUTPUT_GB') || h === 'OUTPUT_BYTES')
    const outputDeviceIdx = header.findIndex(h => h.startsWith('OUTPUT_DEVICE'))

    // Closest preceding db label
    const precedingLabel = dbKeyPositions.filter(d => d.pos < tablePos).pop()
    if (!precedingLabel) continue

    const dbKey = precedingLabel.key
    // One row per db_key per report
    if (seenKeys.has(dbKey)) continue
    seenKeys.add(dbKey)

    // Only the FIRST data row (most recent backup for this DB)
    const dataRow = tableRows[1]
    if (!dataRow?.length) continue

    const backupType   = inputTypeIdx >= 0 ? (dataRow[inputTypeIdx]?.trim() || null) : null
    const statusRaw    = statusIdx >= 0 ? (dataRow[statusIdx]?.trim().toUpperCase() || null) : null
    const startTimeIso = parseOracleTimestamp(startTimeIdx >= 0 ? (dataRow[startTimeIdx] || '') : '')
    const endTimeIso   = parseOracleTimestamp(endTimeIdx >= 0 ? (dataRow[endTimeIdx] || '') : '')
    const timeTaken    = timeTakenIdx >= 0 ? (dataRow[timeTakenIdx]?.trim() || null) : null
    const outputGb     = outputGbIdx >= 0 ? normalizeOutputGb(dataRow[outputGbIdx] || '') : null
    const outputDevice = outputDeviceIdx >= 0 ? (dataRow[outputDeviceIdx]?.trim() || null) : null

    const ageDays = calcAgeDays(startTimeIso)
    const classification = classify(statusRaw, ageDays)
    const dbName = regMap.get(dbKey) || dbKey

    rows.push({
      db_key:         dbKey,
      db_name:        dbName,
      backup_type:    backupType,
      start_time:     startTimeIso,
      end_time:       endTimeIso,
      status:         statusRaw,
      time_taken:     timeTaken,
      output_gb:      outputGb,
      output_device:  outputDevice,
      age_days:       ageDays,
      classification,
    })
  }

  if (rows.length === 0) {
    return {
      success: false,
      reportDate,
      rows: [],
      databasesCount: 0,
      healthyCount: 0,
      delayedCount: 0,
      failedCount: 0,
      ignoredCount: 0,
      reason: 'no_backup_tables_found',
    }
  }

  // UPSERT into backup_status — ON CONFLICT DO NOTHING
  for (const row of rows) {
    await supabase.from('backup_status').upsert(
      {
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
      },
      { onConflict: 'report_date,db_key', ignoreDuplicates: true }
    )
  }

  const healthyCount = rows.filter(r => r.classification === 'healthy').length
  const delayedCount = rows.filter(r => r.classification === 'delayed').length
  const failedCount  = rows.filter(r => r.classification === 'failed').length
  const ignoredCount = rows.filter(r => r.classification === 'ignored').length

  return {
    success: true,
    reportDate,
    rows,
    databasesCount: rows.length,
    healthyCount,
    delayedCount,
    failedCount,
    ignoredCount,
  }
}
