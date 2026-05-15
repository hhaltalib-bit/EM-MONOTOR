import { Severity } from '@/types'

interface StatusDotProps {
  severity: Severity
}

export function StatusDot({ severity }: StatusDotProps) {
  const cls =
    severity === 'critical' ? 'dot cr' :
    severity === 'warning'  ? 'dot wa' : 'dot hl'

  return <span className={cls} />
}
