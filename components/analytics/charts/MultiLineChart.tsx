'use client'

import '@/components/analytics/registerChart'
import { Line } from 'react-chartjs-2'
import { themeColors } from '@/lib/analytics/chartColors'

export interface SeriesDef {
  label: string
  data: (number | null)[]
  color: string
  dashed?: boolean
}

interface Props {
  labels: string[]
  series: SeriesDef[]
  dark: boolean
  tooltipLabel: (seriesLabel: string, value: number) => string
  yTick?: (v: number) => string
}

export function MultiLineChart({ labels, series, dark, tooltipLabel, yTick }: Props) {
  const tc = themeColors(dark)

  return (
    <Line
      data={{
        labels,
        datasets: series.map(s => ({
          label: s.label,
          data: s.data,
          borderColor: s.color,
          backgroundColor: s.dashed ? 'transparent' : `${s.color}1a`,
          fill: !s.dashed,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
          borderDash: s.dashed ? [5, 4] : undefined,
          spanGaps: true,
        })),
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, labels: { color: tc.tick, font: { size: 11 }, boxWidth: 12, padding: 12 } },
          tooltip: {
            backgroundColor: tc.tooltipBg,
            padding: 10,
            cornerRadius: 8,
            callbacks: { label: (c) => tooltipLabel(c.dataset.label ?? '', c.parsed.y as number) },
          },
        },
        scales: {
          x: { grid: { color: tc.grid }, ticks: { color: tc.tick, maxTicksLimit: 7, font: { size: 10 } } },
          y: { grid: { color: tc.grid }, ticks: { color: tc.tick, font: { size: 10 }, callback: (v) => (yTick ? yTick(v as number) : String(v)) } },
        },
      }}
    />
  )
}
