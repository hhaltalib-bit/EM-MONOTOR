'use client'

import { useEffect, useState } from 'react'
import type { BackupSummaryData, BackupStatusRow, BackupReportInfo } from '@/app/api/backup-summary/route'

// ─── Theme-adaptive palette (CSS variables) ──────────────────────────────────
const BG  = 'var(--bg)'
const BG2 = 'var(--bg2)'
const BG3 = 'var(--bg3)'
const BD  = 'var(--bdv)'
const TX  = 'var(--txv)'
const TX2 = 'var(--tx2)'
const TX3 = 'var(--tx3)'
const G    = '#2da44e'
const GB   = '#dafbe1'
const R    = '#cf222e'
const RB   = '#ffd7d5'
const A    = '#9a6700'
const AB   = '#fff3cd'

// ─── Stat Cards ──────────────────────────────────────────────────────────────
const STATS = [
  { label: 'Healthy', icon: 'ti-shield-check', color: G,    bg: GB,  border: G,   sub: 'Backed up today' },
  { label: 'Delayed', icon: 'ti-clock',         color: A,    bg: AB,  border: A,   sub: 'Pending backup'  },
  { label: 'Failed',  icon: 'ti-alert-circle',  color: R,    bg: RB,  border: R,   sub: 'Backup failed'   },
  { label: 'Ignored', icon: 'ti-minus-circle',  color: '#9CA3AF', bg: '#F9FAFB', border: '#E0E0E0', sub: 'Not tracked' },
]

