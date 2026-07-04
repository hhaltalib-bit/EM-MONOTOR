export const CHART_COLORS = {
  green: '#16a34a',
  red: '#dc2626',
  amber: '#d97706',
  blue: '#3b82f6',
  gray: '#6b7280',
} as const

export function themeColors(dark: boolean) {
  return {
    grid: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    tick: dark ? '#94a3b8' : '#64748b',
    tooltipBg: dark ? '#1a212e' : '#0f172a',
  }
}

/**
 * Capacity-monitoring growth color — intentionally the opposite of financial
 * coloring: growth toward full is the risk, so positive growth is RED and
 * negative (space freed) is GREEN. Hex version for Chart.js canvas fills.
 */
export function growthColor(v: number): string {
  if (v > 0) return CHART_COLORS.red
  if (v < 0) return CHART_COLORS.green
  return CHART_COLORS.gray
}

/** Same rule as growthColor, but as a CSS variable for regular DOM/JSX text. */
export function growthTextColor(v: number): string {
  if (v > 0) return 'var(--cr)'
  if (v < 0) return 'var(--hl)'
  return 'var(--tx2)'
}
