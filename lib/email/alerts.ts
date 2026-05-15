import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

interface CriticalAlertData {
  report_date: string
  critical_total: number
  warning_total: number
  databases: Array<{
    name: string
    critical_count: number
    warning_count: number
    critical_tablespaces: Array<{ name: string; pct: number }>
  }>
}

export async function sendCriticalAlert(data: CriticalAlertData) {
  const subject = `🔴 EM MONITOR: ${data.critical_total} Critical in ${data.databases.filter(d => d.critical_count > 0).length} databases — ${data.report_date}`

  const dbBreakdown = data.databases
    .filter(d => d.critical_count > 0 || d.warning_count > 0)
    .map(db => {
      const lines = [`<strong>${db.name}</strong>:`]
      if (db.critical_count > 0) lines.push(`&nbsp;&nbsp;${db.critical_count} critical`)
      if (db.warning_count > 0) lines.push(`&nbsp;&nbsp;${db.warning_count} warning`)
      return lines.join('<br>')
    })
    .join('<br><br>')

  const criticalList = data.databases
    .flatMap(db =>
      db.critical_tablespaces.map(ts => ({
        db: db.name,
        name: ts.name,
        pct: ts.pct,
      }))
    )
    .sort((a, b) => b.pct - a.pct)
    .map(
      ts =>
        `<tr>
          <td style="padding:4px 8px;font-family:monospace;color:#f85149;">${ts.name}</td>
          <td style="padding:4px 8px;color:#8b949e;">${ts.db}</td>
          <td style="padding:4px 8px;font-family:monospace;color:#f85149;font-weight:500;">${ts.pct.toFixed(2)}%</td>
        </tr>`
    )
    .join('')

  const html = `
    <div style="font-family:system-ui,sans-serif;background:#080c14;color:#c9d1d9;padding:24px;max-width:600px;">
      <div style="margin-bottom:20px;">
        <h1 style="font-size:20px;font-weight:500;color:#f85149;margin:0;">EM MONITOR — Critical Alert</h1>
        <p style="color:#8b949e;margin:4px 0 0;font-size:13px;">${data.report_date}</p>
      </div>

      <div style="background:#3b0d0d;border:0.5px solid #f85149;border-radius:8px;padding:12px 16px;margin-bottom:16px;">
        <span style="color:#f85149;font-size:20px;font-weight:500;font-family:monospace;">${data.critical_total}</span>
        <span style="color:#8b949e;font-size:13px;margin-left:8px;">critical tablespaces</span>
        <br>
        <span style="color:#d29922;font-size:16px;font-weight:500;font-family:monospace;">${data.warning_total}</span>
        <span style="color:#8b949e;font-size:13px;margin-left:8px;">warning tablespaces</span>
      </div>

      <div style="background:#0e1421;border:0.5px solid #1a2640;border-radius:8px;padding:12px 16px;margin-bottom:16px;">
        <p style="font-size:9px;color:#3d5068;text-transform:uppercase;letter-spacing:0.7px;font-family:monospace;margin:0 0 8px;">Per Database</p>
        <p style="margin:0;line-height:2;font-size:13px;">${dbBreakdown}</p>
      </div>

      <div style="background:#0e1421;border:0.5px solid #1a2640;border-radius:8px;overflow:hidden;">
        <p style="font-size:9px;color:#3d5068;text-transform:uppercase;letter-spacing:0.7px;font-family:monospace;margin:12px 16px 8px;">Critical Tablespaces</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr style="background:#131c2e;">
            <th style="padding:4px 8px;text-align:left;font-size:9px;color:#3d5068;font-family:monospace;text-transform:uppercase;">Tablespace</th>
            <th style="padding:4px 8px;text-align:left;font-size:9px;color:#3d5068;font-family:monospace;text-transform:uppercase;">Database</th>
            <th style="padding:4px 8px;text-align:left;font-size:9px;color:#3d5068;font-family:monospace;text-transform:uppercase;">Usage</th>
          </tr>
          ${criticalList}
        </table>
      </div>

      <p style="font-size:11px;color:#3d5068;font-family:monospace;margin-top:20px;">
        EM MONITOR Enterprise · Automated Alert
      </p>
    </div>
  `

  await resend.emails.send({
    from: process.env.ALERT_EMAIL_FROM || 'EM MONITOR <alerts@yourdomain.com>',
    to: process.env.ALERT_EMAIL_TO || 'hassan.haider@onyxes.com',
    subject,
    html,
  })
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

  await resend.emails.send({
    from: process.env.ALERT_EMAIL_FROM || 'EM MONITOR <alerts@yourdomain.com>',
    to: process.env.ALERT_EMAIL_TO || 'hassan.haider@onyxes.com',
    subject,
    html,
  })
}