// ─── CSV export ──────────────────────────────────────────────────────────────
function exportCSV(
  failed: BackupStatusRow[],
  delayed: BackupStatusRow[],
  healthy: BackupStatusRow[],
  ignored: BackupStatusRow[],
  date: string,
) {
  const all = [...failed, ...delayed, ...healthy, ...ignored]
  const hdr = ['db_name','db_key','backup_type','start_time','end_time','status','time_taken','output_gb','output_device','age_days','classification']
  const csv = [
    hdr.join(','),
    ...all.map(r => [
      `"${r.db_name}"`, r.db_key, r.backup_type || '', r.start_time || '',
      r.end_time || '', r.status || '', r.time_taken || '',
      r.output_gb ?? '', r.output_device || '', r.age_days, r.classification,
    ].join(',')),
  ].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `backup-report-${date}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Format time from ISO ────────────────────────────────────────────────────
function fmtTime(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

// ─── Donut SVG ───────────────────────────────────────────────────────────────
function DonutChart({ h, d, f, i }: { h: number; d: number; f: number; i: number }) {
  const total = h + d + f + i
  const R_CIRC = 42
  const CX = 60
  const circum = 2 * Math.PI * R_CIRC

  const segments = [
    { val: h, color: G   },
    { val: d, color: A   },
    { val: f, color: R   },
    { val: i, color: BD  },
  ]

  let accum = 0
  const arcs = segments.map((seg, idx) => {
    if (total === 0 || seg.val === 0) return null
    const len = (seg.val / total) * circum
    const rotation = (accum / circum) * 360 - 90
    accum += len
    return (
      <circle
        key={idx}
        cx={CX} cy={CX} r={R_CIRC}
        fill="none"
        stroke={seg.color}
        strokeWidth={18}
        strokeDasharray={`${len} ${circum - len}`}
        transform={`rotate(${rotation}, ${CX}, ${CX})`}
      />
    )
  })

  return (
    <svg width={120} height={120} viewBox="0 0 120 120">
      <circle cx={CX} cy={CX} r={R_CIRC} fill="none" stroke={BG3} strokeWidth={18} />
      {total > 0 && arcs}
      <text x={CX} y={56} textAnchor="middle" fontSize={20} fontWeight={500}
        fontFamily="monospace" fill={TX}>
        {total}
      </text>
      <text x={CX} y={72} textAnchor="middle" fontSize={9}
        fontFamily="monospace" fill={TX3}>
        total
      </text>
    </svg>
  )
}

// ─── Right-column panel wrapper ──────────────────────────────────────────────
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: BG2, border: `0.5px solid ${BD}`, borderRadius: '8px', padding: '12px' }}>
      <div style={{ fontSize: '9px', textTransform: 'uppercase' as const, letterSpacing: '0.7px', color: TX3, fontFamily: 'monospace', marginBottom: '10px' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

// ─── Section header ──────────────────────────────────────────────────────────
function SectionHeader({ icon, label, count, color, bg, border }: {
  icon: string; label: string; count: number
  color: string; bg: string; border: string
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '7px 12px', background: bg,
      borderRadius: '6px 6px 0 0', border: `0.5px solid ${border}`,
    }}>
      <i className={`ti ${icon}`} style={{ color, fontSize: '12px' }} />
      <span style={{ fontSize: '10px', fontWeight: 500, color, textTransform: 'uppercase' as const, letterSpacing: '0.6px', fontFamily: 'monospace' }}>
        {label}
      </span>
      <span style={{ marginLeft: 'auto', background: color, color: '#fff', fontSize: '9px', fontFamily: 'monospace', padding: '1px 6px', borderRadius: '3px' }}>
        {count}
      </span>
    </div>
  )
}

// ─── Badge ───────────────────────────────────────────────────────────────────
function Badge({ text, color, bg, border }: { text: string; color: string; bg: string; border: string }) {
  return (
    <span style={{ background: bg, color, border: `0.5px solid ${border}`, borderRadius: '4px', padding: '2px 7px', fontSize: '10px', fontWeight: 500, flexShrink: 0 }}>
      {text}
    </span>
  )
}

// ─── Loading skeleton ────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div style={{ padding: '12px 16px', background: BG, minHeight: '100%' }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{
          height: '62px', marginBottom: '7px', borderRadius: '7px',
          background: `linear-gradient(90deg, ${BG3} 25%, #e8ecf0 50%, ${BG3} 75%)`,
          backgroundSize: '400px 100%',
          animation: 'shimmer 1.4s infinite',
        }} />
      ))}
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '80px 20px', background: BG, minHeight: '400px',
    }}>
      <div style={{
        width: '56px', height: '56px', background: GB, border: `0.5px solid ${G}`,
        borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '16px',
      }}>
        <i className="ti ti-shield-check" style={{ fontSize: '24px', color: G }} />
      </div>
      <div style={{ fontSize: '16px', fontWeight: 500, color: TX, marginBottom: '8px' }}>
        No backup report received yet
      </div>
      <div style={{ fontSize: '13px', color: TX2, maxWidth: '340px', textAlign: 'center', lineHeight: 1.6 }}>
        The daily RMAN backup report will appear here once received from Gmail.
        Expected daily at 7:00–8:00&nbsp;AM (GMT+3).
      </div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function BackupPage() {
  const [data, setData] = useState<BackupSummaryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { document.title = 'EM Monitor — Backup Monitor' }, [])

  useEffect(() => {
    fetch('/api/backup-summary')
      .then(r => r.json())
      .then((d: BackupSummaryData) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSkeleton />
  if (!data?.latestDate) return <EmptyState />

  // Sort sections per spec
  const failed  = [...data.failed ].sort((a, b) => b.age_days - a.age_days)
  const delayed = [...data.delayed].sort((a, b) => b.age_days - a.age_days)
  const healthy = [...data.healthy].sort((a, b) => a.db_name.localeCompare(b.db_name))
  const ignored = [...data.ignored].sort((a, b) => b.age_days - a.age_days)

  const counts = [healthy.length, delayed.length, failed.length, ignored.length]

  // Healthy: show first 6, rest in footer
  const LIMIT = 6
  const healthyShow = healthy.slice(0, LIMIT)
  const healthyRest = healthy.length - LIMIT

  const total = failed.length + delayed.length + healthy.length + ignored.length

  return (
    <div style={{ padding: '12px 16px', background: BG, minHeight: '100%', animation: 'pgFade 0.2s' }}>

      {/* ── HEADER BAR ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 500, color: TX }}>RMAN Backup Status</div>
          <div style={{ fontSize: '10px', color: TX3, fontFamily: 'monospace', marginTop: '2px' }}>
            {data.latestDate}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
          {/* Backup report date pill */}
          {data.latestDate ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              background: GB, border: `0.5px solid ${G}`,
              borderRadius: '5px', padding: '3px 9px', fontSize: '11px', color: G,
            }}>
              <i className="ti ti-circle-check" style={{ fontSize: '11px' }} />
              <span style={{ fontFamily: 'monospace' }}>Backup · {data.latestDate}</span>
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              background: BG3, border: `0.5px solid ${BD}`,
              borderRadius: '5px', padding: '3px 9px', fontSize: '11px', color: TX3,
            }}>
              <i className="ti ti-clock" style={{ fontSize: '11px' }} />
              <span style={{ fontFamily: 'monospace' }}>No report</span>
            </div>
          )}
          {/* Export */}
          <button
            onClick={() => exportCSV(failed, delayed, healthy, ignored, data.latestDate!)}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              background: BG2, border: `0.5px solid ${BD}`, borderRadius: '6px',
              padding: '5px 12px', fontSize: '11px', color: TX2, cursor: 'pointer',
            }}
          >
            <i className="ti ti-download" style={{ fontSize: '11px' }} />
            Export
          </button>
        </div>
      </div>

      {/* ── STAT CARDS ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px', marginBottom: '12px' }}>
        {STATS.map((s, i) => (
          <div key={s.label} style={{
            background: BG2,
            border: `0.5px solid ${s.border}`,
            borderTop: `2px solid ${s.color}`,
            borderRadius: '8px',
            padding: '12px 13px',
            animation: `popIn 0.3s ${i * 0.07}s ease-out both`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <i className={`ti ${s.icon}`} style={{ fontSize: '13px', color: s.color }} />
              <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.6px', fontFamily: 'monospace', color: TX2 }}>
                {s.label}
              </span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 500, fontFamily: 'monospace', color: s.color, lineHeight: 1 }}>
              {counts[i]}
            </div>
            <div style={{ fontSize: '10px', fontFamily: 'monospace', color: TX3, marginTop: '4px' }}>
              {s.sub}
            </div>
          </div>
        ))}
      </div>

      {/* ── BODY GRID ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 210px', gap: '12px' }}>

        {/* LEFT COLUMN */}
        <div>

          {/* FAILED */}
          {failed.length > 0 && (
            <section style={{ marginBottom: '10px' }}>
              <SectionHeader icon="ti-alert-circle" label="FAILED — IMMEDIATE ACTION" count={failed.length} color={R} bg={RB} border={R} />
              <div style={{ border: `0.5px solid ${R}`, borderTop: 'none', borderRadius: '0 0 6px 6px', background: BG2, overflow: 'hidden' }}>
                {failed.map((row, i) => (
                  <div key={row.id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px',
                    borderBottom: i < failed.length - 1 ? `0.5px solid ${BG3}` : 'none',
                    animation: `slideUp 0.3s ${i * 0.035}s ease-out both`,
                  }}>
                    <img src="/icons/backup/failed.png" width={46} height={46} alt="failed" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: TX, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.db_name}
                      </div>
                      {row.backup_type && (
                        <div style={{ fontSize: '10px', color: TX2, marginTop: '2px' }}>{row.backup_type}</div>
                      )}
                    </div>
                    <Badge text="FAILED" color={R} bg={RB} border={R} />
                    <span style={{ fontSize: '11px', fontFamily: 'monospace', color: TX3, minWidth: '36px', textAlign: 'right' }}>
                      {row.age_days}d
                    </span>
                    <span style={{ fontSize: '11px', fontFamily: 'monospace', color: R, minWidth: '52px', textAlign: 'right' }}>
                      fix NOW
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* DELAYED */}
          {delayed.length > 0 && (
            <section style={{ marginBottom: '10px' }}>
              <SectionHeader icon="ti-clock" label="DELAYED — MONITOR CLOSELY" count={delayed.length} color={A} bg={AB} border={A} />
              <div style={{ border: `0.5px solid ${A}`, borderTop: 'none', borderRadius: '0 0 6px 6px', background: BG2, overflow: 'hidden' }}>
                {delayed.map((row, i) => (
                  <div key={row.id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px',
                    borderBottom: i < delayed.length - 1 ? `0.5px solid ${BG3}` : 'none',
                    animation: `slideUp 0.3s ${i * 0.035}s ease-out both`,
                  }}>
                    <img src="/icons/backup/delayed.png" width={46} height={46} alt="delayed" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: TX, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.db_name}
                      </div>
                      {row.backup_type && (
                        <div style={{ fontSize: '10px', color: TX2, marginTop: '2px' }}>{row.backup_type}</div>
                      )}
                    </div>
                    <Badge text="DELAYED" color={A} bg={AB} border={A} />
                    <span style={{ fontSize: '11px', fontFamily: 'monospace', color: TX3, minWidth: '36px', textAlign: 'right' }}>
                      {row.age_days}d
                    </span>
                    <span style={{ fontSize: '11px', fontFamily: 'monospace', color: A, minWidth: '52px', textAlign: 'right' }}>
                      monitor
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* HEALTHY */}
          {healthy.length > 0 && (
            <section style={{ marginBottom: '10px' }}>
              <SectionHeader icon="ti-shield-check" label="HEALTHY — BACKED UP TODAY" count={healthy.length} color={G} bg={GB} border={G} />
              <div style={{ border: `0.5px solid ${G}`, borderTop: 'none', borderRadius: '0 0 6px 6px', background: BG2, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                  {healthyShow.map((row, i) => (
                    <div key={row.id} style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                      borderBottom: i < healthyShow.length - (healthyShow.length % 2 === 0 ? 2 : 1) ? `0.5px solid ${BG3}` : 'none',
                      borderRight: i % 2 === 0 ? `0.5px solid ${BG3}` : 'none',
                      animation: `popIn 0.3s ${i * 0.025}s ease-out both`,
                    }}>
                      <img src="/icons/backup/healthy.png" width={38} height={38} alt="healthy" style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: 500, color: TX, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.db_name}
                        </div>
                        <div style={{ fontSize: '10px', color: TX2, marginTop: '1px' }}>
                          {row.backup_type || 'DB FULL'}{row.start_time ? ` · ${fmtTime(row.start_time)}` : ''}
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: G, flexShrink: 0 }}>
                        0d ✓
                      </span>
                    </div>
                  ))}
                </div>
                {healthyRest > 0 && (
                  <div style={{ padding: '8px 12px', borderTop: `0.5px solid ${BG3}`, fontSize: '10px', color: TX3, fontFamily: 'monospace', textAlign: 'center' }}>
                    + {healthyRest} more healthy databases
                  </div>
                )}
              </div>
            </section>
          )}

          {/* IGNORED */}
          {ignored.length > 0 && (
            <section>
              <SectionHeader icon="ti-minus-circle" label="IGNORED — NOT TRACKED" count={ignored.length} color='#9CA3AF' bg='#F9FAFB' border='#E0E0E0' />
              <div style={{ border: `0.5px solid ${BD}`, borderTop: 'none', borderRadius: '0 0 6px 6px', background: BG2, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
                  {ignored.map((row, i) => (
                    <div key={row.id} style={{
                      padding: '8px 12px',
                      borderBottom: i < ignored.length - 3 ? `0.5px solid ${BG3}` : 'none',
                      borderRight: i % 3 !== 2 ? `0.5px solid ${BG3}` : 'none',
                    }}>
                      <div style={{ fontSize: '11px', fontWeight: 500, color: TX2, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.db_name}
                      </div>
                      <div style={{ fontSize: '10px', color: TX3, marginTop: '1px' }}>
                        {row.backup_type || 'UNKNOWN'} · {row.age_days}d
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* If truly nothing */}
          {failed.length === 0 && delayed.length === 0 && healthy.length === 0 && ignored.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: TX3, fontSize: '13px' }}>
              No backup records for this date.
            </div>
          )}

        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

          {/* Panel 1: Donut + legend */}
          <Panel title="Distribution">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
              <DonutChart h={healthy.length} d={delayed.length} f={failed.length} i={ignored.length} />
            </div>
            {[
              { label: 'Healthy', count: healthy.length, color: G  },
              { label: 'Delayed', count: delayed.length, color: A  },
              { label: 'Failed',  count: failed.length,  color: R  },
              { label: 'Ignored', count: ignored.length, color: BD },
            ].map(seg => (
              <div key={seg.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: seg.color, flexShrink: 0, display: 'inline-block' }} />
                  <span style={{ fontSize: '10px', color: TX2 }}>{seg.label}</span>
                </div>
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: TX, fontWeight: 500 }}>
                  {seg.count}
                </span>
              </div>
            ))}
          </Panel>

          {/* Panel 2: Age indicator */}
          <Panel title="Age Indicator">
            {[
              { label: 'Today (0d)',  count: healthy.length, color: G  },
              { label: '1–89 days',  count: delayed.length, color: A  },
              { label: '90+ days',   count: ignored.length, color: BD },
            ].map(dot => (
              <div key={dot.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: dot.color, flexShrink: 0, display: 'inline-block' }} />
                <span style={{ fontSize: '10px', color: TX2, flex: 1 }}>{dot.label}</span>
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: TX, fontWeight: 500 }}>{dot.count}</span>
              </div>
            ))}
            {/* Stacked bar */}
            <div style={{ height: '4px', borderRadius: '2px', background: BG3, overflow: 'hidden', display: 'flex', marginTop: '4px' }}>
              {total > 0 && (
                <>
                  <div style={{ width: `${(healthy.length/total)*100}%`, background: G }} />
                  <div style={{ width: `${(delayed.length/total)*100}%`, background: A }} />
                  <div style={{ width: `${(ignored.length/total)*100}%`, background: BD }} />
                </>
              )}
            </div>
          </Panel>

          {/* Panel 3: Report info + Export */}
          <ReportInfoPanel
            reportInfo={data.reportInfo}
            total={total}
            onExport={() => exportCSV(failed, delayed, healthy, ignored, data.latestDate!)}
          />

        </div>
      </div>
    </div>
  )
}

