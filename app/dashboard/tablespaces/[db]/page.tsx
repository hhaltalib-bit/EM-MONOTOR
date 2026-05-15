'use client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TsCard } from '@/components/tablespace/TsCard'
import { TsFilters } from '@/components/tablespace/TsFilters'
import { SkeletonLoader } from '@/components/shared/SkeletonLoader'
import { StandardTablespace, DwhTablespace, DbRegistry } from '@/types'
import { getSeverity } from '@/lib/utils/severity'
import { useThresholds } from '@/contexts/ThresholdContext'

type AnyTablespace = StandardTablespace | DwhTablespace

function getPct(ts: AnyTablespace, schema: 'standard' | 'dwh'): number {
  return schema === 'standard'
    ? (ts as StandardTablespace).max_ts_pct_used
    : (ts as DwhTablespace).percent_used
}

function getAut(ts: AnyTablespace, schema: 'standard' | 'dwh'): string {
  return schema === 'standard' ? (ts as StandardTablespace).aut : 'YES'
}

function sortTablespaces(data: AnyTablespace[], schema: 'standard' | 'dwh'): AnyTablespace[] {
  return [...data].sort((a, b) => {
    const autA = getAut(a, schema)
    const autB = getAut(b, schema)
    if (autA !== autB) return autA === 'NO' ? -1 : 1
    return getPct(b, schema) - getPct(a, schema)
  })
}

