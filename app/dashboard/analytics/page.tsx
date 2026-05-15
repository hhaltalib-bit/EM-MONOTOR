'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LineChart } from '@/components/analytics/LineChart'
import { getSeverity } from '@/lib/utils/severity'
import { useThresholds } from '@/contexts/ThresholdContext'
import { DbRegistry } from '@/types'

interface ChartPoint {
  date: string
  value: number
}

const RANGES = [
  { label: 'Last 7 days',  days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
]

const selectStyle: React.CSSProperties = {
  background: 'var(--bg2)',
  border: '0.5px solid var(--bdv)',
  borderRadius: '6px',
  padding: '6px 10px',
  color: 'var(--txv)',
  fontSize: '12px',
  fontFamily: 'monospace',
  cursor: 'pointer',
  outline: 'none',
}

export default function AnalyticsPage() {
  const { warnThreshold, critThreshold } = useThresholds()
  const [databases, setDatabases] = useState<DbRegistry[]>([])
  const [tablespaces, setTablespaces] = useState<string[]>([])
  const [chartData, setChartData] = useState<ChartPoint[]>([])
  const [selectedDb, setSelectedDb] = useState('')
  const [selectedTs, setSelectedTs] = useState('')
  const [selectedRange, setSelectedRange] = useState(30)
  const [selectedReg, setSelectedReg] = useState<DbRegistry | null>(null)
  const [latestDate, setLatestDate] = useState('')
  const [loadingTs, setLoadingTs] = useState(false)
  const [loadingChart, setLoadingChart] = useState(false)

  // Load all databases via API on mount (bypasses RLS)
  useEffect(() => {
    fetch('/api/db-list')
      .then(r => r.json())
      .then(({ databases: dbs }: { databases: DbRegistry[] }) => {
        if (dbs?.length) {
          setDatabases(dbs)
          setSelectedDb(dbs[0].db_key)
        }
      })
      .catch(() => {})
  }, [])

  // When db changes: get registry + latest date, then tablespace names
  useEffect(() => {
    if (!selectedDb) return
    setLoadingTs(true)
    setTablespaces([])
    setSelectedTs('')
    setChartData([])
    setLatestDate('')

    fetch(`/api/db-info?db_key=${encodeURIComponent(selectedDb)}`)
      .then(r => r.json())
      .then(({ registry: reg, latestDate: ld }: { registry: DbRegistry; latestDate: string | null }) => {
        if (!reg || !ld) { setLoadingTs(false); return }
        setSelectedReg(reg)
        setLatestDate(ld)

        const supabase = createClient()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(supabase.from(reg.table_name) as any)
          .select('tablespace_name')
          .eq('report_date', ld)
          .order('tablespace_name')
          .then(({ data }: { data: { tablespace_name: string }[] | null }) => {
            const names = (data ?? []).map(r => r.tablespace_name)
            setTablespaces(names)
            if (names.length > 0) setSelectedTs(names[0])
            setLoadingTs(false)
          })
      })
      .catch(() => setLoadingTs(false))
  }, [selectedDb])

  // Fetch chart data when ts, range, or reg changes
  const fetchChart = useCallback(() => {
    if (!selectedTs || !selectedReg || !latestDate) return
    setLoadingChart(true)

    const usedField = selectedReg.schema_type === 'standard' ? 'max_ts_pct_used' : 'percent_used'
    const toDate = latestDate
    const fromDate = new Date(new Date(latestDate).getTime() - selectedRange * 86400000).toISOString().split('T')[0]

    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase.from(selectedReg.table_name) as any)
      .select(`report_date, ${usedField}`)
      .eq('tablespace_name', selectedTs)
      .gte('report_date', fromDate)
      .lte('report_date', toDate)
      .order('report_date', { ascending: true })
      .then(({ data }: { data: Record<string, unknown>[] | null }) => {
        setChartData((data ?? []).map(r => ({
          date: r.report_date as string,
          value: r[usedField] as number,
        })))
        setLoadingChart(false)
      })
      .catch(() => setLoadingChart(false))
  }, [selectedTs, selectedRange, selectedReg, latestDate])

  useEffect(() => { fetchChart() }, [fetchChart])

  const currentValue = chartData.length > 0 ? chartData[chartData.length - 1].value : 0
  const currentSeverity = getSeverity(currentValue, warnThreshold, critThreshold)
  const sevColor =
    currentSeverity === 'critical' ? 'var(--cr)' :
    currentSeverity === 'warning'  ? 'var(--wa)' : 'var(--hl)'
  const last7 = chartData.slice(-7)

  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: '12px' }}>

        {/* Chart panel */}
        <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--bdv)', borderRadius: '8px', padding: '14px', animation: 'popIn 0.3s ease-out both' }}>
          {/* Selectors */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
            <select style={selectStyle} value={selectedDb} onChange={e => setSelectedDb(e.target.value)}>
              {databases.length === 0 && <option value="">Loading…</option>}
              {databases.map(db => (
                <option key={db.db_key} value={db.db_key}>{db.db_name}</option>
              ))}
            </select>

            <select
              style={{ ...selectStyle, opacity: loadingTs || tablespaces.length === 0 ? 0.5 : 1 }}
              value={selectedTs}
              onChange={e => setSelectedTs(e.target.value)}
              disabled={loadingTs || tablespaces.length === 0}
            >
              {loadingTs && <option value="">Loading tablespaces…</option>}
              {!loadingTs && tablespaces.length === 0 && <option value="">No data available</option>}
              {tablespaces.map(ts => (
                <option key={ts} value={ts}>{ts}</option>
              ))}
            </select>

            <select style={selectStyle} value={selectedRange} onChange={e => setSelectedRange(Number(e.target.value))}>
              {RANGES.map(r => (
                <option key={r.days} value={r.days}>{r.label}</option>
              ))}
            </select>

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '9px', color: 'var(--tx3)', fontFamily: 'monospace', textTransform: 'uppercase' }}>Current</span>
              <span style={{ fontSize: '24px', fontWeight: 500, color: sevColor, fontFamily: 'monospace' }}>
                {currentValue.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Chart title */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--txv)', fontFamily: 'monospace' }}>
              {selectedTs || '—'}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--tx3)', fontFamily: 'monospace' }}>
              {databases.find(d => d.db_key === selectedDb)?.db_name} · % Used over time
            </div>
          </div>

          {/* Chart area */}
          {loadingChart ? (
            <div className="sk" style={{ height: '185px', borderRadius: '6px' }} />
          ) : chartData.length === 0 ? (
            <div style={{ height: '185px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx3)', fontFamily: 'monospace', fontSize: '12px' }}>
              {selectedTs ? 'No data for selected range' : 'Select a database and tablespace'}
            </div>
          ) : (
            <LineChart data={chartData} severity={currentSeverity} maxValue={100} />
          )}

          {/* Last 7 days mini row */}
          {last7.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '0.5px solid var(--bdv)', overflowX: 'auto' }}>
              {last7.map(d => {
                const sev = getSeverity(d.value, warnThreshold, critThreshold)
                return (
                  <div key={d.date} style={{ textAlign: 'center', minWidth: '46px' }}>
                    <div style={{ fontSize: '9px', color: 'var(--tx3)', fontFamily: 'monospace' }}>{d.date.slice(5)}</div>
                    <div style={{
                      fontSize: '11px', fontWeight: 500, fontFamily: 'monospace',
                      color: sev === 'critical' ? 'var(--cr)' : sev === 'warning' ? 'var(--wa)' : 'var(--hl)',
                    }}>
                      {d.value.toFixed(1)}%
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Info panel */}
        <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--bdv)', borderRadius: '8px', padding: '14px', animation: 'slideUp 0.4s 0.1s both' }}>
          <div style={{ fontSize: '9px', color: 'var(--tx2)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '12px', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <i className="ti ti-info-circle" style={{ fontSize: '13px', color: 'var(--Gv)' }} />
            Chart Info
          </div>

          {selectedTs && latestDate ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '9px', color: 'var(--tx3)', fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: '3px' }}>Database</div>
                <div style={{ fontSize: '11px', color: 'var(--txv)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {databases.find(d => d.db_key === selectedDb)?.db_name ?? selectedDb}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '9px', color: 'var(--tx3)', fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: '3px' }}>Tablespace</div>
                <div style={{ fontSize: '11px', color: 'var(--txv)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedTs}</div>
              </div>
              <div>
                <div style={{ fontSize: '9px', color: 'var(--tx3)', fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: '3px' }}>Latest Date</div>
                <div style={{ fontSize: '11px', color: 'var(--txv)', fontFamily: 'monospace' }}>{latestDate}</div>
              </div>
              <div>
                <div style={{ fontSize: '9px', color: 'var(--tx3)', fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: '3px' }}>Data Points</div>
                <div style={{ fontSize: '11px', color: 'var(--txv)', fontFamily: 'monospace' }}>{chartData.length}</div>
              </div>
              <div>
                <div style={{ fontSize: '9px', color: 'var(--tx3)', fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: '3px' }}>Status</div>
                <span className="tg" style={{
                  background: currentSeverity === 'critical' ? 'var(--crb)' : currentSeverity === 'warning' ? 'var(--wab)' : 'var(--hlb)',
                  color: currentSeverity === 'critical' ? 'var(--cr)' : currentSeverity === 'warning' ? 'var(--wa)' : 'var(--hl)',
                }}>
                  {currentSeverity.toUpperCase()}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '11px', color: 'var(--tx3)', fontFamily: 'monospace' }}>
              Select a database and tablespace to view chart info
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
