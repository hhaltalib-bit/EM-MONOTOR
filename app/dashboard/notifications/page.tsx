export const dynamic = 'force-dynamic'
export const revalidate = 0

import { createServiceClient } from '@/lib/supabase/server'
import { DbRegistry } from '@/types'

interface AlertEntry {
  db_name: string
  tablespace_name: string
  pct: number
  severity: 'critical' | 'warning'
}

async function getLatestReportDate(): Promise<string> {
  try {
    const supabase = createServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('raid_ts') as any)
      .select('report_date')
      .order('report_date', { ascending: false })
      .limit(1)
      .single()
    return data?.report_date ?? new Date().toISOString().split('T')[0]
  } catch {
    return new Date().toISOString().split('T')[0]
  }
}

async function getAlerts(): Promise<{ alerts: AlertEntry[]; reportDate: string }> {
  const supabase = createServiceClient()

  const reportDate = await getLatestReportDate()

  const { data: registries } = await supabase
    .from('db_registry')
    .select('*')
    .eq('is_active', true)

  if (!registries?.length) return { alerts: [], reportDate }

  const results = await Promise.all(
    (registries as DbRegistry[]).map(async (reg) => {
      const pctField = reg.schema_type === 'standard' ? 'max_ts_pct_used' : 'percent_used'
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase.from(reg.table_name) as any)
          .select(`tablespace_name, ${pctField}`)
          .eq('report_date', reportDate)
          .gte(pctField, 80)
        if (!data?.length) return [] as AlertEntry[]
        return (data as Record<string, unknown>[]).map(row => ({
          db_name: reg.db_name,
          tablespace_name: row.tablespace_name as string,
          pct: row[pctField] as number,
          severity: ((row[pctField] as number) >= 90 ? 'critical' : 'warning') as 'critical' | 'warning',
        }))
      } catch {
        return [] as AlertEntry[]
      }
    })
  )

  const alerts = results.flat()
  alerts.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1
    return b.pct - a.pct
  })

  return { alerts, reportDate }
}

export default async function NotificationsPage() {
  const { alerts, reportDate } = await getAlerts()

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
              <div
                key={`${item.db_name}-${item.tablespace_name}`}
                style={{
                  display: 'flex', gap: '12px', padding: '10px 16px',
                  borderBottom: i < alerts.length - 1 ? '0.5px solid var(--bdv)' : undefined,
                  animation: `slideUp 0.3s ${i * 0.03}s ease-out both`,
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
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
