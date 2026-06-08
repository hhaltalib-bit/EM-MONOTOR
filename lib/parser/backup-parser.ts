// Pure parser — no database writes. Persistence is handled by backupService.ts.

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
  failed_types: string | null
  succeeded_types: string | null
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
  failed_dbs?:  Array<{ name: string; age: number; lastRun: string }>
  delayed_dbs?: Array<{ name: string; age: number; lastRun: string }>
  reason?: string
}

interface RawBackupRow {
  db_key: string
  db_name: string
  backup_type: string | null
  start_time: string | null
  end_time: string | null
  status: string | null
  time_taken: string | null
  output_gb: number | null
  output_device: string | null
}

const MONTH_MAP: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
}

function parseOracleTimestamp(s: string): string | null {
  const trimmed = s?.trim()
  if (!trimmed) return null

  const normalized = trimmed.replace(/[\r\n]+\s*/g, ' ').trim()

  if (/^\d{4}-\d{2}-\d{2}/.test(normalized)) {
    const d = new Date(normalized.replace(' ', 'T'))
    return isNaN(d.getTime()) ? null : d.toISOString()
  }

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
  if (ageDays > 90) return 'ignored'
  if (status?.includes('FAILED')) return 'failed'
  if (ageDays >= 1) return 'delayed'
  return 'healthy'
}

function normalizeOutputGb(raw: string): number | null {
  const n = parseFloat(raw)
  if (isNaN(n)) return null
  if (n > 1_000_000_000) return Math.round((n / 1_073_741_824) * 100) / 100
  if (n > 100_000) return Math.round((n / 1024) * 100) / 100
  return Math.round(n * 100) / 100
}

/**
 * Pure parsing function — reads HTML, returns structured rows.
 * Does NOT interact with the database.
 * Pass a regMap to resolve db_key → db_name; if null, db_name defaults to db_key.
 */
