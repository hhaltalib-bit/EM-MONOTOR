'use client'

import { useEffect, useState } from 'react'
import { Card, btnPrimaryStyle } from '@/components/analytics/ui'

const BACKFILL_START_DATE = '2026-05-12'

interface BackfillState {
  running: boolean
  total: number
  current: number
  currentDate: string | null
  done: boolean
  rowsWritten: number
  error: string | null
}

const initialState: BackfillState = {
  running: false, total: 0, current: 0, currentDate: null, done: false, rowsWritten: 0, error: null,
}

function buildDateRange(startStr: string): string[] {
  const dates: string[] = []
  const start = new Date(`${startStr}T00:00:00Z`)
  const today = new Date()
  const end = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

export function BackfillPanel() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [checked, setChecked] = useState(false)
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<BackfillState>(initialState)

  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => setIsAdmin(r.ok))
      .catch(() => setIsAdmin(false))
      .finally(() => setChecked(true))
  }, [])

  async function runBackfill() {
    const dates = buildDateRange(BACKFILL_START_DATE)
    setState({ running: true, total: dates.length, current: 0, currentDate: null, done: false, rowsWritten: 0, error: null })

    let written = 0
    for (let i = 0; i < dates.length; i++) {
      const date = dates[i]
      setState(prev => ({ ...prev, current: i + 1, currentDate: date }))
      try {
        const res = await fetch('/api/analytics/backfill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ date }),
        })
        const data = await res.json()
        if (!res.ok || data.ok === false) throw new Error(data.error ?? `HTTP ${res.status}`)
        written += data.rowsWritten ?? 0
        await new Promise(resolve => setTimeout(resolve, 200))
      } catch (e) {
        setState(prev => ({ ...prev, running: false, error: `Failed on ${date}: ${String(e instanceof Error ? e.message : e)}` }))
        return
      }
    }

    setState({ running: false, done: true, total: dates.length, current: dates.length, currentDate: null, rowsWritten: written, error: null })
  }

  if (!checked || !isAdmin) return null

  return (
    <Card style={{ marginTop: '24px' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="ti ti-database-cog" style={{ fontSize: '15px', color: 'var(--Gv)' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--txv)' }}>Analytics Data</span>
        </div>
        <i className={`ti ${open ? 'ti-chevron-up' : 'ti-chevron-down'}`} style={{ fontSize: '15px', color: 'var(--tx3)' }} />
      </div>

      {open && (
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--bdv)' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--txv)', marginBottom: '4px' }}>Historical Data Backfill</div>
          <div style={{ fontSize: '12px', color: 'var(--tx2)', marginBottom: '14px', lineHeight: 1.5 }}>
            Populate analytics tables from existing tablespace history. Run once after first deploy.
          </div>

          <button style={btnPrimaryStyle} onClick={runBackfill} disabled={state.running}>
            <i className="ti ti-player-play" />
            {state.running ? 'Running…' : 'Run Backfill'}
          </button>

          {state.running && (
            <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--tx2)', fontFamily: 'monospace' }}>
              Processing date {state.current} of {state.total} — {state.currentDate}
            </div>
          )}

          {state.done && (
            <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--hl)' }}>
              ✅ Complete — {state.total} dates processed, {state.rowsWritten} rows written
            </div>
          )}

          {state.error && (
            <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--cr)' }}>
              ❌ {state.error} — check Vercel logs
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
