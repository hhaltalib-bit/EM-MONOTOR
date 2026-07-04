'use client'

import { useEffect, useState } from 'react'
import { Card, Badge, severityBadgeColor, btnStyle } from '@/components/analytics/ui'
import { Sparkline } from '@/components/analytics/charts/Sparkline'
import { DbRegistry } from '@/types'
import { fmtPct, fmtGrowth } from '@/lib/analytics/format'
import { growthTextColor } from '@/lib/analytics/chartColors'

const STORAGE_KEY = 'em_watchlist'

interface WatchItem { db_key: string; ts_name: string }

interface WatchData {
  found: boolean
  dbName?: string
  tsName?: string
  latestPct?: number
  todayGrowthGb?: number
  severity?: string
  pct?: number[]
}

function loadWatchlist(): WatchItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveWatchlist(items: WatchItem[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)) } catch { /* ignore */ }
}

interface Props {
  onOpenDeepDive: (db: string, ts: string) => void
}

export function WatchlistTab({ onOpenDeepDive }: Props) {
  const [items, setItems] = useState<WatchItem[]>([])
  const [data, setData] = useState<Record<string, WatchData>>({})
  const [adding, setAdding] = useState(false)
  const [databases, setDatabases] = useState<DbRegistry[]>([])
  const [pickDb, setPickDb] = useState('')
  const [pickTsOptions, setPickTsOptions] = useState<string[]>([])
  const [pickTs, setPickTs] = useState('')

  useEffect(() => { setItems(loadWatchlist()) }, [])

  useEffect(() => {
    items.forEach(it => {
      const key = `${it.db_key}:${it.ts_name}`
      fetch(`/api/analytics/watch?db=${encodeURIComponent(it.db_key)}&ts=${encodeURIComponent(it.ts_name)}`)
        .then(r => r.json())
        .then((d: WatchData) => setData(prev => ({ ...prev, [key]: d })))
        .catch(() => {})
    })
  }, [items])

  function removeItem(i: number) {
    const next = items.filter((_, idx) => idx !== i)
    setItems(next)
    saveWatchlist(next)
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
    if (items.some(i => i.db_key === pickDb && i.ts_name === pickTs)) { setAdding(false); return }
    const next = [...items, { db_key: pickDb, ts_name: pickTs }]
    setItems(next)
    saveWatchlist(next)
    setAdding(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <span style={{ fontSize: '13px', color: 'var(--tx2)' }}>Tablespaces you follow closely — today&apos;s growth at a glance</span>
        {adding ? (
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
          <button style={btnStyle} onClick={openAdd}><i className="ti ti-plus" />Add tablespace</button>
        )}
      </div>

      {items.length === 0 && <Card>No tablespaces watched yet. Add one to see today&apos;s growth at a glance.</Card>}

      {items.map((it, i) => {
        const key = `${it.db_key}:${it.ts_name}`
        const d = data[key]
        if (!d) {
          return <div key={key} className="sk" style={{ height: '76px', borderRadius: '14px', marginBottom: '12px' }} />
        }
        if (!d.found) return null
        return (
          <div key={key} style={{
            background: 'var(--bg2)', border: '1px solid var(--bdv)', borderRadius: '14px', padding: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'monospace', color: 'var(--txv)' }}>{d.tsName}</span>
                <span style={{ fontSize: '11px', color: 'var(--tx3)' }}>{d.dbName}</span>
                <Badge text={`${fmtPct(d.latestPct)} · ${(d.severity ?? '').toUpperCase()}`} color={severityBadgeColor(d.severity ?? 'healthy')} />
              </div>
              <div style={{ fontSize: '12px', color: 'var(--tx2)' }}>
                Today: <b style={{ color: growthTextColor(d.todayGrowthGb ?? 0) }}>
                  {fmtGrowth(d.todayGrowthGb ?? 0)}
                </b>
              </div>
            </div>
            <div style={{ width: '130px', height: '40px' }}>
              {d.pct && d.pct.length > 1 && <Sparkline data={d.pct} />}
            </div>
            <a
              href="#"
              onClick={e => { e.preventDefault(); onOpenDeepDive(it.db_key, it.ts_name) }}
              style={{ fontSize: '12px', color: 'var(--Gv)', textDecoration: 'none', fontWeight: 550, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              Open in Deep Dive <i className="ti ti-arrow-right" />
            </a>
            <i className="ti ti-x" style={{ cursor: 'pointer', color: 'var(--tx3)' }} onClick={() => removeItem(i)} />
          </div>
        )
      })}
    </div>
  )
}
