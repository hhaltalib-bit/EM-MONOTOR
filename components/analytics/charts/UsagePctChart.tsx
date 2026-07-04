'use client'

import '@/components/analytics/registerChart'
import { Line } from 'react-chartjs-2'
import type { TooltipItem } from 'chart.js'
import { themeColors, CHART_COLORS } from '@/lib/analytics/chartColors'

interface Props {
  dates: string[]
  pct: number[]
  sizeGb: number[]
  dark: boolean
  color?: string
}

export function UsagePctChart({ dates, pct, sizeGb, dark, color = CHART_COLORS.green }: Props) {
  const tc = themeColors(dark)
  const labels = dates.map(d => d.slice(5))

  return (
    <Line
      data={{
        labels,
        datasets: [{
          data: pct,
          borderColor: color,
          backgroundColor: `${color}1a`,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 5,
          borderWidth: 2,
        }],
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
            titleFont: { size: 11 },
            bodyFont: { size: 12 },
            callbacks: {
              title: (items) => dates[items[0].dataIndex] ?? '',
              label: (c: TooltipItem<'line'>) => `Used: ${c.parsed.y}% · ${sizeGb[c.dataIndex]?.toLocaleString() ?? '?'} GB`,
            },
          },
        },
        scales: {
          x: { grid: { color: tc.grid }, ticks: { color: tc.tick, maxTicksLimit: 7, font: { size: 10 } } },
          y: { grid: { color: tc.grid }, ticks: { color: tc.tick, font: { size: 10 }, callback: (v) => `${v}%` } },
        },
      }}
    />
  )
}
