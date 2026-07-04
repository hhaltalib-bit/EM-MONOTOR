export type DateRow = { report_date: string; [key: string]: unknown }

const MS_PER_DAY = 86_400_000

export function daysBetween(a: string, b: string): number {
  const msA = new Date(`${a}T00:00:00Z`).getTime()
  const msB = new Date(`${b}T00:00:00Z`).getTime()
  return Math.round((msB - msA) / MS_PER_DAY)
}

export interface GrowthResult {
  growthGb: number
  days: number
  ratePerDay: number
}

/** Gap-safe growth between two rows — days come from actual report_date values, never assumed. */
export function growthBetween(oldRow: DateRow, newRow: DateRow, usedKey: string): GrowthResult {
  const days = daysBetween(oldRow.report_date, newRow.report_date)
  const growthGb = (newRow[usedKey] as number) - (oldRow[usedKey] as number)
  const ratePerDay = days > 0 ? growthGb / days : 0
  return { growthGb, days, ratePerDay }
}

/** Long-run %/day rate across the full available window. Rows must be sorted ascending by report_date. */
export function longPctRate(rows: DateRow[], pctKey: string): number {
  if (rows.length < 2) return 0
  const oldest = rows[0]
  const newest = rows[rows.length - 1]
  const days = daysBetween(oldest.report_date, newest.report_date)
  if (days <= 0) return 0
  return ((newest[pctKey] as number) - (oldest[pctKey] as number)) / days
}

/**
 * Short-term %/day rate over roughly `windowDays`. Finds the available row closest to
 * windowDays-ago by real calendar date (never assumes daily granularity), then rates
 * against the newest row. Rows must be sorted ascending by report_date.
 */
export function recentPctRate(rows: DateRow[], pctKey: string, windowDays = 7): number {
  if (rows.length < 2) return 0
  const newest = rows[rows.length - 1]
  const targetMs = new Date(`${newest.report_date}T00:00:00Z`).getTime() - windowDays * MS_PER_DAY

  let closest = rows[0]
  let closestDiff = Infinity
  for (const r of rows) {
    if (r === newest) continue
    const diff = Math.abs(new Date(`${r.report_date}T00:00:00Z`).getTime() - targetMs)
    if (diff < closestDiff) { closestDiff = diff; closest = r }
  }

  const days = daysBetween(closest.report_date, newest.report_date)
  if (days <= 0) return 0
  return ((newest[pctKey] as number) - (closest[pctKey] as number)) / days
}

/**
 * Pct is already computed against its schema's ceiling (max_ts_size for standard,
 * gb_total for dwh) at the source, so 100% is the correct ceiling for every schema type.
 */
export function daysUntilFull(currentPct: number, recentRate: number): number | null {
  if (recentRate <= 0) return null
  return Math.round((100 - currentPct) / recentRate)
}

export type CalcSeverity = 'critical' | 'warning' | 'healthy'

export function severityOf(pct: number, warn: number, crit: number): CalcSeverity {
  if (pct >= crit) return 'critical'
  if (pct >= warn) return 'warning'
  return 'healthy'
}
