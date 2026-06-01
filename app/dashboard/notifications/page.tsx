export const dynamic = 'force-dynamic'
export const revalidate = 0

import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { DbRegistry } from '@/types'
import { getLatestReportDate } from '@/lib/utils/getLatestReportDate'
import { getThresholds } from '@/lib/utils/getThresholds'
import { safeFrom } from '@/lib/db/safeTable'

interface AlertEntry {
  db_key: string
  db_name: string
  tablespace_name: string
  pct: number
  severity: 'critical' | 'warning'
}

interface HistoryEntry {
  report_date: string
  type: 'TS_INGEST' | 'BACKUP'
  count: number | null
  status: string
}

async function getAlerts(): Promise<{ alerts: AlertEntry[]; reportDate: string; history: HistoryEntry[] }> {
  const supabase = createServiceClient()
  const thresholds = await getThresholds()

  const reportDate = await getLatestReportDate()

  const [{ data: registries }, { data: tsLogs }, { data: backupLogs }] = await Promise.all([
    supabase.from('db_registry').select('*').eq('is_active', true),
    supabase.from('report_log').select('report_date, status, databases_processed').order('report_date', { ascending: false }).limit(30),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('backup_report_log') as any).select('report_date, status, databases_count').order('report_date', { ascending: false }).limit(30),
  ])

  if (!reportDate) return { alerts: [], reportDate: '', history: [] }
  if (!registries?.length) return { alerts: [], reportDate, history: [] }

  const results = await Promise.all(
    (registries as DbRegistry[]).map(async (reg) => {
      const pctField = reg.schema_type === 'standard' ? 'max_ts_pct_used' : 'percent_used'
      try {
        const { data } = await safeFrom(supabase, reg.table_name)
          .select(`tablespace_name, ${pctField}`)
          .eq('report_date', reportDate)
          .gte(pctField, thresholds.warn)
        if (!data?.length) return [] as AlertEntry[]
        return (data as Record<string, unknown>[]).map(row => ({
          db_key: reg.db_key,
          db_name: reg.db_name,
          tablespace_name: row.tablespace_name as string,
          pct: row[pctField] as number,
          severity: ((row[pctField] as number) >= thresholds.crit ? 'critical' : 'warning') as 'critical' | 'warning',
        }))
      } catch (err) {
        console.error(`[notifications] failed to fetch alerts for ${reg.db_key}:`, err)
        return [] as AlertEntry[]
      }
    })
  )

  const alerts = results.flat()
  alerts.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1
    return b.pct - a.pct
  })

  const tsHistory: HistoryEntry[] = (tsLogs ?? []).map((r: Record<string, unknown>) => ({
    report_date: r.report_date as string,
    type: 'TS_INGEST' as const,
    count: (r.databases_processed as number | null) ?? null,
    status: r.status as string,
  }))

  const backupHistory: HistoryEntry[] = (backupLogs ?? []).map((r: Record<string, unknown>) => ({
    report_date: r.report_date as string,
    type: 'BACKUP' as const,
    count: (r.databases_count as number | null) ?? null,
    status: r.status as string,
  }))

  const history = [...tsHistory, ...backupHistory]
    .sort((a, b) => b.report_date.localeCompare(a.report_date))
    .slice(0, 30)

  return { alerts, reportDate, history }
}

