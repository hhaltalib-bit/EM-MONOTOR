'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import OrbitRings from '@/components/OrbitRings'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!username.trim() || !password.trim()) {
      setError('Enter both username and password to continue.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: username,
      password,
    })

    if (error) {
      setError(error.message || 'Invalid credentials. Please try again.')
      setLoading(false)
      return
    }

    if (data.session) {
      window.location.href = '/dashboard'
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        fontFamily: 'system-ui, sans-serif',
        animation: 'pgFade 0.3s',
      }}
    >
      {/* LEFT SIDE: Branding */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          background: '#ffffff',
          animation: 'slideUp 0.5s ease-out both',
        }}
      >
        {/* Green grid background */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            linear-gradient(rgba(22,163,74,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(22,163,74,0.06) 1px, transparent 1px)
          `,
          backgroundSize: '28px 28px',
          pointerEvents: 'none',
          zIndex: 0,
        }}/>

        {/* Left fade for text readability */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 20% 50%, rgba(255,255,255,0.95) 30%, transparent 75%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}/>

        {/* Green orb top-right */}
        <div style={{
          position: 'absolute', right: '-60px', top: '-60px',
          width: '320px', height: '320px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(22,163,74,0.12) 0%, transparent 65%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}/>

        {/* Blue orb bottom-right */}
        <div style={{
          position: 'absolute', right: '80px', bottom: '-80px',
          width: '200px', height: '200px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(14,165,233,0.08) 0%, transparent 65%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}/>

        {/* Content */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          height: '100%',
          padding: '48px 44px',
        }}>
          {/* Logo + product name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '11px', marginBottom: '44px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                background: 'rgba(22,163,74,0.1)',
                border: '0.5px solid #16a34a',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <i className="ti ti-database-cog" style={{ color: '#16a34a', fontSize: '19px' }} />
            </div>
            <div>
              <div style={{ fontSize: '17px', fontWeight: 500, color: '#111827' }}>EM MONITOR</div>
              <div style={{ fontSize: '10px', color: '#16a34a', fontFamily: 'monospace', marginTop: '1px' }}>
                Enterprise Edition
              </div>
            </div>
          </div>

          {/* Main heading */}
          <div
            style={{
              fontSize: '26px',
              fontWeight: 500,
              color: '#111827',
              marginBottom: '8px',
              letterSpacing: '-0.5px',
              lineHeight: 1.2,
            }}
          >
            Complete Oracle<br />Tablespace Monitoring
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: '13px',
              color: '#6b7280',
              marginBottom: '36px',
              lineHeight: 1.7,
            }}
          >
            Real-time visibility into your entire<br />database fleet — all in one place.
          </div>

          {/* Feature list */}
          {[
            { icon: 'ti-activity-heartbeat', text: 'Live monitoring across 20+ databases' },
            { icon: 'ti-bell-ringing',        text: 'Instant alerts for critical tablespaces' },
            { icon: 'ti-chart-area-line',     text: '30-day growth trend analytics' },
            { icon: 'ti-shield-check',        text: 'Secure multi-user access control' },
          ].map((item) => (
            <div
              key={item.icon}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '13px' }}
            >
              <i
                className={`ti ${item.icon}`}
                style={{ fontSize: '16px', color: '#16a34a', flexShrink: 0 }}
              />
              <span style={{ fontSize: '12px', color: '#6b7280' }}>{item.text}</span>
            </div>
          ))}
        </div>

        {/* Orbit Rings — sits at right-center of left panel */}
        <OrbitRings />
      </div>

      {/* RIGHT SIDE: Login form */}
      <div
        style={{
          width: '310px',
          background: 'var(--bg3)',
          borderLeft: '0.5px solid var(--bdv)',
          display: 'flex',
          flexDirection: 'column',
          padding: '32px',
          animation: 'slideUp 0.5s 0.1s ease-out both',
        }}
      >
        {/* Theme toggle — top right */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '28px' }}>
          <ThemeToggle />
        </div>

        {/* Welcome text */}
        <div style={{ marginBottom: '26px' }}>
          <div style={{ fontSize: '20px', fontWeight: 500, color: 'var(--txv)', marginBottom: '5px', letterSpacing: '-0.3px' }}>
            Welcome back
          </div>
          <div style={{ fontSize: '13px', color: 'var(--tx2)' }}>Sign in to your dashboard</div>
        </div>

        <form onSubmit={handleSignIn}>
          {/* Username */}
          <div style={{ marginBottom: '13px' }}>
            <div
              style={{
                fontSize: '10px',
                color: 'var(--tx3)',
                marginBottom: '6px',
                fontFamily: 'monospace',
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
              }}
            >
              Username
            </div>
            <input
              className="inp-f"
              type="text"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: '6px' }}>
            <div
              style={{
                fontSize: '10px',
                color: 'var(--tx3)',
                marginBottom: '6px',
                fontFamily: 'monospace',
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
              }}
            >
              Password
            </div>
            <input
              className="inp-f"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {/* Error message */}
          {error && (
            <div
              style={{
                color: 'var(--cr)',
                fontSize: '11px',
                padding: '8px 12px',
                background: 'var(--crb)',
                border: '0.5px solid var(--cr)',
                borderRadius: '6px',
                marginBottom: '10px',
                marginTop: '8px',
                animation: 'slideUp 0.2s',
              }}
            >
              {error}
            </div>
          )}

          {/* Sign in button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: 'var(--Gv)',
              color: '#080c14',
              border: 'none',
              borderRadius: '8px',
              padding: '11px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              marginTop: '14px',
              opacity: loading ? 0.7 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {loading ? 'Signing in...' : 'Sign in to Dashboard →'}
          </button>
        </form>

        {/* Demo hint */}
        <div
          style={{
            textAlign: 'center',
            marginTop: '20px',
            fontSize: '10px',
            color: 'var(--tx3)',
            fontFamily: 'monospace',
          }}
        >
          demo mode · any credentials
        </div>
      </div>
    </div>
  )
}