// ─── Report info panel ────────────────────────────────────────────────────────
function ReportInfoPanel({
  reportInfo,
  total,
  onExport,
}: {
  reportInfo: BackupReportInfo | null
  total: number
  onExport: () => void
}) {
  const timeStr = reportInfo?.receivedAt ? fmtTime(reportInfo.receivedAt) : 'N/A'

  return (
    <div style={{ background: BG2, border: `0.5px solid ${BD}`, borderRadius: '8px', padding: '12px' }}>
      <div style={{ fontSize: '9px', textTransform: 'uppercase' as const, letterSpacing: '0.7px', color: TX3, fontFamily: 'monospace', marginBottom: '10px' }}>
        Report Info
      </div>
      {[
        { label: 'DATE',   value: reportInfo?.date || '—' },
        { label: 'TIME',   value: timeStr },
        { label: 'COUNT',  value: `${total} databases` },
        { label: 'SOURCE', value: (reportInfo?.source || 'gmail').toUpperCase() },
      ].map(item => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '9px', color: TX3, fontFamily: 'monospace', textTransform: 'uppercase' as const }}>{item.label}</span>
          <span style={{ fontSize: '11px', color: TX, fontFamily: 'monospace' }}>{item.value}</span>
        </div>
      ))}
      <button
        onClick={onExport}
        style={{
          width: '100%', marginTop: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
          background: BG3, border: `0.5px solid ${BD}`, borderRadius: '6px',
          padding: '7px', fontSize: '11px', color: TX2, cursor: 'pointer',
        }}
      >
        <i className="ti ti-download" style={{ fontSize: '11px' }} />
        Export CSV
      </button>
    </div>
  )
}
