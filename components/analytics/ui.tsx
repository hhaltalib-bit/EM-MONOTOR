'use client'

import { CSSProperties, ReactNode } from 'react'

const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.12)'

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--bdv)', borderRadius: '14px',
      padding: '18px', boxShadow: CARD_SHADOW, ...style,
    }}>
      {children}
    </div>
  )
}

export function CardTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--txv)' }}>
      <span>{children}</span>
      {sub && <span style={{ fontSize: '11px', color: 'var(--tx3)', fontWeight: 400 }}>{sub}</span>}
    </div>
  )
}

export function MetricCard({ label, value, valueColor, note, noteColor }: {
  label: string
  value: string
  valueColor?: string
  note?: string
  noteColor?: string
}) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--bdv)', borderRadius: '14px', padding: '16px', boxShadow: CARD_SHADOW }}>
      <div style={{ fontSize: '11px', color: 'var(--tx3)', marginBottom: '6px', fontWeight: 500, letterSpacing: '0.02em' }}>{label}</div>
      <div style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, color: valueColor ?? 'var(--txv)', fontFamily: 'monospace' }}>{value}</div>
      {note && <div style={{ fontSize: '11px', color: noteColor ?? 'var(--tx3)', marginTop: '6px' }}>{note}</div>}
    </div>
  )
}

export function MetricsGrid({ children, columns = 4 }: { children: ReactNode; columns?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '12px', marginBottom: '14px' }}>
      {children}
    </div>
  )
}

export function Insight({ children }: { children: ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '13px 15px',
      borderRadius: '11px', marginBottom: '10px', background: 'var(--bg2)', border: '1px solid var(--bdv)',
      fontSize: '13px', color: 'var(--tx2)', lineHeight: 1.5, boxShadow: CARD_SHADOW,
    }}>
      <i className="ti ti-bulb" style={{ fontSize: '16px', color: 'var(--Gv)', marginTop: '1px', flexShrink: 0 }} />
      <span>{children}</span>
    </div>
  )
}

const BADGE_COLORS = {
  red:   { bg: 'rgba(220,38,38,0.12)',  fg: '#dc2626' },
  amber: { bg: 'rgba(217,119,6,0.12)',  fg: '#d97706' },
  green: { bg: 'rgba(22,163,74,0.12)',  fg: '#16a34a' },
  blue:  { bg: 'rgba(59,130,246,0.12)', fg: '#3b82f6' },
} as const

export function Badge({ text, color }: { text: string; color: keyof typeof BADGE_COLORS }) {
  const c = BADGE_COLORS[color]
  return (
    <span style={{
      display: 'inline-block', fontSize: '10px', fontWeight: 650, padding: '3px 9px',
      borderRadius: '20px', letterSpacing: '0.02em', background: c.bg, color: c.fg, whiteSpace: 'nowrap',
    }}>
      {text}
    </span>
  )
}

export function severityBadgeColor(severity: string): keyof typeof BADGE_COLORS {
  if (severity === 'critical') return 'red'
  if (severity === 'warning') return 'amber'
  return 'green'
}

export const selectStyle: CSSProperties = {
  padding: '9px 13px', border: '1px solid var(--bd2)', borderRadius: '9px',
  fontSize: '13px', fontWeight: 500, background: 'var(--bg2)', color: 'var(--txv)',
  cursor: 'pointer', minWidth: '170px', outline: 'none', fontFamily: 'inherit',
}

export const btnStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '8px 14px',
  borderRadius: '9px', fontSize: '13px', fontWeight: 550, cursor: 'pointer',
  border: '1px solid var(--bd2)', background: 'var(--bg2)', color: 'var(--txv)',
}

export const btnPrimaryStyle: CSSProperties = {
  ...btnStyle, background: 'var(--Gv)', borderColor: 'var(--Gv)', color: '#fff',
}
