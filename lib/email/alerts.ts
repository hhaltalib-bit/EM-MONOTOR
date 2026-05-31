import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY)

async function getAlertEmail(): Promise<string> {
  try {
    const supabase = createServiceClient()
    const { data } = await supabase.from('system_settings').select('alert_email').limit(1).single()
    if (data?.alert_email) return data.alert_email
  } catch { /* fall through */ }
  return process.env.ALERT_EMAIL_TO || 'hassan.haider@onyxes.com'
}

export async function sendMissingReportAlert() {
  const today = new Date().toISOString().split('T')[0]
  const subject = `⚠️ EM MONITOR: Daily report NOT received — ${today}`

  const html = `
    <div style="font-family:system-ui,sans-serif;background:#080c14;color:#c9d1d9;padding:24px;max-width:600px;">
      <h1 style="font-size:20px;font-weight:500;color:#d29922;margin:0 0 8px;">Missing Report Alert</h1>
      <p style="color:#8b949e;margin:0 0 16px;font-size:13px;">${today}</p>

      <div style="background:#391e05;border:0.5px solid #d29922;border-radius:8px;padding:12px 16px;">
        <p style="margin:0;font-size:13px;color:#d29922;">
          The daily TableSpace Report was expected at 01:30 AM (GMT+3) but has not been received as of 02:00 AM.
        </p>
        <p style="margin:8px 0 0;font-size:11px;color:#8b949e;font-family:monospace;">
          Please check: Oracle scheduler, email forwarding rules, Gmail connectivity
        </p>
      </div>

      <p style="font-size:11px;color:#3d5068;font-family:monospace;margin-top:20px;">
        EM MONITOR Enterprise · Automated Alert
      </p>
    </div>
  `

  const to = await getAlertEmail()
  await resend.emails.send({
    from: process.env.ALERT_EMAIL_FROM || 'EM MONITOR <alerts@yourdomain.com>',
    to,
    subject,
    html,
  })
}

export async function sendBackupStatusAlert(data: {
  report_date: string
  failed_count: number
  delayed_count: number
  databases_count: number
}) {
  const subject = `⚠️ EM MONITOR: RMAN Backup Issues — ${data.report_date} (${data.failed_count} failed, ${data.delayed_count} delayed)`

  const html = `
    <div style="font-family:system-ui,sans-serif;background:#080c14;color:#c9d1d9;padding:24px;max-width:600px;">
      <h1 style="font-size:20px;font-weight:500;color:#d29922;margin:0 0 8px;">RMAN Backup Alert</h1>
      <p style="color:#8b949e;margin:0 0 16px;font-size:13px;">${data.report_date}</p>

      <div style="background:#391e05;border:0.5px solid #d29922;border-radius:8px;padding:12px 16px;margin-bottom:16px;">
        <p style="margin:0;font-size:13px;color:#d29922;">
          Backup report received but issues detected across ${data.databases_count} databases.
        </p>
      </div>

      <div style="background:#0e1421;border:0.5px solid #1a2640;border-radius:8px;padding:12px 16px;">
        <p style="margin:0 0 6px;font-size:13px;">
          <span style="font-family:monospace;color:#f85149;font-size:16px;font-weight:500;">${data.failed_count}</span>
          <span style="color:#8b949e;margin-left:6px;">failed</span>
        </p>
        <p style="margin:0;font-size:13px;">
          <span style="font-family:monospace;color:#d29922;font-size:16px;font-weight:500;">${data.delayed_count}</span>
          <span style="color:#8b949e;margin-left:6px;">delayed</span>
        </p>
      </div>

      <p style="font-size:11px;color:#3d5068;font-family:monospace;margin-top:20px;">
        EM MONITOR Enterprise · Automated Alert
      </p>
    </div>
  `

  const to = await getAlertEmail()
  await resend.emails.send({
    from: process.env.ALERT_EMAIL_FROM || 'EM MONITOR <alerts@yourdomain.com>',
    to,
    subject,
    html,
  })
}

export async function sendMissingBackupAlert(reportDate: string) {
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