export default function DbDetailPage() {
  const params = useParams()
  const dbKey = params.db as string
  const { warnThreshold, critThreshold } = useThresholds()

  const [loading, setLoading] = useState(true)
  const [registry, setRegistry] = useState<DbRegistry | null>(null)
  const [tablespaces, setTablespaces] = useState<AnyTablespace[]>([])
  const [growthMap, setGrowthMap] = useState<Map<string, number>>(new Map())
  const [sparklineMap, setSparklineMap] = useState<Map<string, number[]>>(new Map())
  const [search, setSearch] = useState('')
  const [autNoOnly, setAutNoOnly] = useState(false)
  const [reportDate, setReportDate] = useState('')
  const [healthyOpen, setHealthyOpen] = useState(true)

  const fetchData = useCallback(async (date: string, reg: DbRegistry) => {
    setLoading(true)
    const supabase = createClient()

    const schema = reg.schema_type
    const pctField = schema === 'standard' ? 'max_ts_pct_used' : 'percent_used'
    const usedField = schema === 'standard' ? 'used_ts_size' : 'gb_used'
    const tableName = reg.table_name

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tb = supabase.from(tableName) as any

    const { data: todayData } = await tb.select('*').eq('report_date', date)
    if (!todayData) { setLoading(false); return }

    const prevDate = new Date(new Date(date).getTime() - 86400000).toISOString().split('T')[0]
    const { data: prevData } = await tb
      .select(`tablespace_name, ${usedField}`)
      .eq('report_date', prevDate)

    const prevMap = new Map(
      ((prevData || []) as Record<string, unknown>[]).map(r => [
        r.tablespace_name as string,
        r[usedField] as number,
      ])
    )

    const gMap = new Map<string, number>()
    for (const ts of (todayData as Record<string, unknown>[])) {
      const name = ts.tablespace_name as string
      const todayUsed = ts[usedField] as number
      const prev = prevMap.get(name) ?? todayUsed
      gMap.set(name, Math.max(0, todayUsed - prev))
    }
    setGrowthMap(gMap)

    const sevenDayAgo = new Date(new Date(date).getTime() - 6 * 86400000).toISOString().split('T')[0]
    const { data: sparkData } = await tb
      .select(`tablespace_name, ${pctField}, report_date`)
      .gte('report_date', sevenDayAgo)
      .lte('report_date', date)
      .order('report_date', { ascending: true })

    const spMap = new Map<string, number[]>()
    for (const row of ((sparkData || []) as Record<string, unknown>[])) {
      const name = row.tablespace_name as string
      const val = row[pctField] as number
      if (!spMap.has(name)) spMap.set(name, [])
      spMap.get(name)!.push(val)
    }
    setSparklineMap(spMap)

    setTablespaces(sortTablespaces(todayData as AnyTablespace[], schema))
    setLoading(false)
  }, [])

  // On mount: resolve registry + latest date via API, then load data
  useEffect(() => {
    async function init() {
      const res = await fetch(`/api/db-info?db_key=${encodeURIComponent(dbKey)}`)
      if (!res.ok) { setLoading(false); return }
      const { registry: reg, latestDate } = await res.json() as { registry: DbRegistry; latestDate: string | null }

      setRegistry(reg)
      const date = latestDate ?? new Date().toISOString().split('T')[0]
      setReportDate(date)
      await fetchData(date, reg)
    }
    init()
  }, [dbKey, fetchData])

  const schema = registry?.schema_type || 'standard'

  const filtered = tablespaces.filter(ts => {
    const matchSearch = ts.tablespace_name.toLowerCase().includes(search.toLowerCase())
    const matchAut = autNoOnly ? getAut(ts, schema) === 'NO' : true
    return matchSearch && matchAut
  })

  const critical = filtered.filter(ts => getSeverity(getPct(ts, schema), warnThreshold, critThreshold) === 'critical')
  const warning  = filtered.filter(ts => getSeverity(getPct(ts, schema), warnThreshold, critThreshold) === 'warning')
  const healthy  = filtered.filter(ts => getSeverity(getPct(ts, schema), warnThreshold, critThreshold) === 'healthy')

  const totalCritical = tablespaces.filter(ts => getSeverity(getPct(ts, schema), warnThreshold, critThreshold) === 'critical').length
  const totalWarning  = tablespaces.filter(ts => getSeverity(getPct(ts, schema), warnThreshold, critThreshold) === 'warning').length
  const totalHealthy  = tablespaces.filter(ts => getSeverity(getPct(ts, schema), warnThreshold, critThreshold) === 'healthy').length

  const navDate = (delta: number) => {
    if (!reportDate || !registry) return
    const next = new Date(new Date(reportDate).getTime() + delta * 86400000).toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]
    if (next <= today) {
      setReportDate(next)
      fetchData(next, registry)
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ background: 'var(--bg3)', borderBottom: '0.5px solid var(--bdv)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ background: 'var(--Gd)', color: 'var(--Gv)', border: '0.5px solid var(--Gl)', padding: '3px 10px', borderRadius: '5px', fontSize: '12px', fontFamily: 'monospace', fontWeight: 500 }}>
          {registry?.db_name || dbKey.toUpperCase()}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--tx2)', fontFamily: 'monospace' }}>
          {totalCritical > 0 && <span style={{ color: 'var(--cr)', marginRight: '8px' }}>{totalCritical} CRITICAL</span>}
          {totalWarning > 0  && <span style={{ color: 'var(--wa)', marginRight: '8px' }}>{totalWarning} WARNING</span>}
          {totalCritical === 0 && totalWarning === 0 && <span style={{ color: 'var(--hl)' }}>ALL HEALTHY</span>}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => navDate(-1)} style={{ background: 'var(--bg4)', border: '0.5px solid var(--bdv)', borderRadius: '5px', padding: '4px 8px', cursor: 'pointer', color: 'var(--tx2)' }}>
            <i className="ti ti-chevron-left" style={{ fontSize: '12px' }} />
          </button>
          <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--txv)' }}>{reportDate}</span>
          <button onClick={() => navDate(1)} style={{ background: 'var(--bg4)', border: '0.5px solid var(--bdv)', borderRadius: '5px', padding: '4px 8px', cursor: 'pointer', color: 'var(--tx2)' }}>
            <i className="ti ti-chevron-right" style={{ fontSize: '12px' }} />
          </button>
        </div>
      </div>

      <TsFilters search={search} onSearch={setSearch} autNoOnly={autNoOnly} onAutToggle={() => setAutNoOnly(!autNoOnly)} />

      {/* Summary bar */}
      <div style={{ display: 'flex', gap: '8px', padding: '8px 16px', background: 'var(--bg)', borderBottom: '0.5px solid var(--bdv)', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: 'var(--tx2)', fontFamily: 'monospace' }}>{tablespaces.length} tablespaces</span>
        {totalCritical > 0 && <span style={{ fontSize: '11px', color: 'var(--cr)', background: 'var(--crb)', padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace' }}>{totalCritical} critical</span>}
        {totalWarning  > 0 && <span style={{ fontSize: '11px', color: 'var(--wa)', background: 'var(--wab)', padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace' }}>{totalWarning} warning</span>}
        <span style={{ fontSize: '11px', color: 'var(--hl)', background: 'var(--hlb)', padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace' }}>{totalHealthy} healthy</span>
      </div>

      <div style={{ padding: '12px 16px' }}>
        {loading ? (
          <SkeletonLoader count={6} />
        ) : (
          <>
            {critical.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '9px', color: 'var(--cr)', textTransform: 'uppercase', letterSpacing: '0.7px', fontFamily: 'monospace', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  critical — immediate action (&gt;{critThreshold}%)
                  <span style={{ background: 'var(--crb)', color: 'var(--cr)', padding: '1px 6px', borderRadius: '4px', fontSize: '10px' }}>{critical.length}</span>
                </div>
                {critical.map((ts, i) => (
                  <TsCard key={ts.tablespace_name} ts={ts} schemaType={schema} growthGb={growthMap.get(ts.tablespace_name) || 0} sparklineData={sparklineMap.get(ts.tablespace_name) || []} index={i} reportDate={reportDate} />
                ))}
              </div>
            )}

            {warning.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '9px', color: 'var(--wa)', textTransform: 'uppercase', letterSpacing: '0.7px', fontFamily: 'monospace', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  warning — monitor closely ({warnThreshold}–{critThreshold - 1}%)
                  <span style={{ background: 'var(--wab)', color: 'var(--wa)', padding: '1px 6px', borderRadius: '4px', fontSize: '10px' }}>{warning.length}</span>
                </div>
                {warning.map((ts, i) => (
                  <TsCard key={ts.tablespace_name} ts={ts} schemaType={schema} growthGb={growthMap.get(ts.tablespace_name) || 0} sparklineData={sparklineMap.get(ts.tablespace_name) || []} index={i} reportDate={reportDate} />
                ))}
              </div>
            )}

            {healthy.length > 0 && (
              <div style={{ border: '0.5px solid var(--Gl)', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ background: 'var(--hlb)', padding: '7px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setHealthyOpen(!healthyOpen)}>
                  <span style={{ fontSize: '9px', fontWeight: 500, color: 'var(--hl)', textTransform: 'uppercase', letterSpacing: '0.7px', fontFamily: 'monospace' }}>
                    healthy — no action required (&lt;{warnThreshold}%)
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--hl)', fontFamily: 'monospace' }}>{healthy.length} tablespaces</span>
                    <i className={`ti ${healthyOpen ? 'ti-chevron-up' : 'ti-chevron-down'}`} style={{ fontSize: '12px', color: 'var(--hl)' }} />
                  </div>
                </div>
                {healthyOpen && (
                  <div style={{ padding: '9px', background: 'var(--bg)' }}>
                    <div className="g2">
                      {healthy.map((ts, i) => (
                        <TsCard key={ts.tablespace_name} ts={ts} schemaType={schema} growthGb={growthMap.get(ts.tablespace_name) || 0} sparklineData={sparklineMap.get(ts.tablespace_name) || []} index={i} reportDate={reportDate} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--tx3)', fontFamily: 'monospace' }}>
                No tablespaces match your filter
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

