import { NextRequest, NextResponse } from 'next/server'
import { fetchTodayReport } from '@/lib/gmail/gmail-client'
import { sendMissingReportAlert } from '@/lib/email/alerts'
import { createServiceClient } from '@/lib/supabase/server'
import { secureCompare } from '@/lib/utils/secureCompare'
import { processIngest } from '@/lib/services/ingestService'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token || !secureCompare(token, process.env.CRON_SECRET ?? '')) {
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

    // SEC-C-04: call processIngest directly instead of HTTP self-call (removes SSRF risk)
    const ingestResult = await processIngest(result.content, isForced)

    return NextResponse.json({ success: true, gmail_message_id: result.messageId, ingest_result: ingestResult })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    await logToDb('error', null, null, 0, 0, msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

async function logToDb(status: string, reportDate: string | null, reportTime: string | null, dbsProcessed: number, rowsInserted: number, errorMessage: string) {
  try {
    const supabase = createServiceClient()
    await supabase.from('report_log').insert({ status, report_date: reportDate, report_time: reportTime, databases_processed: dbsProcessed, total_rows_inserted: rowsInserted, error_message: errorMessage })
  } catch (err) {
    console.error('[cron-log] failed to write report_log:', err)
  }
}
