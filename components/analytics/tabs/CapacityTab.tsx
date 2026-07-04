'use client'

import { useEffect, useState } from 'react'
import { Card, Insight, MetricCard, MetricsGrid } from '@/components/analytics/ui'
import { MultiLineChart, SeriesDef } from '@/components/analytics/charts/MultiLineChart'
import { CHART_COLORS } from '@/lib/analytics/chartColors'
import { fmtSize, fmtGrowth } from '@/lib/analytics/format'

interface CapacityData {
  insight: string | null
  monthlyFleetGrowthGb: number
  projected3moGb: number
  needed3moGb: number
  projected6moGb: number
  needed6moGb: number
  series: { dates: string[]; actualGb: (number | null)[]; projectedGb: (number | null)[] }
}

export function CapacityTab({ dark }: { dark: boolean }) {
  const [data, setData] = useState<CapacityData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics/capacity')
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="sk" style={{ height: '360px', borderRadius: '14px' }} />
  if (!data || data.series.dates.length === 0) return <Card>No capacity data available yet.</Card>

  const labels = data.series.dates.map(d => d.slice(5))
  const chartSeries: SeriesDef[] = [
    { label: 'Actual', data: data.series.actualGb, color: CHART_COLORS.green },
    { label: 'Projected', data: data.series.projectedGb, color: CHART_COLORS.amber, dashed: true },
  ]

  return (
    <div>
      {data.insight && <Insight>{data.insight}</Insight>}
      <MetricsGrid columns={3}>
        <MetricCard label="Monthly fleet growth" value={fmtGrowth(data.monthlyFleetGrowthGb)} note="last ~30 days" />
        <MetricCard label="Projected in 3 months" value={fmtSize(data.projected3moGb)} note={`${fmtGrowth(data.needed3moGb)} needed`} noteColor="var(--wa)" />
        <MetricCard label="Projected in 6 months" value={fmtSize(data.projected6moGb)} note={`${fmtGrowth(data.needed6moGb)} needed`} noteColor="var(--cr)" />
      </MetricsGrid>
      <Card>
        <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: 'var(--txv)' }}>Fleet size projection — next 6 months</div>
        <div style={{ position: 'relative', height: '230px' }} key={`cap-${dark}`}>
          <MultiLineChart labels={labels} series={chartSeries} dark={dark} tooltipLabel={(l, v) => `${l}: ${fmtSize(v)}`} yTick={(v) => fmtSize(v)} />
        </div>
      </Card>
    </div>
  )
}
