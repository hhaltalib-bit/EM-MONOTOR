'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function RefreshButton() {
  const router = useRouter()
  const [spinning, setSpinning] = useState(false)

  function handleRefresh() {
    setSpinning(true)
    router.refresh()
    setTimeout(() => setSpinning(false), 800)
  }

  return (
    <button
      onClick={handleRefresh}
      title="Refresh data"
      style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        background: 'var(--bg2)', border: '0.5px solid var(--bdv)', borderRadius: '6px',
        padding: '5px 10px', fontSize: '11px', color: 'var(--tx3)', cursor: 'pointer',
      }}
    >
      <i
        className="ti ti-refresh"
        style={{
          fontSize: '12px',
          display: 'inline-block',
          animation: spinning ? 'spin 0.8s linear' : 'none',
        }}
      />
      <span style={{ fontFamily: 'monospace' }}>Refresh</span>
    </button>
  )
}
