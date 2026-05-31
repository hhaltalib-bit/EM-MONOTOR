'use client'

import { StandardTablespace, DwhTablespace, Severity } from '@/types'
import { getSeverity, getSeverityColor, getSeverityClass } from '@/lib/utils/severity'
import { fmtSize, fmtPct, growthText, actionText, forecastText } from '@/lib/utils/format'
import { useThresholds } from '@/contexts/ThresholdContext'
import { ProgressBar } from './ProgressBar'
import { Sparkline } from './Sparkline'

type TsCardProps = {
  ts: StandardTablespace | DwhTablespace
  schemaType: 'standard' | 'dwh'
  growthGb: number
  sparklineData: number[]
  index: number
  reportDate: string
}

export function TsCard({ ts, schemaType, growthGb, sparklineData, index, reportDate }: TsCardProps) {
  const { warnThreshold, critThreshold } = useThresholds()

  const pct =
    schemaType === 'standard'
      ? (ts as StandardTablespace).max_ts_pct_used
      : (ts as DwhTablespace).percent_used

  const usedSize =
    schemaType === 'standard'
      ? (ts as StandardTablespace).used_ts_size
      : (ts as DwhTablespace).gb_used

  const aut = schemaType === 'standard' ? (ts as StandardTablespace).aut : null

  const severity = getSeverity(pct, warnThreshold, critThreshold)
  const severityClass = getSeverityClass(severity)
  const color = getSeverityColor(severity)
  const growth = growthText(growthGb)
  const action = actionText(pct)
  const forecast = growthGb > 0 ? forecastText(pct, growthGb) : null

  const severityLabel =
    severity === 'critical' ? 'CRITICAL' :
    severity === 'warning'  ? 'WARNING' : 'HEALTHY'

  const severityStyle = {
    critical: { background: 'var(--crb)', color: 'var(--cr)' },
    warning:  { background: 'var(--wab)', color: 'var(--wa)' },
    healthy:  { background: 'var(--hlb)', color: 'var(--hl)' },
  }[severity]

  return (
    <div
      className={`tc ${severityClass}`}
      style={{ animationDelay: `${index * 0.035}s` }}
    >
      {/* Row 1 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', minWidth: 0 }}>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--txv)',
              fontFamily: 'monospace',
            }}
          >
            {ts.tablespace_name}
          </span>
          {aut !== null && (
            <span
              className="tg"
              style={
                aut === 'NO'
                  ? { background: 'var(--crb)', color: 'var(--cr)', border: '0.5px solid var(--cr)' }
                  : { background: 'var(--bg4)', color: 'var(--tx2)' }
              }
            >
              AUT:{aut}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <Sparkline data={sparklineData} severity={severity} />
          <span style={{ fontSize: '20px', fontWeight: 500, color, fontFamily: 'monospace' }}>
            {fmtPct(pct, 2)}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--tx3)', fontFamily: 'monospace' }}>
            {fmtSize(usedSize)}
          </span>
          <span className="tg" style={severityStyle}>
            {severityLabel}
          </span>
          <button
            style={{
              background: 'var(--bg4)',
              border: '0.5px solid var(--bdv)',
              borderRadius: '5px',
              padding: '3px 7px',
              cursor: 'pointer',
              color: 'var(--tx2)',
            }}
            title="View chart"
          >
            <i className="ti ti-chart-line" style={{ fontSize: '11px' }} />
          </button>
        </div>
      </div>

      {/* Row 2: progress bar */}
      <ProgressBar pct={pct} severity={severity} />

      {/* Row 3: date + growth + action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--tx3)' }}>
        <span className="mn">
          {reportDate} · growth:{' '}
          <span style={{ color: growth.color }}>{growth.text}</span>
        </span>
        <span style={{ color: action.color, fontFamily: 'monospace' }}>
          {action.text}
        </span>
      </div>
      {forecast && (
        <div style={{ fontSize: '10px', color: 'var(--tx3)', fontFamily: 'monospace', marginTop: '2px' }}>
          {forecast}
        </div>
      )}
    </div>
  )
}
