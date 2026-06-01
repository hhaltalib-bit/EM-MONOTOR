import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { parseBackupReport } from '@/lib/parser/backup-parser'
import { createServiceClient } from '@/lib/supabase/server'
import { sendBackupStatusAlert, sendMissingBackupAlert } from '@/lib/email/alerts'
import { getOAuth2Client, findHtmlContent } from '@/lib/gmail/gmail-client'
import { secureCompare } from '@/lib/utils/secureCompare'

async function logBackupReport(
  reportDate: string,
  status: string,
  databasesCount: number,
  healthyCount: number,
  delayedCount: number,
  failedCount: number,
  ignoredCount: number,
  notes: string | null,
) {
  try {
    const supabase = createServiceClient()
    await supabase.from('backup_report_log').insert({
      report_date:     reportDate,
      status,
      databases_count: databasesCount,
      healthy_count:   healthyCount,
      delayed_count:   delayedCount,
      failed_count:    failedCount,
      ignored_count:   ignoredCount,
      notes,
    })
  } catch { /* non-critical */ }
}

interface ParseAndStoreResult {
  reportDate: string
  databasesCount: number
  healthyCount: number
  delayedCount: number
  failedCount: number
  ignoredCount: number
}

async function parseAndStoreBackup(html: string, reportDate: string, notes: string | null = null): Promise<ParseAndStoreResult> {
  const result = await parseBackupReport(html, reportDate)

  if (!result.success) {
    throw new Error(result.reason || 'Parse failed')
  }

  await logBackupReport(
    reportDate, 'success',
    result.databasesCount,
    result.healthyCount,
    result.delayedCount,
    result.failedCount,
    result.ignoredCount,
    notes,
  )

  if (result.failedCount > 0 || result.delayedCount > 0) {
    try {
      await sendBackupStatusAlert({
        report_date: reportDate,
        failed_count: result.failedCount,
        delayed_count: result.delayedCount,
        databases_count: result.databasesCount,
      })
    } catch (e) { console.error('Backup alert email failed:', e) }
  }

  return {
    reportDate,
    databasesCount: result.databasesCount,
    healthyCount:   result.healthyCount,
    delayedCount:   result.delayedCount,
    failedCount:    result.failedCount,
    ignoredCount:   result.ignoredCount,
  }
}

// POST — called by Google Apps Script with { html: '...' }
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret')
  if (!secret || !secureCompare(secret, process.env.CRON_SECRET ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const html = body.html

    if (!html) {
      return NextResponse.json({ error: 'No HTML provided' }, { status: 400 })
    }

    // SEC-H-04: reject payloads larger than 1 MB
    if (html.length > 1_000_000) {
      return NextResponse.json({ success: false, reason: 'payload_too_large' }, { status: 413 })
    }

    const reportDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Baghdad' })

    const result = await parseAndStoreBackup(html, reportDate, null)

    return NextResponse.json({
      success:            true,
      reportDate:         result.reportDate,
      databases_processed: result.databasesCount,
      healthy_count:      result.healthyCount,
      delayed_count:      result.delayedCount,
      failed_count:       result.failedCount,
      ignored_count:      result.ignoredCount,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// GET — internal cron that fetches from Gmail directly
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token || !secureCompare(token, process.env.CRON_SECRET ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isForced = new URL(request.url).searchParams.get('force') === '1'

  const reportDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Baghdad' })

  try {
    const auth = getOAuth2Client()
    const gmail = google.gmail({ version: 'v1', auth })

    const q = isForced
      ? `subject:"RMAN Backup" newer_than:1d`
      : `subject:"RMAN Backup" newer_than:4h`

    const { data: listData } = await gmail.users.messages.list({
      userId: 'me',
      q,
      maxResults: 5,
    })

    if (!listData.messages || listData.messages.length === 0) {
      await logBackupReport(reportDate, 'missing', 0, 0, 0, 0, 0, 'Backup report not found in Gmail')
      try { await sendMissingBackupAlert(reportDate) } catch (e) { console.error('Alert email failed:', e) }
      return NextResponse.json({ success: false, reason: 'report_not_found' })
    }

    const messageId = listData.messages[0].id!
    const { data: message } = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    })

    const htmlContent = findHtmlContent(message.payload)
    if (!htmlContent) {
      await logBackupReport(reportDate, 'error', 0, 0, 0, 0, 0, 'Could not extract HTML from message')
      return NextResponse.json({ success: false, reason: 'no_html_content' })
    }

    const result = await parseAndStoreBackup(htmlContent, reportDate, null)

    return NextResponse.json({
      success:        true,
      reportDate:     result.reportDate,
      databasesCount: result.databasesCount,
      healthyCount:   result.healthyCount,
      delayedCount:   result.delayedCount,
      failedCount:    result.failedCount,
      ignoredCount:   result.ignoredCount,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    await logBackupReport(reportDate, 'error', 0, 0, 0, 0, 0, msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
