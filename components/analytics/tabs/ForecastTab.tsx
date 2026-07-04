'use client'

import { useEffect, useState } from 'react'
import { Card, CardTitle, Badge } from '@/components/analytics/ui'
import { fmtPct, fmtNum } from '@/lib/analytics/format'

interface ForecastRow {
  ts_name: string
  db_name: string
  pct: number
  rate: number
  days: number
  predictedDate: string
}

export function ForecastTab() {
  const [rows, setRows] = useState<ForecastRow[]>([])
  const [alertCount, setAlertCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics/forecast')
      .then(r => r.json())
      .then(({ rows: r, alertCount: c }: { rows: ForecastRow[]; alertCount: number }) => {
        setRows(r ?? [])
        setAlertCount(c ?? 0)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="sk" style={{ height: '300px', borderRadius: '14px' }} />

  return (
    <div>
      {alertCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '9px', padding: '12px 16px', borderRadius: '11px',
          background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', marginBottom: '14px',
        }}>
          <i className="ti ti-alert-triangle" style={{ color: 'var(--cr)', fontSize: '17px' }} />
          <span style={{ fontSize: '13px', color: 'var(--cr)', fontWeight: 600 }}>
            {alertCount} tablespace{alertCount === 1 ? '' : 's'} projected to fill within 30 days
          </span>
        </div>
      )}
      <Card>
        <CardTitle sub="based on recent growth rate">Days until full</CardTitle>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr>
              {['Tablespace', 'Database', 'Now', 'Rate/day', 'Full in', 'Date'].map((h, i) => (
                <th key={h} style={{
                  textAlign: i >= 2 ? 'right' : 'left', padding: '9px 12px', fontSize: '10px', fontWeight: 600,
                  color: 'var(--tx3)', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--bdv)',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={`${r.db_name}:${r.ts_name}`}>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bdv)', fontFamily: 'monospace' }}>{r.ts_name}</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bdv)' }}>{r.db_name}</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bdv)', textAlign: 'right' }}>{fmtPct(r.pct)}</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bdv)', textAlign: 'right' }}>+{fmtNum(r.rate)}%</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bdv)', textAlign: 'right' }}>
                  <Badge text={`${r.days} days`} color={r.days < 30 ? 'red' : r.days < 90 ? 'amber' : 'green'} />
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bdv)', textAlign: 'right', color: 'var(--tx2)' }}>{r.predictedDate}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '14px', textAlign: 'center', color: 'var(--tx3)' }}>No tablespaces are currently trending toward full</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
