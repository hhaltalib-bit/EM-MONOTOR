export const metadata = { title: 'EM Monitor — Tablespaces' }

import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { DatabaseSummary, DbRegistry } from '@/types'
import { getSeverity } from '@/lib/utils/severity'
import { StatusDot } from '@/components/shared/StatusDot'
import { RingChart } from '@/components/dashboard/RingChart'

async function getAllDatabases(): Promise<DatabaseSummary[]> {
  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: latestRow } = await (supabase.from('raid_ts') as any)
    .select('report_date')
    .order('report_date', { ascending: false })
    .limit(1)
    .single()
  const today = latestRow?.report_date ?? new Date().toISOString().split('T')[0]

  const { data: registries } = await supabase
    .from('db_registry')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  if (!registries) return []

  const databases: DatabaseSummary[] = []

  for (const reg of registries as DbRegistry[]) {
    try {
      const pctField = reg.schema_type === 'standard' ? 'max_ts_pct_used' : 'percent_used'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from(reg.table_name) as any)
        .select(pctField)
        .eq('report_date', today)

      if (!data || data.length === 0) {
        databases.push({ key: reg.db_key, name: reg.db_name, table_name: reg.table_name, schema_type: reg.schema_type, worst_pct: 0, severity: 'healthy', critical_count: 0, warning_count: 0, healthy_count: 0, total_tablespaces: 0})
        continue
      }

      const pcts = (data as Record<string, number>[]).map(r => r[pctField])
      const worst = Math.max(...pcts)

      databases.push({
        key: reg.db_key, name: reg.db_name, table_name: reg.table_name,
        schema_type: reg.schema_type, worst_pct: worst, severity: getSeverity(worst),
        critical_count: pcts.filter(p => p >= 90).length,
        warning_count: pcts.filter(p => p >= 80 && p < 90).length,
        healthy_count: pcts.filter(p => p < 80).length,
        total_tablespaces: pcts.length,
      })
    } catch {
      databases.push({ key: reg.db_key, name: reg.db_name, table_name: reg.table_name, schema_type: reg.schema_type, worst_pct: 0, severity: 'healthy', critical_count: 0, warning_count: 0, healthy_count: 0, total_tablespaces: 0})
    }
  }

  return databases
}

export default async function TablespacesPage() {
  const databases = await getAllDatabases()

  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{ fontSize: '9px', color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '12px', fontFamily: 'monospace' }}>
        Select a database to view tablespace report
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' }}>
        {databases.map((db, i) => (
          <Link key={db.key} href={`/dashboard/tablespaces/${db.key}`} style={{ textDecoration: 'none' }}>
            <div className="dc" style={{ animationDelay: `${i * 0.025}s`, padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                  <StatusDot severity={db.severity} />
                  <span style={{ fontSize: '13px', color: 'var(--txv)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {db.name}
                  </span>
                </div>
                <RingChart pct={db.worst_pct} severity={db.severity} />
              </div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>
                {db.critical_count > 0 && <span className="tg" style={{ background: 'var(--crb)', color: 'var(--cr)' }}>{db.critical_count} critical</span>}
                {db.warning_count > 0  && <span className="tg" style={{ background: 'var(--wab)', color: 'var(--wa)' }}>{db.warning_count} warning</span>}
                {db.critical_count === 0 && db.warning_count === 0 && <span className="tg" style={{ background: 'var(--hlb)', color: 'var(--hl)' }}>all healthy</span>}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--tx3)', fontFamily: 'monospace' }}>
                {db.total_tablespaces} tablespaces Â· peak {db.worst_pct.toFixed(1)}%
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

