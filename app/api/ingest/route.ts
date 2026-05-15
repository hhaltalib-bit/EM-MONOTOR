import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { parseHtmlReport } from '@/lib/parser/html-parser'
import { ParsedStandardRow, ParsedDwhRow } from '@/types'

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let htmlContent: string

  try {
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File
      if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      htmlContent = await file.text()
    } else {
      const body = await request.json()
      htmlContent = body.html
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const skipDateValidation = request.nextUrl.searchParams.get('test') === '1'

  const parsed = parseHtmlReport(htmlContent, skipDateValidation)
  console.log('Parser result:', JSON.stringify({ valid: parsed.valid, reason: (parsed as {reason?: string}).reason, report_date: (parsed as {report_date?: string}).report_date, databases: (parsed as {databases?: unknown[]}).databases?.length }))

  if (!parsed.valid) {
    await logIngest({ status: 'skipped', error_message: `Validation failed: ${parsed.reason}` })
    return NextResponse.json({ success: false, reason: parsed.reason })
  }

  const supabase = createServiceClient()

  const { data: registries } = await supabase
    .from('db_registry')
    .select('db_key, table_name, schema_type')

  const regMap = new Map(
    (registries || []).map((r: { db_key: string; table_name: string; schema_type: string }) => [
      r.db_key.toLowerCase(), r,
    ])
  )

  let totalInserted = 0
  let dbsProcessed = 0
  const errors: string[] = []

  for (const db of parsed.databases!) {
    const reg = regMap.get(db.db_key.toLowerCase())
    if (!reg) { errors.push(`Unknown db_key: ${db.db_key}`); continue }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tb = supabase.from(reg.table_name) as any

      if (db.schema_type === 'standard') {
        const rows = (db.tablespaces as ParsedStandardRow[]).map(ts => ({
          report_date: parsed.report_date,
          tablespace_name: ts.tablespace_name,
          aut: ts.aut,
          max_ts_size: ts.max_ts_size,
          max_ts_pct_used: ts.max_ts_pct_used,
          curr_ts_size: ts.curr_ts_size,
          used_ts_size: ts.used_ts_size,
          ts_pct_used: ts.ts_pct_used,
          free_ts_size: ts.free_ts_size,
          ts_pct_free: ts.ts_pct_free,
        }))
        const { error } = await tb.upsert(rows, { onConflict: 'report_date,tablespace_name', ignoreDuplicates: true })
        if (error) throw new Error(error.message)
        totalInserted += rows.length
      } else {
        const rows = (db.tablespaces as ParsedDwhRow[]).map(ts => ({
          report_date: parsed.report_date,
          tablespace_name: ts.tablespace_name,
          gb_total: ts.gb_total,
          gb_used: ts.gb_used,
          gb_free: ts.gb_free,
          percent_used: ts.percent_used,
        }))
        const { error } = await tb.upsert(rows, { onConflict: 'report_date,tablespace_name', ignoreDuplicates: true })
        if (error) throw new Error(error.message)
        totalInserted += rows.length
      }
      dbsProcessed++
    } catch (err) {
      errors.push(`${db.db_key}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  await logIngest({
    report_date: parsed.report_date,
    report_time: parsed.report_time,
    status: errors.length > 0 && dbsProcessed === 0 ? 'error' : 'success',
    databases_processed: dbsProcessed,
    total_rows_inserted: totalInserted,
    error_message: errors.length > 0 ? errors.join('; ') : null,
    notes: `Ingested ${dbsProcessed} databases, ${totalInserted} rows`,
  })

  return NextResponse.json({
    success: true,
    report_date: parsed.report_date,
    report_time: parsed.report_time,
    databases_processed: dbsProcessed,
    total_rows_inserted: totalInserted,
    errors: errors.length > 0 ? errors : undefined,
  })
}

async function logIngest(data: {
  report_date?: string
  report_time?: string
  status: string
  databases_processed?: number
  total_rows_inserted?: number
  error_message?: string | null
  notes?: string
}) {
  try {
    const supabase = createServiceClient()
    await supabase.from('report_log').insert(data)
  } catch { /* non-critical */ }
}

