'use client'

import '@/components/analytics/registerChart'
import { Line } from 'react-chartjs-2'
import { CHART_COLORS } from '@/lib/analytics/chartColors'

export function Sparkline({ data }: { data: number[] }) {
  return (
    <Line
      data={{
        labels: data.map(() => ''),
        datasets: [{
          data,
          borderColor: CHART_COLORS.green,
          backgroundColor: `${CHART_COLORS.green}1f`,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 1.5,
        }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } },
      }}
    />
  )
}
