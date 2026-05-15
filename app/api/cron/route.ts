import { NextRequest, NextResponse } from 'next/server'
import { fetchTodayReport } from '@/lib/gmail/gmail-client'
import { sendMissingReportAlert, sendCriticalAlert } from '@/lib/email/alerts'
import { createServiceClient } from '@/lib/supabase/server'
import { DbRegistry } from '@/types'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isForced = request.nextUrl.searchParams.get('force') === '1'

  try {
    const result = await fetchTodayReport(isForced)

    if (!result.found) {
      try { await sendMissingReportAlert() } catch (e) { console.error('Missing report email failed:', e) }
      await logToDb('error', null, null, 0, 0, 'Report not found in Gmail')
      return NextResponse.json({ success: false, reason: 'report_not_found' })
    }

    const ingestUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/ingest${isForced ? '?test=1' : ''}`
    const ingestResponse = await fetch(ingestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET! },
      body: JSON.stringify({ html: result.content }),
    })

    const ingestData = await ingestResponse.json()

    if (ingestData.success) {
      try { await checkAndSendAlerts(ingestData.report_date) } catch (e) { console.error('Alert email failed:', e) }
    }

    return NextResponse.json({ success: true, gmail_message_id: result.messageId, ingest_result: ingestData })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    await logToDb('error', null, null, 0, 0, msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

async function checkAndSendAlerts(reportDate: string) {
  const supabase = createServiceClient()
  const { data: registries } = await supabase.from('db_registry').select('*').eq('is_active', true)
  if (!registries) return

  let criticalTotal = 0
  let warningTotal = 0
  const dbBreakdown: Array<{ name: string; critical_count: number; warning_count: number; critical_tablespaces: Array<{ name: string; pct: number }> }> = []

  for (const reg of registries as DbRegistry[]) {
    const pctField = reg.schema_type === 'standard' ? 'max_ts_pct_used' : 'percent_used'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from(reg.table_name) as any)
      .select(`tablespace_name, ${pctField}`)
      .eq('report_date', reportDate)

    if (!data) continue

    const criticalTs = (data as Record<string, unknown>[])
      .filter(r => (r[pctField] as number) >= 90)
      .map(r => ({ name: r.tablespace_name as string, pct: r[pctField] as number }))

    const warningCount = (data as Record<string, unknown>[])
      .filter(r => { const p = r[pctField] as number; return p >= 80 && p < 90 }).length

    if (criticalTs.length > 0 || warningCount > 0) {
      criticalTotal += criticalTs.length
      warningTotal += warningCount
      dbBreakdown.push({ name: reg.db_name, critical_count: criticalTs.length, warning_count: warningCount, critical_tablespaces: criticalTs })
    }
  }

  if (criticalTotal > 0 || warningTotal > 0) {
    await sendCriticalAlert({ report_date: reportDate, critical_total: criticalTotal, warning_total: warningTotal, databases: dbBreakdown })
  }
}

async function logToDb(status: string, reportDate: string | null, reportTime: string | null, dbsProcessed: number, rowsInserted: number, errorMessage: string) {
  try {
    const supabase = createServiceClient()
    await supabase.from('report_log').insert({ status, report_date: reportDate, report_time: reportTime, databases_processed: dbsProcessed, total_rows_inserted: rowsInserted, error_message: errorMessage })
  } catch { /* non-critical */ }
}


