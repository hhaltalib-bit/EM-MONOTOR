import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { Resend } from 'resend'
import { parseBackupReport } from '@/lib/parser/backup-parser'
import { createServiceClient } from '@/lib/supabase/server'
import { sendBackupStatusAlert } from '@/lib/email/alerts'

function getOAuth2Client() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  )
  oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN })
  return oauth2Client
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findHtmlContent(payload: any): string | null {
  if (!payload) return null
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8')
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const found = findHtmlContent(part)
      if (found) return found
    }
  }
  return null
}

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

async function sendMissingBackupAlert(reportDate: string) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  console.log('Sending alert to:', process.env.ALERT_EMAIL_TO)
  console.log('From:', process.env.ALERT_EMAIL_FROM)
  await resend.emails.send({
    from: process.env.ALERT_EMAIL_FROM || 'EM MONITOR <alerts@yourdomain.com>',
    to:   process.env.ALERT_EMAIL_TO   || 'hassan.haider@onyxes.com',
    subject: `⚠️ EM MONITOR: RMAN Backup Report NOT received — ${reportDate}`,
    html: `
      <div style="font-family:system-ui,sans-serif;background:#080c14;color:#c9d1d9;padding:24px;max-width:600px;">
        <h1 style="font-size:20px;font-weight:500;color:#d29922;margin:0 0 8px;">Missing RMAN Backup Report</h1>
        <p style="color:#8b949e;margin:0 0 16px;font-size:13px;">${reportDate}</p>
        <div style="background:#391e05;border:0.5px solid #d29922;border-radius:8px;padding:12px 16px;">
          <p style="margin:0;font-size:13px;color:#d29922;">
            The daily RMAN Backup Report was expected at 07:00–08:00 AM (GMT+3) but was not found in Gmail.
          </p>
          <p style="margin:8px 0 0;font-size:11px;color:#8b949e;font-family:monospace;">
            Please check: RMAN scheduler · email forwarding rules · Gmail connectivity
          </p>
        </div>
        <p style="font-size:11px;color:#3d5068;font-family:monospace;margin-top:20px;">
          EM MONITOR Enterprise · Automated Alert
        </p>
      </div>
    `,
  })
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
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const html = body.html

    if (!html) {
      return NextResponse.json({ error: 'No HTML provided' }, { status: 400 })
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
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
