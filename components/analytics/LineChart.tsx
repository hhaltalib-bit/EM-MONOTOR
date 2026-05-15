import { Severity } from '@/types'
import { getSeverityColor } from '@/lib/utils/severity'

interface DataPoint {
  date: string
  value: number
}

interface LineChartProps {
  data: DataPoint[]
  severity: Severity
  maxValue?: number
}

const W = 415
const H = 185
const PAD = { top: 14, right: 36, bottom: 22, left: 32 }
const INNER_W = W - PAD.left - PAD.right
const INNER_H = H - PAD.top - PAD.bottom

export function LineChart({ data, severity, maxValue }: LineChartProps) {
  const color = getSeverityColor(severity)

  if (!data || data.length < 2) {
    return (
      <svg width={W} height={H} style={{ background: 'var(--cht)', borderRadius: '6px' }}>
        <text x={W / 2} y={H / 2} textAnchor="middle" style={{ fill: 'var(--tx3)', fontSize: '12px', fontFamily: 'monospace' }}>
          No data
        </text>
      </svg>
    )
  }

  const values = data.map(d => d.value)
  const minV = 0
  const maxV = maxValue ?? Math.max(...values, 100)

  const toX = (i: number) => PAD.left + (i / (data.length - 1)) * INNER_W
  const toY = (v: number) => PAD.top + INNER_H - ((v - minV) / (maxV - minV)) * INNER_H

  const points = data.map((d, i) => `${toX(i)},${toY(d.value)}`).join(' ')
  const areaPoints = [
    `${PAD.left},${PAD.top + INNER_H}`,
    ...data.map((d, i) => `${toX(i)},${toY(d.value)}`),
    `${toX(data.length - 1)},${PAD.top + INNER_H}`,
  ].join(' ')

  const lastX = toX(data.length - 1)
  const lastY = toY(data[data.length - 1].value)

  const y90 = toY(90)
  const y80 = toY(80)

  const yLabels = [maxV, maxV / 2, minV]
  const xLabelStep = Math.max(1, Math.floor(data.length / 4))

  return (
    <svg
      width={W}
      height={H}
      style={{ display: 'block' }}
    >
      {/* Background */}
      <rect x={0} y={0} width={W} height={H} style={{ fill: 'var(--cht)' }} rx={6} />

      {/* Axis lines */}
      <line
        x1={PAD.left} y1={PAD.top}
        x2={PAD.left} y2={PAD.top + INNER_H}
        style={{ stroke: 'var(--bdv)' }}
        strokeWidth={0.5}
      />
      <line
        x1={PAD.left} y1={PAD.top + INNER_H}
        x2={PAD.left + INNER_W} y2={PAD.top + INNER_H}
        style={{ stroke: 'var(--bdv)' }}
        strokeWidth={0.5}
      />

      {/* Threshold 90% */}
      {y90 >= PAD.top && y90 <= PAD.top + INNER_H && (
        <>
          <line
            x1={PAD.left} y1={y90}
            x2={PAD.left + INNER_W} y2={y90}
            style={{ stroke: 'var(--cr)' }}
            strokeWidth={0.5}
            strokeDasharray="3,3"
          />
          <text x={PAD.left + INNER_W + 3} y={y90 + 3} style={{ fill: 'var(--cr)', fontSize: '9px', fontFamily: 'monospace' }}>90%</text>
        </>
      )}

      {/* Threshold 80% */}
      {y80 >= PAD.top && y80 <= PAD.top + INNER_H && (
        <>
          <line
            x1={PAD.left} y1={y80}
            x2={PAD.left + INNER_W} y2={y80}
            style={{ stroke: 'var(--wa)' }}
            strokeWidth={0.5}
            strokeDasharray="3,3"
          />
          <text x={PAD.left + INNER_W + 3} y={y80 + 3} style={{ fill: 'var(--wa)', fontSize: '9px', fontFamily: 'monospace' }}>80%</text>
        </>
      )}

      {/* Area fill */}
      <polygon
        points={areaPoints}
        style={{ fill: color }}
        fillOpacity={0.1}
      />

      {/* Line */}
      <polyline
        points={points}
        fill="none"
        style={{ stroke: color }}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />

      {/* Last point dot */}
      <circle
        cx={lastX}
        cy={lastY}
        r={3}
        style={{ fill: color, stroke: 'var(--cht)' }}
        strokeWidth={1.5}
      />

      {/* Y-axis labels */}
      {yLabels.map((v, i) => {
        const y = toY(v)
        return (
          <text
            key={i}
            x={PAD.left - 4}
            y={y + 3}
            textAnchor="end"
            style={{ fill: 'var(--tx3)', fontSize: '9px', fontFamily: 'monospace' }}
          >
            {Math.round(v)}%
          </text>
        )
      })}

      {/* X-axis labels */}
      {data.map((d, i) => {
        if (i % xLabelStep !== 0 && i !== data.length - 1) return null
        const x = toX(i)
        const label = d.date.slice(5) // MM-DD
        return (
          <text
            key={i}
            x={x}
            y={PAD.top + INNER_H + 14}
            textAnchor="middle"
            style={{ fill: 'var(--tx3)', fontSize: '9px', fontFamily: 'monospace' }}
          >
            {label}
          </text>
        )
      })}
    </svg>
  )
}
