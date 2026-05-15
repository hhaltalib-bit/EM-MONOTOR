import { DatabaseSummary } from '@/types'

export function sortDatabases(dbs: DatabaseSummary[]): DatabaseSummary[] {
  const critical = dbs
    .filter(d => d.critical_count > 0)
    .sort((a, b) => b.critical_count - a.critical_count || b.worst_pct - a.worst_pct)
  const warning = dbs
    .filter(d => d.critical_count === 0 && d.warning_count > 0)
    .sort((a, b) => b.warning_count - a.warning_count || b.worst_pct - a.worst_pct)
  const healthy = dbs
    .filter(d => d.critical_count === 0 && d.warning_count === 0)
    .sort((a, b) => a.name.localeCompare(b.name))
  return [...critical, ...warning, ...healthy]
}
