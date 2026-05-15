'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { DatabaseSummary } from '@/types'
import { getSeverity } from '@/lib/utils/severity'
import { useThresholds } from '@/contexts/ThresholdContext'

interface SidebarProps {
  databases?: DatabaseSummary[]
}

const NAV_ITEMS = [
  { href: '/dashboard',               icon: 'ti-home',         label: 'Overview' },
  { href: '/dashboard/tablespaces',   icon: 'ti-database',     label: 'Tablespaces' },
  { href: '/dashboard/analytics',     icon: 'ti-chart-line',   label: 'Analytics' },
  { href: '/dashboard/backup',        icon: 'ti-shield-check', label: 'Backup Monitor' },
  { href: '/dashboard/settings',      icon: 'ti-settings-2',   label: 'Settings' },
]

export function Sidebar({ databases = [] }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const { warnThreshold, critThreshold } = useThresholds()

  const isOnTablespacePage = pathname.startsWith('/dashboard/tablespaces')

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div
      style={{
        width: collapsed ? '52px' : '196px',
        minWidth: collapsed ? '52px' : '196px',
        background: 'var(--bg3)',
        borderRight: '0.5px solid var(--bdv)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'width 0.2s, min-width 0.2s',
        flexShrink: 0,
      }}
    >
      {/* Logo area */}
      <div
        style={{
          padding: '13px 14px',
          borderBottom: '0.5px solid var(--bdv)',
          display: 'flex',
          alignItems: 'center',
          gap: '9px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: '30px',
            height: '30px',
            background: 'var(--Gd)',
            border: '0.5px solid var(--Gv)',
            borderRadius: '7px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <i className="ti ti-database-cog" style={{ color: 'var(--Gv)', fontSize: '14px' }} />
        </div>
        {!collapsed && (
          <div>
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--txv)' }}>EM MONITOR</div>
            <div style={{ fontSize: '9px', color: 'var(--Gv)', fontFamily: 'monospace', marginTop: '1px' }}>
              Enterprise v1.0
            </div>
          </div>
        )}
      </div>

      {/* Collapse button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          margin: '5px 8px 2px',
          background: 'var(--bg4)',
          border: '0.5px solid var(--bdv)',
          borderRadius: '5px',
          padding: '4px 8px',
          cursor: 'pointer',
          color: 'var(--tx2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '5px',
          fontSize: '10px',
        }}
      >
        <i
          className={`ti ${collapsed ? 'ti-layout-sidebar-left-expand' : 'ti-layout-sidebar-left-collapse'}`}
          style={{ fontSize: '13px' }}
        />
        {!collapsed && 'Collapse'}
      </button>

      {/* Navigation items */}
      <div style={{ padding: '3px 8px', flexShrink: 0 }}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className="si"
              style={{
                background: isActive ? 'var(--bg4)' : undefined,
                margin: '1px 0',
                textDecoration: 'none',
              }}
            >
              <i
                className={`ti ${item.icon}`}
                style={{
                  fontSize: '14px',
                  color: isActive ? 'var(--Gv)' : 'var(--tx2)',
                  flexShrink: 0,
                }}
              />
              {!collapsed && (
                <span
                  style={{
                    fontSize: '12px',
                    color: isActive ? 'var(--txv)' : 'var(--tx2)',
                    fontWeight: isActive ? 500 : 400,
                  }}
                >
                  {item.label}
                </span>
              )}
              {!collapsed && isActive && (
                <span
                  style={{
                    marginLeft: 'auto',
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    background: 'var(--Gv)',
                    display: 'inline-block',
                  }}
                />
              )}
            </Link>
          )
        })}
      </div>

      {/* DB sub-menu — shown when on tablespace pages */}
      {isOnTablespacePage && !collapsed && (
        <>
          <div style={{ flexShrink: 0, padding: '0 8px 2px' }}>
            <div
              style={{
                fontSize: '9px',
                color: 'var(--tx3)',
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                padding: '6px 10px 2px',
                fontFamily: 'monospace',
              }}
            >
              Databases · {databases.length}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
            {databases.map((db) => {
              const isDbActive = pathname === `/dashboard/tablespaces/${db.key}`
              const dbSeverity = getSeverity(db.worst_pct, warnThreshold, critThreshold)
              const dotCls =
                dbSeverity === 'critical' ? 'dot cr' :
                dbSeverity === 'warning'  ? 'dot wa' : 'dot hl'
              const countColor =
                dbSeverity === 'critical' ? 'var(--cr)' :
                dbSeverity === 'warning'  ? 'var(--wa)' : 'var(--hl)'

              return (
                <Link
                  key={db.key}
                  href={`/dashboard/tablespaces/${db.key}`}
                  className="dbi"
                  style={{ background: isDbActive ? 'var(--bg4)' : undefined, textDecoration: 'none' }}
                >
                  <span className={dotCls} />
                  <span
                    style={{
                      fontSize: '11px',
                      color: isDbActive ? 'var(--txv)' : 'var(--tx2)',
                      fontWeight: isDbActive ? 500 : 400,
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {db.name}
                  </span>
                  {db.critical_count > 0 && (
                    <span style={{ fontSize: '9px', color: countColor, fontFamily: 'monospace' }}>
                      {db.critical_count}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </>
      )}

      {!isOnTablespacePage && <div style={{ flex: 1 }} />}

      {/* Logout */}
      <div style={{ padding: '8px', borderTop: '0.5px solid var(--bdv)', flexShrink: 0 }}>
        <div className="si" onClick={handleLogout}>
          <i className="ti ti-logout" style={{ fontSize: '14px', color: 'var(--cr)' }} />
          {!collapsed && <span style={{ fontSize: '12px', color: 'var(--cr)' }}>Sign out</span>}
        </div>
      </div>
    </div>
  )
}
