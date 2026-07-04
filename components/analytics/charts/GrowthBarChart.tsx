'use client'

import '@/components/analytics/registerChart'
import { Bar } from 'react-chartjs-2'
import type { TooltipItem } from 'chart.js'
import { themeColors, growthColor } from '@/lib/analytics/chartColors'
import { fmtGrowth } from '@/lib/analytics/format'

interface Props {
  dates: string[]
  grw: number[]
  dark: boolean
}

export function GrowthBarChart({ dates, grw, dark }: Props) {
  const tc = themeColors(dark)
  const labels = dates.map(d => d.slice(5))

  return (
    <Bar
      data={{
        labels,
        // Capacity-monitoring rule: growth (filling up) is red, shrink (space
        // freed) is green, no change is gray. Bar heights keep the raw GB
        // values for accurate proportions — only labels are formatted.
        datasets: [{ data: grw, backgroundColor: grw.map(growthColor), borderRadius: 2 }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: tc.tooltipBg,
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              title: (items) => dates[items[0].dataIndex] ?? '',
              label: (c: TooltipItem<'bar'>) => `Growth: ${fmtGrowth(c.parsed.y as number)}`,
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: tc.tick, maxTicksLimit: 7, font: { size: 10 } } },
          y: { grid: { color: tc.grid }, ticks: { color: tc.tick, font: { size: 10 }, callback: (v) => fmtGrowth(v as number) } },
        },
      }}
    />
  )
}
