'use client'

import '@/components/analytics/registerChart'
import { Bar } from 'react-chartjs-2'
import type { TooltipItem } from 'chart.js'
import { themeColors, growthBarColor } from '@/lib/analytics/chartColors'

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
        datasets: [{ data: grw, backgroundColor: grw.map(growthBarColor), borderRadius: 2 }],
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
              label: (c: TooltipItem<'bar'>) => `Growth: ${(c.parsed.y as number) >= 0 ? '+' : ''}${c.parsed.y} GB`,
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: tc.tick, maxTicksLimit: 7, font: { size: 10 } } },
          y: { grid: { color: tc.grid }, ticks: { color: tc.tick, font: { size: 10 }, callback: (v) => `${v} GB` } },
        },
      }}
    />
  )
}
