import { Severity } from '@/types'
import { getSeverityColor } from '@/lib/utils/severity'

interface RingChartProps {
  pct: number
  severity: Severity
}

const CIRCUMFERENCE = 87.96 // 2π × 14

export function RingChart({ pct, severity }: RingChartProps) {
  const color = getSeverityColor(severity)
  const offset = CIRCUMFERENCE * (1 - pct / 100)

  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 36 36"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* Track */}
      <circle
        cx="18"
        cy="18"
        r="14"
        fill="none"
        style={{ stroke: 'var(--rt)' }}
        strokeWidth="2.5"
      />
      {/* Fill */}
      <circle
        cx="18"
        cy="18"
        r="14"
        fill="none"
        style={{
          stroke: color,
          ['--full' as string]: CIRCUMFERENCE,
          ['--off' as string]: offset,
          animation: 'dash 1.2s 0.4s ease-out forwards',
        }}
        strokeWidth="2.5"
        strokeLinecap="round"
        transform="rotate(-90 18 18)"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE}
      />
      {/* Center text */}
      <text
        x="18"
        y="18"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="8"
        fontWeight="500"
        style={{ fill: color, fontFamily: 'monospace' }}
      >
        {Math.round(pct)}%
      </text>
    </svg>
  )
}
