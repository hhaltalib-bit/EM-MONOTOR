import { Severity } from '@/types'

export function getSeverity(pct: number, warnThreshold = 80, critThreshold = 90): Severity {
  if (pct >= critThreshold) return 'critical'
  if (pct >= warnThreshold) return 'warning'
  return 'healthy'
}

export function getSeverityColor(severity: Severity): string {
  if (severity === 'critical') return 'var(--cr)'
  if (severity === 'warning') return 'var(--wa)'
  return 'var(--hl)'
}

export function getSeverityBg(severity: Severity): string {
  if (severity === 'critical') return 'var(--crb)'
  if (severity === 'warning') return 'var(--wab)'
  return 'var(--hlb)'
}

export function getSeverityClass(severity: Severity): string {
  if (severity === 'critical') return 'r'
  if (severity === 'warning') return 'a'
  return 'g'
}

export function getDotClass(severity: Severity): string {
  if (severity === 'critical') return 'dot cr'
  if (severity === 'warning') return 'dot wa'
  return 'dot hl'
}
