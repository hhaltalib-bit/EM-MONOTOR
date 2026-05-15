import { ParseResult, ParsedDatabase, ParsedStandardRow, ParsedDwhRow } from '@/types'

function parseNum(val: string): number | null {
  const trimmed = val.trim()
  if (!trimmed) return null
  const normalized = trimmed.startsWith('.') ? '0' + trimmed : trimmed
  const n = parseFloat(normalized)
  return isNaN(n) ? null : n
}

function extractText(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').trim()
}

function parseTableRows(tableHtml: string): string[][] {
  const rows: string[][] = []
  const rowMatches = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || []

  for (const rowHtml of rowMatches) {
    const cells = rowHtml.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || []
    const cellValues = cells.map(cell => extractText(cell))
    if (cellValues.length > 0) rows.push(cellValues)
  }

  return rows
}

export function parseHtmlReport(htmlContent: string, skipDateValidation = false): ParseResult {
  // Step 1: Extract report timestamp
  const tsMatch = htmlContent.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/)
  if (!tsMatch) {
    return { valid: false, reason: 'no_timestamp' }
  }

  const reportDate = tsMatch[1]
  const reportTime = tsMatch[2]
  const reportHour = parseInt(reportTime.split(':')[0], 10)

  // Step 2: Validate time (must be between 01:00 and 05:59)
  if (reportHour < 1 || reportHour > 5) {
    return { valid: false, reason: 'wrong_time' }
  }

  // Step 3: Validate date (must be today)
  const today = new Date().toISOString().split('T')[0]
  if (!skipDateValidation && reportDate !== today) {
    return { valid: false, reason: 'wrong_date' }
  }

  // Step 4: Pre-scan for "Database Name" table labels with their character positions.
  // SQL*Plus emits a small table with header "Database Name" and a cell like
  // "raid :  RA Database" immediately before each data table.
  const dbLabelPattern = /Database Name[\s\S]*?<td[^>]*>\s*([A-Za-z0-9_]+)\s*[:\-]/gi
  const dbKeyPositions: Array<{ pos: number; key: string }> = []
  let labelMatch
  while ((labelMatch = dbLabelPattern.exec(htmlContent)) !== null) {
    dbKeyPositions.push({ pos: labelMatch.index, key: labelMatch[1].toLowerCase() })
  }

  // Step 5: Walk all <table>...</table> blocks using exec() so we have the
  // actual start position of each table in the document (indexOf is ambiguous
  // when multiple tables share the same opening boilerplate).
  const databases: ParsedDatabase[] = []
  const tablePattern = /<table[\s\S]*?<\/table>/gi
  let tableMatch

  while ((tableMatch = tablePattern.exec(htmlContent)) !== null) {
    const tableHtml = tableMatch[0]
    const tablePos  = tableMatch.index

    const rows = parseTableRows(tableHtml)
    if (rows.length < 2) continue

    const header = rows[0].map(h => h.toUpperCase().trim())

    // Closest "Database Name" label whose position precedes this table.
    const precedingLabel = dbKeyPositions.filter(d => d.pos < tablePos).pop()

    if (header.includes('TABLESPACE_NAME') || header.includes('AUT')) {
      // Standard schema
      const tsIdx     = header.findIndex(h => h.includes('TABLESPACE_NAME'))
      const autIdx    = header.findIndex(h => h === 'AUT')
      const maxSzIdx  = header.findIndex(h => h.includes('MAX_TS_SIZE'))
      const maxPctIdx = header.findIndex(h => h.includes('MAX_TS_PCT'))
      const currIdx   = header.findIndex(h => h.includes('CURR_TS'))
      const usedIdx   = header.findIndex(h => h.includes('USED_TS_SIZE'))
      const pctIdx    = header.findIndex(h => h.includes('TS_PCT_USED'))
      const freeIdx   = header.findIndex(h => h.includes('FREE_TS'))
      const pctFreeIdx = header.findIndex(h => h.includes('TS_PCT_FREE'))

      if (tsIdx === -1 || autIdx === -1) continue

      const tablespaces: ParsedStandardRow[] = []
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r]
        if (!row[tsIdx]?.trim()) continue
        tablespaces.push({
          tablespace_name: row[tsIdx]?.trim() || '',
          aut: (row[autIdx]?.trim().toUpperCase() === 'NO' ? 'NO' : 'YES') as 'YES' | 'NO',
          max_ts_size:     maxSzIdx >= 0 ? parseNum(row[maxSzIdx] || '') : null,
          max_ts_pct_used: parseNum(row[maxPctIdx] || '') ?? 0,
          curr_ts_size:    currIdx >= 0 ? parseNum(row[currIdx] || '') : null,
          used_ts_size:    parseNum(row[usedIdx] || '') ?? 0,
          ts_pct_used:     pctIdx >= 0 ? parseNum(row[pctIdx] || '') : null,
          free_ts_size:    freeIdx >= 0 ? parseNum(row[freeIdx] || '') : null,
          ts_pct_free:     pctFreeIdx >= 0 ? parseNum(row[pctFreeIdx] || '') : null,
        })
      }

      if (tablespaces.length > 0) {
        const dbKey = precedingLabel ? precedingLabel.key : `db_${databases.length}`
        databases.push({ db_key: dbKey, schema_type: 'standard', tablespaces })
      }

    } else if (header.includes('TABLESPACE') && header.includes('GB_TOTAL')) {
      // DWH schema
      const tsIdx    = header.findIndex(h => h === 'TABLESPACE')
      const totalIdx = header.findIndex(h => h.includes('GB_TOTAL'))
      const usedIdx  = header.findIndex(h => h === 'GB_USED')
      const freeIdx  = header.findIndex(h => h.includes('GB_FREE'))
      const pctIdx   = header.findIndex(h => h.includes('PERCENT_USED'))

      if (tsIdx === -1) continue

      const tablespaces: ParsedDwhRow[] = []
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r]
        if (!row[tsIdx]?.trim()) continue
        tablespaces.push({
          tablespace_name: row[tsIdx]?.trim() || '',
          gb_total:     totalIdx >= 0 ? parseNum(row[totalIdx] || '') : null,
          gb_used:      parseNum(row[usedIdx] || '') ?? 0,
          gb_free:      freeIdx >= 0 ? parseNum(row[freeIdx] || '') : null,
          percent_used: parseNum(row[pctIdx] || '') ?? 0,
        })
      }

      if (tablespaces.length > 0) {
        const dbKey = precedingLabel ? precedingLabel.key : 'dwh'
        databases.push({ db_key: dbKey, schema_type: 'dwh', tablespaces })
      }
    }
  }

  if (databases.length === 0) {
    return { valid: false, reason: 'no_databases_found' }
  }

  return {
    valid: true,
    report_date: reportDate,
    report_time: reportTime,
    databases,
  }
}
