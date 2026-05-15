export const dynamic = 'force-dynamic'
export const revalidate = 0

import { createServiceClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/dashboard/StatCard'
import { DbCard } from '@/components/dashboard/DbCard'
import { DatabaseSummary, DbRegistry, TopGrowing } from '@/types'
import { getSeverity } from '@/lib/utils/severity'
import { sortDatabases } from '@/lib/utils/sort'

interface RecentAlert {
  db_name: string
  tablespace_name: string
  pct: number
  report_date: string
}

async function getOverviewData() {
  const supabase = createServiceClient()

  // Use the most recent report date that has data, not necessarily today
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: latestRow } = await (supabase.from('raid_ts') as any)
    .select('report_date')
    .order('report_date', { ascending: false })
    .limit(1)
    .single()
  const today = latestRow?.report_date ?? new Date().toISOString().split('T')[0]
  const yesterday = new Date(new Date(today).getTime() - 86400000).toISOString().split('T')[0]

  const { data: registries } = await supabase
    .from('db_registry')
    .select('*')
    .eq('is_active', true)

  if (!registries?.length) {
    return { databases: [], topGrowing: [], recentAlerts: [] as RecentAlert[], isLargestMode: false }
  }

  // Fan out all per-DB queries in parallel
  const results = await Promise.all(
    (registries as DbRegistry[]).map(async (reg) => {
      const emptySummary: DatabaseSummary = {
        key: reg.db_key, name: reg.db_name, table_name: reg.table_name,
        schema_type: reg.schema_type, worst_pct: 0, severity: 'healthy',
        critical_count: 0, warning_count: 0, healthy_count: 0, total_tablespaces: 0,
      }
      const empty = {
        summary: emptySummary,
        growing: [] as TopGrowing[],
        largest: [] as TopGrowing[],
        criticals: [] as RecentAlert[],
      }
      try {
        const pctField = reg.schema_type === 'standard' ? 'max_ts_pct_used' : 'percent_used'
        const usedField = reg.schema_type === 'standard' ? 'used_ts_size' : 'gb_used'

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tb = supabase.from(reg.table_name) as any
        const [{ data: todayData }, { data: prevData }] = await Promise.all([
          tb.select(`tablespace_name, ${pctField}, ${usedField}`).eq('report_date', today),
          tb.select(`tablespace_name, ${usedField}`).eq('report_date', yesterday),
        ])

        if (!todayData?.length) return empty

        const pcts = (todayData as Record<string, number>[]).map(r => r[pctField])
        const worst = Math.max(...pcts)

        const summary: DatabaseSummary = {
          key: reg.db_key, name: reg.db_name, table_name: reg.table_name,
          schema_type: reg.schema_type, worst_pct: worst, severity: getSeverity(worst),
          critical_count: pcts.filter(p => p >= 90).length,
          warning_count: pcts.filter(p => p >= 80 && p < 90).length,
          healthy_count: pcts.filter(p => p < 80).length,
          total_tablespaces: pcts.length,
        }

        // Largest tablespaces by current used size (fallback when no growth data)
        const largest: TopGrowing[] = (todayData as Record<string, unknown>[]).map(row => ({
          db_key: reg.db_key,
          db_name: reg.db_name,
          tablespace_name: row.tablespace_name as string,
          growth_gb: row[usedField] as number,
          current_pct: row[pctField] as number,
        }))

        // Critical tablespaces for Recent Alerts panel
        const criticals: RecentAlert[] = (todayData as Record<string, unknown>[])
          .filter(row => (row[pctField] as number) >= 90)
          .map(row => ({
            db_name: reg.db_name,
            tablespace_name: row.tablespace_name as string,
            pct: row[pctField] as number,
            report_date: today,
          }))

        const growing: TopGrowing[] = []
        if (prevData) {
          const prevMap = new Map(
            (prevData as Record<string, unknown>[]).map(r => [
              r.tablespace_name as string,
              r[usedField] as number,
            ])
          )
          for (const row of todayData as Record<string, unknown>[]) {
            const name = row.tablespace_name as string
            const todayUsed = row[usedField] as number
            const prev = prevMap.get(name) ?? todayUsed
            const growth = Math.max(0, todayUsed - prev)
            if (growth > 0.1) {
              growing.push({
                db_key: reg.db_key, db_name: reg.db_name,
                tablespace_name: name, growth_gb: growth,
                current_pct: row[pctField] as number,
              })
            }
          }
        }

        return { summary, growing, largest, criticals }
      } catch {
        return empty
      }
    })
  )

  const databases = sortDatabases(results.map(r => r.summary))

  const topGrowingAll = results.flatMap(r => r.growing)
  topGrowingAll.sort((a, b) => b.growth_gb - a.growth_gb)

  // If no growth data (e.g. no yesterday data), fall back to top 5 by current size
  let topGrowing: TopGrowing[]
  let isLargestMode = false
  if (topGrowingAll.length > 0) {
    topGrowing = topGrowingAll.slice(0, 5)
  } else {
    isLargestMode = true
    const allLargest = results.flatMap(r => r.largest)
    allLargest.sort((a, b) => b.growth_gb - a.growth_gb)
    topGrowing = allLargest.slice(0, 5)
  }

  const allCriticals = results.flatMap(r => r.criticals)
  allCriticals.sort((a, b) => b.pct - a.pct)

  return {
    databases,
    topGrowing,
    isLargestMode,
    recentAlerts: allCriticals.slice(0, 4),
  }
}

