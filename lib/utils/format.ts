export function fmtSize(gb: number): string {
  if (gb >= 1000) {
    return (gb / 1000).toFixed(1) + ' TB'
  }
  return gb.toFixed(1) + ' GB'
}

export function fmtPct(pct: number, precision: number = 2): string {
  return pct.toFixed(precision) + '%'
}

export function fmtDate(dateStr: string): string {
  return dateStr
}

export function growthText(growthGb: number): { text: string; color: string } {
  if (growthGb > 1) {
    return { text: `↑↑ +${growthGb.toFixed(1)}GB`, color: 'var(--cr)' }
  }
  if (growthGb > 0.1) {
    return { text: `↑ +${growthGb.toFixed(1)}GB`, color: 'var(--wa)' }
  }
  return { text: '→ 0', color: 'var(--tx3)' }
}

export function forecastText(pct: number, growthGbPerDay: number): string | null {
  if (growthGbPerDay <= 0) return null
  const daysUntilFull = (100 - pct) / (growthGbPerDay / 1) // simplified
  if (daysUntilFull < 7) {
    return `· full in ~${Math.round(daysUntilFull)}d !`
  }
  if (daysUntilFull < 30) {
    return `· full in ~${Math.round(daysUntilFull)}d`
  }
  return null
}

export function actionText(pct: number): { text: string; color: string } {
  if (pct >= 90) return { text: 'resize NOW', color: 'var(--cr)' }
  if (pct >= 80) return { text: 'monitor', color: 'var(--wa)' }
  return { text: 'nominal', color: 'var(--hl)' }
}