export function parseBackupReport(
  htmlContent: string,
  reportDate: string,
  regMap: Map<string, string> | null = null,
): BackupParseResult {
  const dbKeyPositions: Array<{ pos: number; key: string }> = []
  const labelPattern = /Database Name[\s\S]*?<td[^>]*>\s*([A-Za-z0-9_]+)\s*[:\-]/gi
  let lm: RegExpExecArray | null
  while ((lm = labelPattern.exec(htmlContent)) !== null) {
    dbKeyPositions.push({ pos: lm.index, key: lm[1].toLowerCase() })
  }
  const dbNamePattern = /DB Name\s*[:\s]+([A-Za-z0-9_]+)/gi
  while ((lm = dbNamePattern.exec(htmlContent)) !== null) {
    if (!dbKeyPositions.find(d => Math.abs(d.pos - lm!.index) < 50)) {
      dbKeyPositions.push({ pos: lm.index, key: lm[1].toLowerCase() })
    }
  }

  // Phase A: collect ALL rows into a Map grouped by db_key (no seenKeys skip)
  const allRows = new Map<string, RawBackupRow[]>()

  const tablePattern = /<table[\s\S]*?<\/table>/gi
  let tm: RegExpExecArray | null
  while ((tm = tablePattern.exec(htmlContent)) !== null) {
    const tableHtml = tm[0]
    const tablePos = tm.index
    const tableRows = parseTableRows(tableHtml)
    if (tableRows.length < 2) continue

    const header = tableRows[0].map(h => h.toUpperCase().trim())
    const inputTypeIdx = header.findIndex(h => h === 'INPUT_TYPE')
    if (inputTypeIdx === -1) continue

    const statusIdx       = header.findIndex(h => h === 'STATUS')
    const startTimeIdx    = header.findIndex(h => h.startsWith('START_TIME'))
    const endTimeIdx      = header.findIndex(h => h.startsWith('END_TIME'))
    const timeTakenIdx    = header.findIndex(h => h.startsWith('TIME_TAKEN'))
    const outputGbIdx     = header.findIndex(h => h.startsWith('OUTPUT_GB') || h === 'OUTPUT_BYTES')
    const outputDeviceIdx = header.findIndex(h => h.startsWith('OUTPUT_DEVICE'))

    const precedingLabel = dbKeyPositions.filter(d => d.pos < tablePos).pop()
    if (!precedingLabel) continue

    const dbKey  = precedingLabel.key
    const dbName = regMap?.get(dbKey) || dbKey

    // Collect ALL data rows for this table (skip header at index 0)
    for (let ri = 1; ri < tableRows.length; ri++) {
      const dataRow = tableRows[ri]
      if (!dataRow?.length) continue

      const backupType   = inputTypeIdx >= 0 ? (dataRow[inputTypeIdx]?.trim() || null) : null
      const statusRaw    = statusIdx >= 0 ? (dataRow[statusIdx]?.trim().toUpperCase() || null) : null
      const startTimeIso = parseOracleTimestamp(startTimeIdx >= 0 ? (dataRow[startTimeIdx] || '') : '')
      const endTimeIso   = parseOracleTimestamp(endTimeIdx >= 0 ? (dataRow[endTimeIdx] || '') : '')
      const timeTaken    = timeTakenIdx >= 0 ? (dataRow[timeTakenIdx]?.trim() || null) : null
      const outputGb     = outputGbIdx >= 0 ? normalizeOutputGb(dataRow[outputGbIdx] || '') : null
      const outputDevice = outputDeviceIdx >= 0 ? (dataRow[outputDeviceIdx]?.trim() || null) : null

      if (!allRows.has(dbKey)) allRows.set(dbKey, [])
      allRows.get(dbKey)!.push({
        db_key:        dbKey,
        db_name:       dbName,
        backup_type:   backupType,
        start_time:    startTimeIso,
        end_time:      endTimeIso,
        status:        statusRaw,
        time_taken:    timeTaken,
        output_gb:     outputGb,
        output_device: outputDevice,
      })
    }
  }

  if (allRows.size === 0) {
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

  // Phase B–D: for each db_key, classify using all rows for that db
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Baghdad',
  }).format(new Date())

  const rows: ParsedBackupRow[] = []

  for (const [dbKey, rawRows] of allRows) {
    const dbName = rawRows[0].db_name

    // Phase B: split into today vs not-today rows
    const todayRows = rawRows.filter(r => {
      const rowDate = r.start_time ? r.start_time.split('T')[0] : null
      return rowDate === today
    })

    if (todayRows.length > 0) {
      // Phase C: analyze all today rows together
      const failedRows    = todayRows.filter(r => r.status === 'FAILED')
      const completedRows = todayRows.filter(r => r.status === 'COMPLETED' || r.status === 'RUNNING')

      const failedTypes = failedRows.length > 0
        ? [...new Set(failedRows.map(r => r.backup_type).filter((t): t is string => t !== null))].join(', ') || null
        : null
      const succeededTypes = completedRows.length > 0
        ? [...new Set(completedRows.map(r => r.backup_type).filter((t): t is string => t !== null))].join(', ') || null
        : null

      // Priority: failed > healthy (age_days = 0, so classify() never returns delayed/ignored here)
      const classification: 'healthy' | 'failed' = failedRows.length > 0 ? 'failed' : 'healthy'
      const repRow = failedRows.length > 0
        ? failedRows[0]
        : (completedRows[0] ?? todayRows[0])

      rows.push({
        db_key:         dbKey,
        db_name:        dbName,
        backup_type:    repRow.backup_type,
        start_time:     repRow.start_time,
        end_time:       repRow.end_time,
        status:         repRow.status,
        time_taken:     repRow.time_taken,
        output_gb:      repRow.output_gb,
        output_device:  repRow.output_device,
        age_days:       0,
        classification,
        failed_types:    failedTypes,
        succeeded_types: succeededTypes,
      })
    } else {
      // Phase C (no today rows): use old age-based logic on the most recent row
      const sorted = [...rawRows].sort((a, b) => {
        const aT = a.start_time ? new Date(a.start_time).getTime() : 0
        const bT = b.start_time ? new Date(b.start_time).getTime() : 0
        return bT - aT
      })
      const mostRecent   = sorted[0]
      const ageDays      = calcAgeDays(mostRecent.start_time)
      const classification = classify(mostRecent.status, ageDays)

      rows.push({
        db_key:         dbKey,
        db_name:        dbName,
        backup_type:    mostRecent.backup_type,
        start_time:     mostRecent.start_time,
        end_time:       mostRecent.end_time,
        status:         mostRecent.status,
        time_taken:     mostRecent.time_taken,
        output_gb:      mostRecent.output_gb,
        output_device:  mostRecent.output_device,
        age_days:       ageDays,
        classification,
        failed_types:    null,
        succeeded_types: null,
      })
    }
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
