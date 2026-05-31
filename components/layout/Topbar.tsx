'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { ToastMessage } from '@/types'

interface TopbarProps {
  userInitials?: string
  notificationCount?: number
  reportTime?: string | null
  backupReportTime?: string | null
  toast?: ToastMessage | null
}

const PAGE_INFO: Record<string, { icon: string; label: string }> = {
  '/dashboard':                  { icon: 'ti-home',         label: 'Overview' },
  '/dashboard/tablespaces':      { icon: 'ti-database',     label: 'Tablespaces' },
  '/dashboard/analytics':        { icon: 'ti-chart-line',   label: 'Analytics' },
  '/dashboard/backup':           { icon: 'ti-shield-check', label: 'Backup Monitor' },
  '/dashboard/settings':         { icon: 'ti-settings-2',   label: 'Settings' },
  '/dashboard/notifications':    { icon: 'ti-bell',         label: 'Notifications' },
}

export function Topbar({
  userInitials = 'HH',
  notificationCount = 0,
  reportTime = null,
  backupReportTime = null,
  toast = null,
}: TopbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [currentToast, setCurrentToast] = useState<ToastMessage | null>(toast)

  useEffect(() => {
    if (toast) {
      setCurrentToast(toast)
      const timer = setTimeout(() => setCurrentToast(null), 2800)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // Determine page info
  let pageInfo = PAGE_INFO[pathname] || { icon: 'ti-home', label: 'Overview' }
  let dbName: string | null = null

  if (pathname.startsWith('/dashboard/tablespaces/') && pathname !== '/dashboard/tablespaces') {
    const seg = pathname.split('/').pop() || ''
    dbName = seg.toUpperCase()
    pageInfo = { icon: 'ti-database', label: 'Tablespaces' }
  }

  const toastStyle = currentToast
    ? {
        ok: { background: 'var(--hlb)', color: 'var(--hl)', border: '0.5px solid var(--hl)' },
        wa: { background: 'var(--wab)', color: 'var(--wa)', border: '0.5px solid var(--wa)' },
        cr: { background: 'var(--crb)', color: 'var(--cr)', border: '0.5px solid var(--cr)' },
      }[currentToast.type]
    : null

  return (
    <div
      style={{
        background: 'var(--bg3)',
        borderBottom: '0.5px solid var(--bdv)',
        padding: '0 16px',
        height: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}
    >
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--tx3)' }}>
        <i className={`ti ${pageInfo.icon}`} style={{ fontSize: '12px' }} />
        <span>{pageInfo.label}</span>
        {dbName && (
          <>
            <span style={{ color: 'var(--tx3)' }}>›</span>
            <span style={{ color: 'var(--txv)', fontFamily: 'monospace' }}>{dbName}</span>
          </>
        )}
      </div>

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
        {/* Toast */}
        {currentToast && toastStyle && (
          <div
            style={{
              fontSize: '11px',
              padding: '3px 10px',
              borderRadius: '5px',
              animation: 'popIn 0.2s',
              ...toastStyle,
            }}
          >
            {currentToast.text}
          </div>
        )}

        {/* Report status */}
        <div
          onClick={() => router.push('/dashboard/notifications')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            color: reportTime ? 'var(--Gv)' : 'var(--tx3)',
            background: reportTime ? 'var(--Gd)' : 'var(--bg4)',
            border: `0.5px solid ${reportTime ? 'var(--Gl)' : 'var(--bdv)'}`,
            padding: '3px 9px',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          <i
            className={`ti ${reportTime ? 'ti-circle-check' : 'ti-clock'}`}
            style={{ fontSize: '11px' }}
          />
          <span className="mn" style={{ fontSize: '11px' }}>
            {reportTime ? `Report · ${reportTime}` : 'No report'}
          </span>
        </div>

        {/* Backup report status */}
        {backupReportTime && (
          <div
            onClick={() => router.push('/dashboard/backup')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              color: 'var(--Gv)',
              background: 'var(--Gd)',
              border: '0.5px solid var(--Gl)',
              padding: '3px 9px',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            <i className="ti ti-shield-check" style={{ fontSize: '11px' }} />
            <span className="mn" style={{ fontSize: '11px' }}>
              Backup · {backupReportTime}
            </span>
          </div>
        )}

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Bell with badge */}
        <div onClick={() => router.push('/dashboard/notifications')} style={{ position: 'relative', cursor: 'pointer' }}>
          <i className="ti ti-bell" style={{ fontSize: '16px', color: 'var(--tx2)' }} />
          {notificationCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-5px',
                background: 'var(--cr)',
                color: '#fff',
                fontSize: '9px',
                fontWeight: 500,
                borderRadius: '8px',
                padding: '1px 4px',
              }}
            >
              {notificationCount}
            </span>
          )}
        </div>

        {/* Avatar */}
        <div
          onClick={() => router.push('/dashboard/settings')}
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            background: 'var(--Gd)',
            border: '0.5px solid var(--Gv)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--Gv)',
            fontSize: '9px',
            fontWeight: 500,
            fontFamily: 'monospace',
            cursor: 'pointer',
          }}
        >
          {userInitials}
        </div>
      </div>
    </div>
  )
}
