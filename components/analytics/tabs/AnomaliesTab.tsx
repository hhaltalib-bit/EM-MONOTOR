'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/analytics/ui'

interface AnomalyItem {
  ts_name: string
  db_name: string
  type: string
  description: string
  date: string
  pct: number
}

const TYPE_LABELS: Record<string, string> = {
  spike: 'sudden growth spike',
  threshold_cross: 'crossed usage threshold',
  rate_change: 'growth rate changed',
  near_full: 'approaching full',
}

function isSevere(type: string): boolean {
  return type === 'spike' || type === 'near_full'
}

export function AnomaliesTab() {
  const [items, setItems] = useState<AnomalyItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics/anomalies')
      .then(r => r.json())
      .then(({ anomalies }: { anomalies: AnomalyItem[] }) => setItems(anomalies ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="sk" style={{ height: '300px', borderRadius: '14px' }} />
  if (items.length === 0) return <Card>No anomalies detected in recent history.</Card>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
      {items.map((a, i) => {
        const severe = isSevere(a.type)
        return (
          <div key={i} style={{
            background: 'var(--bg2)', border: '1px solid var(--bdv)',
            borderLeft: `3px solid ${severe ? 'var(--cr)' : 'var(--wa)'}`,
            borderRadius: '0 12px 12px 0', padding: '15px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
          }}>
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '3px', color: 'var(--txv)' }}>
                <span style={{ fontFamily: 'monospace' }}>{a.ts_name}</span> — {TYPE_LABELS[a.type] ?? a.type}
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--tx2)', margin: 0 }}>{a.description}</p>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--tx3)', whiteSpace: 'nowrap' }}>{a.date}</span>
          </div>
        )
      })}
    </div>
  )
}
