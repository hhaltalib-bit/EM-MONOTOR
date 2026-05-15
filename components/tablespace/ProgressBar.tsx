import { Severity } from '@/types'
import { getSeverityColor } from '@/lib/utils/severity'

interface ProgressBarProps {
  pct: number
  severity: Severity
}

export function ProgressBar({ pct, severity }: ProgressBarProps) {
  const color = getSeverityColor(severity)

  return (
    <div className="pb">
      <div
        className="pf"
        style={{
          ['--w' as string]: `${pct}%`,
          background: color,
        }}
      />
    </div>
  )
}
