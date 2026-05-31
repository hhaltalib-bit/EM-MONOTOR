import { Severity } from '@/types'
import { getSeverityColor } from '@/lib/utils/severity'

interface SparklineProps {
  data: number[]
  severity: Severity
}

export function Sparkline({ data, severity }: SparklineProps) {
  const color = getSeverityColor(severity)

  if (!data || data.length === 0) {
    return <svg width="50" height="18" style={{ display: 'inline-block', verticalAlign: 'middle' }} />
  }

  const W = 50
  const H = 18
  const padT = H * 0.1
  const drawH = H * 0.8

  // Single data point → flat horizontal line at mid-height
  if (data.length === 1) {
    const midY = padT + drawH / 2
    return (
      <svg width={W} height={H} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
        <line x1="0" y1={midY} x2={W} y2={midY} stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const MIN_VISUAL_RANGE = 2
  const range = Math.max(max - min, MIN_VISUAL_RANGE)

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W
    const y = padT + drawH - ((v - min) / range) * drawH
    return `${x},${y}`
  }).join(' ')

  return (
    <svg
      width={W}
      height={H}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <polyline
        points={points}
        fill="none"
        style={{ stroke: color }}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}
