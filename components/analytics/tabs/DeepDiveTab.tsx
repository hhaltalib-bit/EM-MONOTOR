'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, CardTitle, MetricCard, MetricsGrid, selectStyle, btnPrimaryStyle } from '@/components/analytics/ui'
import { UsagePctChart } from '@/components/analytics/charts/UsagePctChart'
import { GrowthBarChart } from '@/components/analytics/charts/GrowthBarChart'
import { DbRegistry } from '@/types'

interface DeepDiveMetrics {
  currentPct: number
  currentSize: number
  used: number
  free: number
  aut: string
  periodGrowthGb: number
  statusText: string
}

interface DeepDiveData {
  dates: string[]
  pct: number[]
  size: number[]
  used: number[]
  grw: number[]
  metrics: DeepDiveMetrics | null
}

const PERIODS = [30, 60, 90]

interface Props {
  dark: boolean
  pending: { db: string; ts: string } | null
  onConsumed: () => void
}

function statusColor(text: string): string {
  if (text === 'CRITICAL') return 'var(--cr)'
  if (text === 'WARNING') return 'var(--wa)'
  return 'var(--hl)'
}

export function DeepDiveTab({ dark, pending, onConsumed }: Props) {
  const [databases, setDatabases] = useState<DbRegistry[]>([])
  const [dbKey, setDbKey] = useState('')
  const [tablespaces, setTablespaces] = useState<string[]>([])
  const [tsName, setTsName] = useState('')
  const [period, setPeriod] = useState(30)
  const [data, setData] = useState<DeepDiveData | null>(null)
  const [loadingTs, setLoadingTs] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const pendingTsRef = useRef<string | null>(null)

  useEffect(() => {
    fetch('/api/db-list')
      .then(r => r.json())
      .then(({ databases: dbs }: { databases: DbRegistry[] }) => {
        setDatabases(dbs ?? [])
        if (dbs?.length && !dbKey) setDbKey(dbs[0].db_key)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (pending) {
      pendingTsRef.current = pending.ts
      setDbKey(pending.db)
    }
  }, [pending])

  useEffect(() => {
    if (!dbKey) return
    setLoadingTs(true)
    setTablespaces([])
    fetch(`/api/analytics/tablespaces?db=${encodeURIComponent(dbKey)}`)
      .then(r => r.json())
      .then(({ tablespaces: list }: { tablespaces: string[] }) => {
        setTablespaces(list ?? [])
        if (pendingTsRef.current && list?.includes(pendingTsRef.current)) {
          setTsName(pendingTsRef.current)
          pendingTsRef.current = null
          onConsumed()
        } else if (list?.length) {
          setTsName(list[0])
        }
        setLoadingTs(false)
      })
      .catch(() => setLoadingTs(false))
  }, [dbKey, onConsumed])

  const fetchData = useCallback(() => {
    if (!dbKey || !tsName) return
    setLoadingData(true)
    fetch(`/api/analytics/deepdive?db=${encodeURIComponent(dbKey)}&ts=${encodeURIComponent(tsName)}&period=${period}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoadingData(false))
  }, [dbKey, tsName, period])

  useEffect(() => { fetchData() }, [fetchData])

  function exportCsv() {
    if (!data) return
    const rows = ['date,size_gb,growth_gb,used_pct']
    data.dates.forEach((d, i) => {
      rows.push(`${d},${data.size[i]},${data.grw[i]},${data.pct[i]}`)
    })
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${dbKey}_${tsName}_${period}d.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div style={{
        display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap',
        background: 'var(--bg2)', padding: '16px', borderRadius: '14px', border: '1px solid var(--bdv)',
        marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <span style={{ fontSize: '10px', color: 'var(--tx3)', letterSpacing: '0.06em', fontWeight: 600, textTransform: 'uppercase' }}>1 · Database</span>
          <select style={selectStyle} value={dbKey} onChange={e => setDbKey(e.target.value)}>
            {databases.map(d => <option key={d.db_key} value={d.db_key}>{d.db_name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <span style={{ fontSize: '10px', color: 'var(--tx3)', letterSpacing: '0.06em', fontWeight: 600, textTransform: 'uppercase' }}>2 · Tablespace</span>
          <select style={selectStyle} value={tsName} onChange={e => setTsName(e.target.value)} disabled={loadingTs || tablespaces.length === 0}>
            {loadingTs && <option>Loading…</option>}
            {!loadingTs && tablespaces.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <span style={{ fontSize: '10px', color: 'var(--tx3)', letterSpacing: '0.06em', fontWeight: 600, textTransform: 'uppercase' }}>3 · Period</span>
          <select style={{ ...selectStyle, minWidth: '130px' }} value={period} onChange={e => setPeriod(Number(e.target.value))}>
            {PERIODS.map(p => <option key={p} value={p}>Last {p} days</option>)}
          </select>
        </div>
        <button style={{ ...btnPrimaryStyle, marginLeft: 'auto' }} onClick={exportCsv} disabled={!data || data.dates.length === 0}>
          <i className="ti ti-download" />Export data
        </button>
      </div>

      {loadingData ? (
        <div className="sk" style={{ height: '400px', borderRadius: '14px' }} />
      ) : !data || data.dates.length === 0 ? (
        <Card>No data available for this tablespace in the selected period.</Card>
      ) : (
        <>
          <MetricsGrid>
            <MetricCard
              label="Current usage"
              value={`${data.metrics!.currentPct.toFixed(1)}%`}
              valueColor={statusColor(data.metrics!.statusText)}
              note={data.metrics!.statusText}
            />
            <MetricCard label="Current size" value={data.metrics!.currentSize.toLocaleString()} note="GB allocated" />
            <MetricCard label="Used / Free" value={data.metrics!.used.toLocaleString()} note={`${data.metrics!.free.toLocaleString()} GB free`} />
            <MetricCard
              label={`${period}d growth`}
              value={`${data.metrics!.periodGrowthGb >= 0 ? '+' : ''}${data.metrics!.periodGrowthGb.toFixed(1)}`}
              valueColor="var(--hl)"
              note={`GB · autoext ${data.metrics!.aut}`}
            />
          </MetricsGrid>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <Card>
              <CardTitle>Usage % over time</CardTitle>
              <div style={{ position: 'relative', height: '200px' }} key={`pct-${dark}`}>
                <UsagePctChart dates={data.dates} pct={data.pct} sizeGb={data.size} dark={dark} />
              </div>
            </Card>
            <Card>
              <CardTitle>Daily growth (GB)</CardTitle>
              <div style={{ position: 'relative', height: '200px' }} key={`grw-${dark}`}>
                <GrowthBarChart dates={data.dates} grw={data.grw} dark={dark} />
              </div>
            </Card>
          </div>

          <Card>
            <CardTitle sub="most recent first">{tsName} — daily detail</CardTitle>
            <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr>
                    {['Date', 'Size (GB)', 'Growth (GB)', 'Used %'].map((h, i) => (
                      <th key={h} style={{
                        textAlign: i > 0 ? 'right' : 'left', padding: '9px 12px', fontSize: '10px', fontWeight: 600,
                        color: 'var(--tx3)', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--bdv)',
                        position: 'sticky', top: 0, background: 'var(--bg2)',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...data.dates.map((d, i) => i)].reverse().map(i => {
                    const g = data.grw[i]
                    const gc = g >= 3 ? 'var(--cr)' : g >= 1.5 ? 'var(--wa)' : 'var(--txv)'
                    return (
                      <tr key={data.dates[i]}>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bdv)' }}>{data.dates[i]}</td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bdv)', textAlign: 'right' }}>{data.size[i].toLocaleString()}</td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bdv)', textAlign: 'right', color: gc, fontWeight: g >= 1.5 ? 650 : 400 }}>
                          {g > 0 ? '+' : ''}{g}
                        </td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bdv)', textAlign: 'right' }}>{data.pct[i]}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
