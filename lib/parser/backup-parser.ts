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

    const dbKey = precedingLabel.key
    if (seenKeys.has(dbKey)) continue
    seenKeys.add(dbKey)

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
    const dbName = regMap?.get(dbKey) || dbKey

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
