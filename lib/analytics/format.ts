// Display-only formatting for the Analytics section. Storage always stays
// in raw GB / raw percentages — these helpers never touch stored data,
// they only control how a number is rendered.

export function fmtSize(gb: number | null | undefined): string {
  if (gb == null || isNaN(gb)) return '—'
  const abs = Math.abs(gb)
  if (abs >= 1000) {
    return (gb / 1024).toFixed(2) + ' TB'
  }
  return gb.toFixed(2) + ' GB'
}

// For growth values that need a sign and unit.
export function fmtGrowth(gb: number | null | undefined): string {
  if (gb == null || isNaN(gb)) return '—'
  const val = Number(gb.toFixed(2))
  const abs = Math.abs(val)
  const sign = val > 0 ? '+' : ''
  if (abs >= 1000) {
    return sign + (val / 1024).toFixed(2) + ' TB'
  }
  return sign + val.toFixed(2) + ' GB'
}

export function fmtNum(v: number | null | undefined, dp = 2): number {
  if (v == null || isNaN(v)) return 0
  return Number(v.toFixed(dp))
}

export function fmtPct(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—'
  return Number(v.toFixed(2)) + '%'
}
