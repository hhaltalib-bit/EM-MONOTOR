'use client'

import { useRouter } from 'next/navigation'
import { DatabaseSummary } from '@/types'
import { getSeverity } from '@/lib/utils/severity'
import { useThresholds } from '@/contexts/ThresholdContext'
import { RingChart } from './RingChart'
import { StatusDot } from '@/components/shared/StatusDot'

interface DbCardProps {
  db: DatabaseSummary
  index: number
}

export function DbCard({ db, index }: DbCardProps) {
  const router = useRouter()
  const { warnThreshold, critThreshold } = useThresholds()
  const severity = getSeverity(db.worst_pct, warnThreshold, critThreshold)

  const critColor = 'var(--cr)'
  const warnColor = 'var(--wa)'
  const hlColor = 'var(--hl)'

  return (
    <div
      className="dc"
      onClick={() => router.push(`/dashboard/tablespaces/${db.key}`)}
      style={{ animationDelay: `${index * 0.025}s` }}
    >
      {/* Row 1: status dot + name + ring */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            minWidth: 0,
            flex: 1,
          }}
        >
          <StatusDot severity={severity} />
          <span
            style={{
              fontSize: '11px',
              color: 'var(--txv)',
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {db.name}
          </span>
        </div>
        <RingChart pct={db.worst_pct} severity={severity} />
      </div>

      {/* Row 2: severity tags */}
      <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginBottom: '5px' }}>
        {db.critical_count > 0 && (
          <span className="tg" style={{ background: 'var(--crb)', color: critColor }}>
            {db.critical_count}c
          </span>
        )}
        {db.warning_count > 0 && (
          <span className="tg" style={{ background: 'var(--wab)', color: warnColor }}>
            {db.warning_count}w
          </span>
        )}
        {db.critical_count === 0 && db.warning_count === 0 && (
          <span className="tg" style={{ background: 'var(--hlb)', color: hlColor }}>
            ok
          </span>
        )}
      </div>

      {/* Row 3: tablespace count */}
      <div style={{ fontSize: '10px', color: 'var(--tx3)', fontFamily: 'monospace' }}>
        {db.total_tablespaces} ts
      </div>
    </div>
  )
}
