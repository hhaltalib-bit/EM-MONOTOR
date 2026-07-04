'use client'

import { useEffect, useState } from 'react'
import { Card, btnStyle } from '@/components/analytics/ui'
import { MultiLineChart, SeriesDef } from '@/components/analytics/charts/MultiLineChart'
import { CHART_COLORS } from '@/lib/analytics/chartColors'
import { DbRegistry } from '@/types'
import { fmtPct, fmtNum } from '@/lib/analytics/format'

const STORAGE_KEY = 'em_compare_items'
const MAX_ITEMS = 3
const PILL_COLORS = [CHART_COLORS.green, CHART_COLORS.blue, CHART_COLORS.amber]

interface CompareItem { db_key: string; ts_name: string }

interface CompareSeries { db_key: string; ts_name: string; db_name: string; dates: string[]; pct: number[] }
interface CompareRow { ts_name: string; db_name: string; currentPct: number; growth30d: number; ratePerDay: number; trend: string }

function loadItems(): CompareItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveItems(items: CompareItem[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)) } catch { /* ignore */ }
}

function trendColor(trend: string): string {
  if (trend === 'fastest') return 'var(--cr)'
  if (trend === 'rising') return 'var(--wa)'
  return 'var(--tx2)'
}

function trendLabel(trend: string): string {
  if (trend === 'fastest') return '↗ fastest'
  if (trend === 'rising') return '↗ rising'
  return '→ stable'
}

export function CompareTab({ dark }: { dark: boolean }) {
  const [items, setItems] = useState<CompareItem[]>([])
  const [series, setSeries] = useState<CompareSeries[]>([])
  const [rows, setRows] = useState<CompareRow[]>([])
  const [adding, setAdding] = useState(false)
  const [databases, setDatabases] = useState<DbRegistry[]>([])
  const [pickDb, setPickDb] = useState('')
  const [pickTsOptions, setPickTsOptions] = useState<string[]>([])
  const [pickTs, setPickTs] = useState('')

  useEffect(() => { setItems(loadItems()) }, [])

  useEffect(() => {
    if (items.length === 0) { setSeries([]); setRows([]); return }
    const param = items.map(i => `${i.db_key}:${i.ts_name}`).join(',')
    fetch(`/api/analytics/compare?items=${encodeURIComponent(param)}`)
      .then(r => r.json())
      .then(({ items: s, rows: r }: { items: CompareSeries[]; rows: CompareRow[] }) => {
        setSeries(s ?? [])
        setRows(r ?? [])
      })
      .catch(() => { setSeries([]); setRows([]) })
  }, [items])

  function removeItem(i: number) {
    const next = items.filter((_, idx) => idx !== i)
    setItems(next)
    saveItems(next)
  }

  function openAdd() {
    setAdding(true)
    if (databases.length === 0) {
      fetch('/api/db-list').then(r => r.json()).then(({ databases: dbs }: { databases: DbRegistry[] }) => {
        setDatabases(dbs ?? [])
        if (dbs?.length) setPickDb(dbs[0].db_key)
      }).catch(() => {})
    }
  }

  useEffect(() => {
    if (!adding || !pickDb) return
    fetch(`/api/analytics/tablespaces?db=${encodeURIComponent(pickDb)}`)
      .then(r => r.json())
      .then(({ tablespaces }: { tablespaces: string[] }) => {
        setPickTsOptions(tablespaces ?? [])
        if (tablespaces?.length) setPickTs(tablespaces[0])
      })
      .catch(() => {})
  }, [adding, pickDb])

  function confirmAdd() {
    if (!pickDb || !pickTs) return
    const next = [...items, { db_key: pickDb, ts_name: pickTs }]
    setItems(next)
    saveItems(next)
    setAdding(false)
  }

  const labels = series.length > 0 ? series[0].dates.map(d => d.slice(5)) : []
  const chartSeries: SeriesDef[] = series.map((s, i) => ({
    label: s.ts_name, data: s.pct, color: PILL_COLORS[i % PILL_COLORS.length],
  }))

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
        <span style={{ fontSize: '13px', color: 'var(--tx2)', fontWeight: 500 }}>Comparing:</span>
        {items.map((it, i) => {
          const color = PILL_COLORS[i % PILL_COLORS.length]
          return (
            <span key={`${it.db_key}:${it.ts_name}`} style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px',
              fontSize: '12px', fontWeight: 600, background: `${color}1f`, color,
            }}>
              {it.ts_name}
              <span style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => removeItem(i)}>✕</span>
            </span>
          )
        })}
        {items.length < MAX_ITEMS && (
          adding ? (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <select value={pickDb} onChange={e => setPickDb(e.target.value)} style={{ fontSize: '12px', padding: '5px 8px', borderRadius: '8px', border: '1px solid var(--bd2)', background: 'var(--bg2)', color: 'var(--txv)' }}>
                {databases.map(d => <option key={d.db_key} value={d.db_key}>{d.db_name}</option>)}
              </select>
              <select value={pickTs} onChange={e => setPickTs(e.target.value)} style={{ fontSize: '12px', padding: '5px 8px', borderRadius: '8px', border: '1px solid var(--bd2)', background: 'var(--bg2)', color: 'var(--txv)' }}>
                {pickTsOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button style={{ ...btnStyle, padding: '5px 11px', fontSize: '12px' }} onClick={confirmAdd}>Add</button>
              <button style={{ ...btnStyle, padding: '5px 11px', fontSize: '12px' }} onClick={() => setAdding(false)}>Cancel</button>
            </div>
          ) : (
            <button style={{ ...btnStyle, padding: '5px 11px', fontSize: '12px' }} onClick={openAdd}>
              <i className="ti ti-plus" />Add
            </button>
          )
        )}
      </div>

      {items.length === 0 ? (
        <Card>Add up to 3 tablespaces to compare their usage side by side.</Card>
      ) : (
        <>
          <Card style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: 'var(--txv)' }}>Usage % — side by side</div>
            <div style={{ position: 'relative', height: '230px' }} key={`cmp-${dark}`}>
              <MultiLineChart labels={labels} series={chartSeries} dark={dark} tooltipLabel={(l, v) => `${l}: ${fmtPct(v)}`} yTick={(v) => fmtPct(v)} />
            </div>
          </Card>
          <Card>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  {['Tablespace', 'Now', '30d growth', 'Rate/day', 'Trend'].map((h, i) => (
                    <th key={h} style={{
                      textAlign: i > 0 ? 'right' : 'left', padding: '9px 12px', fontSize: '10px', fontWeight: 600,
                      color: 'var(--tx3)', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--bdv)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.db_name}:${r.ts_name}`}>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bdv)' }}>
                      <span style={{ color: PILL_COLORS[i % PILL_COLORS.length] }}>●</span>{' '}
                      <span style={{ fontFamily: 'monospace' }}>{r.ts_name}</span>
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bdv)', textAlign: 'right' }}>{fmtPct(r.currentPct)}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bdv)', textAlign: 'right' }}>{r.growth30d >= 0 ? '+' : ''}{fmtNum(r.growth30d)}%</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bdv)', textAlign: 'right' }}>{r.ratePerDay >= 0 ? '+' : ''}{fmtNum(r.ratePerDay)}%</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bdv)', textAlign: 'right', color: trendColor(r.trend) }}>{trendLabel(r.trend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  )
}
