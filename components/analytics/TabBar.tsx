'use client'

const TABS = [
  { key: 'overview',  label: 'Overview',   icon: 'ti-layout-grid' },
  { key: 'deepdive',  label: 'Deep dive',  icon: 'ti-chart-line' },
  { key: 'compare',   label: 'Compare',    icon: 'ti-arrows-exchange' },
  { key: 'forecast',  label: 'Forecast',   icon: 'ti-cloud-storm' },
  { key: 'capacity',  label: 'Capacity',   icon: 'ti-server-2' },
  { key: 'watchlist', label: 'Watchlist',  icon: 'ti-star' },
  { key: 'anomalies', label: 'Anomalies',  icon: 'ti-alert-triangle' },
] as const

export type TabKey = typeof TABS[number]['key']

interface Props {
  active: TabKey
  onChange: (key: TabKey) => void
}

// Inactive tabs use var(--tx2) — a readable medium tone in both themes — at
// all times. Hover only nudges the background; it must never be the thing
// that first makes a tab label legible (that was the reported mockup bug).
export function TabBar({ active, onChange }: Props) {
  return (
    <div style={{
      display: 'flex', gap: '3px', marginBottom: '22px', background: 'var(--bg2)', padding: '5px',
      borderRadius: '12px', border: '1px solid var(--bdv)', overflowX: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
    }}>
      {TABS.map(t => {
        const isActive = t.key === active
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 15px',
              borderRadius: '8px', fontSize: '13px', fontWeight: 550, cursor: 'pointer', border: 'none',
              whiteSpace: 'nowrap', transition: 'background 0.15s, color 0.15s',
              background: isActive ? 'var(--Gv)' : 'transparent',
              color: isActive ? '#fff' : 'var(--tx2)',
            }}
            onMouseEnter={e => {
              if (isActive) return
              e.currentTarget.style.background = 'var(--bg3)'
              e.currentTarget.style.color = 'var(--txv)'
            }}
            onMouseLeave={e => {
              if (isActive) return
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--tx2)'
            }}
          >
            <i className={`ti ${t.icon}`} style={{ fontSize: '15px' }} />
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
