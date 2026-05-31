import { NextRequest, NextResponse } from 'next/server'
import { fetchTodayReport } from '@/lib/gmail/gmail-client'
import { sendMissingReportAlert } from '@/lib/email/alerts'
import { createServiceClient } from '@/lib/supabase/server'

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

    const ingestText = await ingestResponse.text()
    const ingestData = JSON.parse(ingestText)

    return NextResponse.json({ success: true, gmail_message_id: result.messageId, ingest_result: ingestData })
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
  } catch { /* non-critical */ }
}