export default async function DashboardPage() {
  const { databases, topGrowing, recentAlerts, isLargestMode } = await getOverviewData()

  const criticalDbs = databases.filter(d => d.severity === 'critical')
  const warningDbs  = databases.filter(d => d.severity === 'warning')
  const healthyDbs  = databases.filter(d => d.severity === 'healthy')
  const totalCriticalTs = databases.reduce((s, d) => s + d.critical_count, 0)
  const totalWarningTs  = databases.reduce((s, d) => s + d.warning_count, 0)

  return (
    <div style={{ padding: '12px 16px' }}>
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px', marginBottom: '12px' }}>
        <StatCard label="Critical DBs"  value={criticalDbs.length}     subtitle={`${totalCriticalTs} tablespaces`} icon="ti-alert-circle"   severity="critical" delay={0} />
        <StatCard label="Warning DBs"   value={warningDbs.length}      subtitle={`${totalWarningTs} tablespaces`}  icon="ti-alert-triangle" severity="warning"  delay={0.07} />
        <StatCard label="Healthy DBs"   value={healthyDbs.length}      subtitle="No action needed"                  icon="ti-circle-check"   severity="healthy"  delay={0.14} />
        <StatCard label="Total DBs"     value={databases.length || 20} subtitle="All monitored"                    icon="ti-database"       severity="healthy"  delay={0.21} />
      </div>

      {/* Grid + right panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 196px', gap: '11px' }}>
        <div>
          <div style={{ fontSize: '9px', color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '8px', fontFamily: 'monospace' }}>
            All {databases.length} databases — click to open report
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px' }}>
            {databases.map((db, i) => <DbCard key={db.key} db={db} index={i} />)}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
          {/* Top Growing / Largest Tablespaces */}
          <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--bdv)', borderRadius: '8px', padding: '10px', animation: 'slideUp 0.4s 0.1s both' }}>
            <div style={{ fontSize: '9px', color: 'var(--tx2)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '8px', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <i className="ti ti-trending-up" style={{ fontSize: '13px', color: 'var(--wa)' }} />
              {isLargestMode ? 'Largest Tablespaces' : 'Top Growing'}
            </div>
            {topGrowing.length === 0 && (
              <div style={{ fontSize: '10px', color: 'var(--tx3)', fontFamily: 'monospace' }}>No data</div>
            )}
            {topGrowing.map((item, i) => (
              <div key={`${item.db_key}-${item.tablespace_name}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < topGrowing.length - 1 ? '0.5px solid var(--bg4)' : undefined }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--txv)', fontFamily: 'monospace' }}>
                    {item.tablespace_name.length > 12 ? item.tablespace_name.slice(0, 12) + '…' : item.tablespace_name}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--tx3)' }}>{item.db_name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--cr)', fontFamily: 'monospace' }}>
                    {isLargestMode ? `${item.growth_gb.toFixed(1)}GB` : `+${item.growth_gb.toFixed(1)}GB`}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--tx3)', fontFamily: 'monospace' }}>{item.current_pct.toFixed(1)}%</div>
                </div>
              </div>
            ))}
          </div>

          {/* Recent Alerts */}
          <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--bdv)', borderRadius: '8px', padding: '10px', animation: 'slideUp 0.4s 0.2s both', flex: 1 }}>
            <div style={{ fontSize: '9px', color: 'var(--tx2)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '8px', fontFamily: 'monospace', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <i className="ti ti-bell" style={{ fontSize: '13px' }} />
                Recent Alerts
              </span>
              <a href="/dashboard/notifications" style={{ fontSize: '10px', color: 'var(--Gv)', cursor: 'pointer', textDecoration: 'none' }}>all →</a>
            </div>
            {recentAlerts.length === 0 && (
              <div style={{ fontSize: '10px', color: 'var(--tx3)', fontFamily: 'monospace' }}>No alerts</div>
            )}
            {recentAlerts.map((alert, i) => (
              <div
                key={`${alert.db_name}-${alert.tablespace_name}`}
                style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '5px 0', borderBottom: i < recentAlerts.length - 1 ? '0.5px solid var(--bg4)' : undefined }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--cr)', flexShrink: 0, marginTop: '3px', display: 'inline-block' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '11px', color: 'var(--txv)', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {alert.db_name}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--tx3)', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {alert.tablespace_name}
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--tx3)', fontFamily: 'monospace' }}>{alert.report_date}</div>
                </div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--cr)', fontFamily: 'monospace', flexShrink: 0 }}>
                  {alert.pct.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
