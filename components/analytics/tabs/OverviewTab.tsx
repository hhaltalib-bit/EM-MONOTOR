'use client'

import { useEffect, useState } from 'react'
import { Card, CardTitle, Insight, MetricCard, MetricsGrid } from '@/components/analytics/ui'
import { fmtSize, fmtGrowth, fmtPct } from '@/lib/analytics/format'
import { growthTextColor } from '@/lib/analytics/chartColors'

interface Mover {
  ts_name: string
  db_name: string
  growth_1d_gb: number
  pct: number
  severity: string
}

interface OverviewData {
  reportDate: string | null
  fleetTotalGb: number
  fleetGrowthMonth: number | null
  criticalCount: number
  warningCount: number
  avgDailyGrowthGb: number
  topMovers: Mover[]
  insights: string[]
}

function pctColor(pct: number): string {
  if (pct >= 90) return 'var(--cr)'
  if (pct >= 80) return 'var(--wa)'
  return 'var(--txv)'
}

export function OverviewTab() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics/overview')
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="sk" style={{ height: '260px', borderRadius: '14px' }} />

  if (!data || !data.reportDate) {
    return <Card>No analytics data available yet. Run the backfill once history has been computed.</Card>
  }

  return (
    <div>
      {data.insights.map((text, i) => <Insight key={i}>{text}</Insight>)}

      <MetricsGrid>
        <MetricCard
          label="Fleet total size"
          value={fmtSize(data.fleetTotalGb)}
          note={data.fleetGrowthMonth != null ? `${fmtGrowth(data.fleetGrowthMonth)} this month` : undefined}
          noteColor={data.fleetGrowthMonth != null ? growthTextColor(data.fleetGrowthMonth) : undefined}
        />
        <MetricCard label={`Critical ≥ threshold`} value={String(data.criticalCount)} valueColor="var(--cr)" note="tablespaces" />
        <MetricCard label={`Warning ≥ threshold`} value={String(data.warningCount)} valueColor="var(--wa)" note="tablespaces" />
        <MetricCard label="Avg daily growth" value={fmtGrowth(data.avgDailyGrowthGb)} note="across fleet" />
      </MetricsGrid>

      <Card>
        <CardTitle sub="sorted by growth">Top movers — most recent day</CardTitle>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr>
              {['Tablespace', 'Database', 'Growth', 'Now'].map((h, i) => (
                <th key={h} style={{
                  textAlign: i >= 2 ? 'right' : 'left', padding: '9px 12px', fontSize: '10px', fontWeight: 600,
                  color: 'var(--tx3)', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--bdv)',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.topMovers.map(m => (
              <tr key={`${m.db_name}:${m.ts_name}`}>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bdv)', fontFamily: 'monospace' }}>{m.ts_name}</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bdv)' }}>{m.db_name}</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bdv)', textAlign: 'right', color: growthTextColor(m.growth_1d_gb), fontWeight: 650 }}>
                  {fmtGrowth(m.growth_1d_gb)}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--bdv)', textAlign: 'right', color: pctColor(m.pct) }}>{fmtPct(m.pct)}</td>
              </tr>
            ))}
            {data.topMovers.length === 0 && (
              <tr><td colSpan={4} style={{ padding: '14px', textAlign: 'center', color: 'var(--tx3)' }}>No growth data yet</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
