'use client'

import { useEffect, useState } from 'react'
import { Severity } from '@/types'
import { getSeverityColor } from '@/lib/utils/severity'

interface StatCardProps {
  label: string
  value: number
  subtitle: string
  icon: string
  severity: Severity
  delay?: number
}

export function StatCard({ label, value, subtitle, icon, severity, delay = 0 }: StatCardProps) {
  const [displayed, setDisplayed] = useState(0)
  const color = getSeverityColor(severity)

  useEffect(() => {
    const steps = 18
    const interval = 40
    let step = 0

    const timer = setInterval(() => {
      step++
      setDisplayed(Math.round((value * step) / steps))
      if (step >= steps) clearInterval(timer)
    }, interval)

    return () => clearInterval(timer)
  }, [value])

  return (
    <div
      style={{
        background: 'var(--bg2)',
        border: '0.5px solid var(--bdv)',
        borderTop: `2px solid ${color}`,
        borderRadius: '8px',
        padding: '12px 13px',
        animation: `popIn 0.3s ${delay}s ease-out both`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
        <i className={`ti ${icon}`} style={{ fontSize: '12px', color }} />
        <span
          style={{
            fontSize: '9px',
            color: 'var(--tx2)',
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            fontFamily: 'monospace',
          }}
        >
          {label}
        </span>
      </div>
      <div style={{ fontSize: '24px', fontWeight: 500, color, fontFamily: 'monospace' }}>
        {displayed}
      </div>
      <div style={{ fontSize: '10px', color: 'var(--tx3)', marginTop: '2px', fontFamily: 'monospace' }}>
        {subtitle}
      </div>
    </div>
  )
}
