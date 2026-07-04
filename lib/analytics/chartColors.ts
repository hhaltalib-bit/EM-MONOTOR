export const CHART_COLORS = {
  green: '#16a34a',
  red: '#dc2626',
  amber: '#d97706',
  blue: '#3b82f6',
} as const

export function themeColors(dark: boolean) {
  return {
    grid: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    tick: dark ? '#94a3b8' : '#64748b',
    tooltipBg: dark ? '#1a212e' : '#0f172a',
  }
}

export function growthBarColor(v: number): string {
  if (v >= 3) return CHART_COLORS.red
  if (v >= 1.5) return CHART_COLORS.amber
  return CHART_COLORS.green
}
