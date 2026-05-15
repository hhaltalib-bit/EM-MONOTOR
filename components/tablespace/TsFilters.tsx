'use client'

interface TsFiltersProps {
  search: string
  onSearch: (v: string) => void
  autNoOnly: boolean
  onAutToggle: () => void
}

export function TsFilters({ search, onSearch, autNoOnly, onAutToggle }: TsFiltersProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        background: 'var(--bg)',
        borderBottom: '0.5px solid var(--bdv)',
      }}
    >
      {/* Search */}
      <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
        <i
          className="ti ti-search"
          style={{
            position: 'absolute',
            left: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '13px',
            color: 'var(--tx3)',
          }}
        />
        <input
          className="inp-f"
          type="text"
          placeholder="Filter tablespace names…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          style={{ paddingLeft: '32px' }}
        />
      </div>

      {/* AUT=NO filter */}
      <button
        onClick={onAutToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          padding: '7px 12px',
          borderRadius: '6px',
          border: `0.5px solid ${autNoOnly ? 'var(--cr)' : 'var(--bdv)'}`,
          background: autNoOnly ? 'var(--crb)' : 'var(--bg4)',
          color: autNoOnly ? 'var(--cr)' : 'var(--tx2)',
          cursor: 'pointer',
          fontSize: '11px',
          fontFamily: 'monospace',
        }}
      >
        <i className="ti ti-filter" style={{ fontSize: '12px' }} />
        AUT=NO only
      </button>
    </div>
  )
}