export default async function NotificationsPage() {
  const { alerts, reportDate, history } = await getAlerts()

  const critCount = alerts.filter(a => a.severity === 'critical').length
  const warnCount = alerts.filter(a => a.severity === 'warning').length

  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--bdv)', borderRadius: '8px', overflow: 'hidden', animation: 'popIn 0.3s ease-out both' }}>
        <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--bdv)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="ti ti-bell" style={{ fontSize: '14px', color: 'var(--tx2)' }} />
          <span style={{ fontSize: '9px', color: 'var(--tx2)', textTransform: 'uppercase', letterSpacing: '0.7px', fontFamily: 'monospace', fontWeight: 500 }}>
            Tablespace Alerts · {reportDate}
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
            {critCount > 0 && (
              <span style={{ fontSize: '10px', color: 'var(--cr)', fontFamily: 'monospace' }}>{critCount} critical</span>
            )}
            {warnCount > 0 && (
              <span style={{ fontSize: '10px', color: 'var(--wa)', fontFamily: 'monospace' }}>{warnCount} warning</span>
            )}
            {alerts.length === 0 && (
              <span style={{ fontSize: '10px', color: 'var(--tx3)', fontFamily: 'monospace' }}>0 entries</span>
            )}
          </span>
        </div>

        <div style={{ padding: '8px 0' }}>
          {alerts.length === 0 && (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--tx3)', fontFamily: 'monospace', fontSize: '12px' }}>
              No notifications yet
            </div>
          )}
          {alerts.map((item, i) => {
            const isCritical = item.severity === 'critical'
            const color = isCritical ? 'var(--cr)' : 'var(--wa)'
            const bg = isCritical ? 'var(--crb)' : 'var(--wab)'
            const label = isCritical ? 'CRITICAL' : 'WARNING'
            const icon = isCritical ? 'ti-alert-circle' : 'ti-alert-triangle'

            return (
              <Link
                key={`${item.db_name}-${item.tablespace_name}`}
                href={`/dashboard/tablespaces/${item.db_key}`}
                style={{
                  display: 'flex', gap: '12px', padding: '10px 16px', textDecoration: 'none',
                  borderBottom: i < alerts.length - 1 ? '0.5px solid var(--bdv)' : undefined,
                  animation: `slideUp 0.3s ${i * 0.03}s ease-out both`,
                  cursor: 'pointer',
                }}
              >
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className={`ti ${icon}`} style={{ fontSize: '13px', color }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', color: 'var(--txv)', marginBottom: '2px' }}>
                    {item.db_name} — {item.tablespace_name} at {item.pct.toFixed(2)}% ({label})
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--tx3)', fontFamily: 'monospace' }}>
                    Report date: {reportDate}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color, fontFamily: 'monospace' }}>
                    {item.pct.toFixed(2)}%
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* System log history */}
      {history.length > 0 && (
        <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--bdv)', borderRadius: '8px', overflow: 'hidden', marginTop: '12px', animation: 'slideUp 0.4s 0.15s both' }}>
          <div style={{ padding: '10px 16px', borderBottom: '0.5px solid var(--bdv)', fontSize: '9px', color: 'var(--tx2)', textTransform: 'uppercase', letterSpacing: '0.7px', fontFamily: 'monospace', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '5px' }}>
            <i className="ti ti-history" style={{ fontSize: '13px', color: 'var(--tx3)' }} />
            System Log · Last 30 entries
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontFamily: 'monospace' }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid var(--bdv)' }}>
                  {['Date', 'Type', 'Count', 'Status'].map(h => (
                    <th key={h} style={{ padding: '6px 16px', textAlign: 'left', fontSize: '9px', color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((row, i) => {
                  const isOk = row.status === 'success'
                  const statusColor = isOk ? 'var(--hl)' : 'var(--cr)'
                  const statusBg = isOk ? 'var(--hlb)' : 'var(--crb)'
                  return (
                    <tr key={`${row.type}-${row.report_date}-${i}`} style={{ borderBottom: i < history.length - 1 ? '0.5px solid var(--bg4)' : undefined }}>
                      <td style={{ padding: '7px 16px', color: 'var(--txv)' }}>{row.report_date}</td>
                      <td style={{ padding: '7px 16px', color: 'var(--tx2)' }}>{row.type}</td>
                      <td style={{ padding: '7px 16px', color: 'var(--tx3)' }}>{row.count ?? '—'}</td>
                      <td style={{ padding: '7px 16px' }}>
                        <span style={{ background: statusBg, color: statusColor, borderRadius: '3px', padding: '1px 6px', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
