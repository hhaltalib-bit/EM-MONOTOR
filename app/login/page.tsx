'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import OrbitRings from '@/components/OrbitRings'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [isDark, setIsDark]     = useState(false)
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

  const green  = isDark ? '#4ade80' : '#16a34a'
  const greenDim = isDark ? 'rgba(74,222,128,0.7)' : '#16a34a'

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      fontFamily: 'system-ui, sans-serif',
      animation: 'pgFade 0.3s',
    }}>

      {/* ── LEFT PANEL ──────────────────────────────────────── */}
      <div style={{
        flex: 1,
        background: isDark ? '#040C08' : '#F7FDF9',
        position: 'relative',
        overflow: 'hidden',
      }}>

        {/* Grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            linear-gradient(rgba(22,163,74,${isDark ? '0.08' : '0.07'}) 1px, transparent 1px),
            linear-gradient(90deg, rgba(22,163,74,${isDark ? '0.08' : '0.07'}) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px',
          pointerEvents: 'none',
        }}/>

        {/* Scanline */}
        <div style={{
          position: 'absolute', left: 0, right: 0, height: '2px',
          background: `linear-gradient(90deg, transparent, rgba(22,163,74,${isDark ? '0.2' : '0.15'}), transparent)`,
          animation: 'em-scanline 5s linear infinite',
          pointerEvents: 'none', zIndex: 1,
        }}/>

        {/* Orb top-right */}
        <div style={{
          position: 'absolute', top: '-80px', right: '-80px',
          width: '300px', height: '300px', borderRadius: '50%',
          background: `radial-gradient(circle, rgba(22,163,74,${isDark ? '0.18' : '0.12'}) 0%, transparent 65%)`,
          animation: 'em-glow 3s ease-in-out infinite',
          pointerEvents: 'none',
        }}/>

        {/* Orb bottom-left */}
        <div style={{
          position: 'absolute', bottom: '-60px', left: '-60px',
          width: '200px', height: '200px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(14,165,233,0.08) 0%, transparent 65%)',
          animation: 'em-glow 4s ease-in-out infinite 1s',
          pointerEvents: 'none',
        }}/>

        {/* SVG flow lines */}
        <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%' }}
          viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="em-lg" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="rgba(22,163,74,0)"/>
              <stop offset="50%"  stopColor={isDark ? 'rgba(22,163,74,0.35)' : 'rgba(22,163,74,0.2)'}/>
              <stop offset="100%" stopColor="rgba(22,163,74,0)"/>
            </linearGradient>
          </defs>
          <line x1="0" y1="150" x2="400" y2="150" stroke="rgba(22,163,74,0.07)" strokeWidth="1"/>
          <line x1="0" y1="300" x2="400" y2="300" stroke="rgba(22,163,74,0.06)" strokeWidth="1"/>
          <line x1="0" y1="450" x2="400" y2="450" stroke="rgba(22,163,74,0.05)" strokeWidth="1"/>
          <line x1="200" y1="0"  x2="200" y2="600" stroke="rgba(22,163,74,0.06)" strokeWidth="1"/>
          <line x1="0" y1="200" x2="400" y2="200" stroke="url(#em-lg)" strokeWidth="1.5"
            strokeDasharray="80 120" style={{ animation: 'em-stream 3s linear infinite' }}/>
          <line x1="400" y1="380" x2="0" y2="380" stroke="url(#em-lg)" strokeWidth="1"
            strokeDasharray="60 140" style={{ animation: 'em-stream 4s linear infinite 1.5s' }}/>
        </svg>

        {/* Orbit rings — centered */}
        <OrbitRings dark={isDark} />

        {/* Floating card — top-left */}
        <div style={{
          position: 'absolute', top: '44px', left: '16px',
          background: isDark ? 'rgba(4,12,8,0.85)' : '#ffffff',
          border: `0.5px solid rgba(22,163,74,${isDark ? '0.35' : '0.25'})`,
          borderRadius: '10px', padding: '10px 13px',
          animation: 'em-float-a 3.5s ease-in-out infinite',
          backdropFilter: isDark ? 'blur(6px)' : 'none',
          boxShadow: isDark ? 'none' : '0 4px 14px rgba(22,163,74,0.08)',
        }}>
          <i className="ti ti-eye" style={{ fontSize:'14px', color: green }}/>
          <div style={{ fontSize:'13px', fontWeight:500, color: isDark ? '#fff' : '#111', marginTop:'4px' }}>Real-time</div>
          <div style={{ fontSize:'10px', color: greenDim, fontFamily:'monospace' }}>Live monitoring</div>
        </div>

        {/* Floating card — top-right */}
        <div style={{
          position: 'absolute', top: '44px', right: '16px',
          background: isDark ? 'rgba(4,12,8,0.85)' : '#ffffff',
          border: `0.5px solid rgba(22,163,74,${isDark ? '0.35' : '0.25'})`,
          borderRadius: '10px', padding: '10px 13px',
          animation: 'em-float-b 4s ease-in-out infinite 0.8s',
          backdropFilter: isDark ? 'blur(6px)' : 'none',
          boxShadow: isDark ? 'none' : '0 4px 14px rgba(22,163,74,0.08)',
        }}>
          <i className="ti ti-bell-ringing" style={{ fontSize:'14px', color: green }}/>
          <div style={{ fontSize:'13px', fontWeight:500, color: isDark ? '#fff' : '#111', marginTop:'4px' }}>Auto Alert</div>
          <div style={{ fontSize:'10px', color: greenDim, fontFamily:'monospace' }}>Email &amp; notify</div>
        </div>

        {/* Floating card — bottom-left */}
        <div style={{
          position: 'absolute', bottom: '44px', left: '16px',
          background: isDark ? 'rgba(4,12,8,0.85)' : '#ffffff',
          border: `0.5px solid rgba(22,163,74,${isDark ? '0.35' : '0.25'})`,
          borderRadius: '10px', padding: '10px 13px',
          animation: 'em-float-c 3s ease-in-out infinite 1.2s',
          backdropFilter: isDark ? 'blur(6px)' : 'none',
          boxShadow: isDark ? 'none' : '0 4px 14px rgba(22,163,74,0.08)',
        }}>
          <i className="ti ti-mail-forward" style={{ fontSize:'14px', color: green }}/>
          <div style={{ fontSize:'13px', fontWeight:500, color: isDark ? '#fff' : '#111', marginTop:'4px' }}>Auto Ingest</div>
          <div style={{ fontSize:'10px', color: greenDim, fontFamily:'monospace' }}>Gmail → System</div>
        </div>

        {/* Floating card — bottom-right */}
        <div style={{
          position: 'absolute', bottom: '44px', right: '16px',
          background: isDark ? 'rgba(4,12,8,0.85)' : '#ffffff',
          border: `0.5px solid rgba(22,163,74,${isDark ? '0.35' : '0.25'})`,
          borderRadius: '10px', padding: '10px 13px',
          animation: 'em-float-a 3.8s ease-in-out infinite 0.4s',
          backdropFilter: isDark ? 'blur(6px)' : 'none',
          boxShadow: isDark ? 'none' : '0 4px 14px rgba(22,163,74,0.08)',
        }}>
          <i className="ti ti-chart-line" style={{ fontSize:'14px', color: green }}/>
          <div style={{ fontSize:'13px', fontWeight:500, color: isDark ? '#fff' : '#111', marginTop:'4px' }}>30-day</div>
          <div style={{ fontSize:'10px', color: greenDim, fontFamily:'monospace' }}>Growth trends</div>
        </div>

        {/* Terminal line */}
        <div style={{
          position: 'absolute', bottom: '14px', left: '16px', right: '16px',
          fontSize: '10px', color: 'rgba(22,163,74,0.55)',
          fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <span style={{ color: isDark ? 'rgba(22,163,74,0.8)' : '#16a34a' }}>›</span>
          <span>system.status = OPERATIONAL</span>
          <span style={{ animation: 'em-blink 1s step-end infinite' }}>_</span>
        </div>

        {/* All animations */}
        <style>{`
          @keyframes em-scanline  { 0%     { top: -2px;   } 100%      { top: 100%;       } }
          @keyframes em-glow      { 0%,100%{ opacity:.6;  } 50%       { opacity:1;        } }
          @keyframes em-stream    { 0%     { stroke-dashoffset:200; } 100% { stroke-dashoffset:0; } }
          @keyframes em-float-a   { 0%,100%{ transform:translateY(0);  } 50% { transform:translateY(-6px); } }
          @keyframes em-float-b   { 0%,100%{ transform:translateY(0);  } 50% { transform:translateY(-5px); } }
          @keyframes em-float-c   { 0%,100%{ transform:translateY(0);  } 50% { transform:translateY(-4px); } }
          @keyframes em-blink     { 0%,100%{ opacity:1; } 50% { opacity:0; } }
          @keyframes pgFade       { from { opacity:0; } to { opacity:1; } }
          @keyframes slideUp      { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }
        `}</style>
      </div>

      {/* ── RIGHT PANEL (login form) ─────────────────────────── */}
      <div style={{
        width: '310px',
        background: isDark ? '#0A0F0B' : '#ffffff',
        borderLeft: `0.5px solid rgba(22,163,74,${isDark ? '0.15' : '0.15'})`,
        display: 'flex',
        flexDirection: 'column',
        padding: '32px',
        animation: 'slideUp 0.5s 0.1s ease-out both',
      }}>

        {/* Theme toggle */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '28px' }}>
          <button
            onClick={() => setIsDark(d => !d)}
            style={{
              background: 'none',
              border: `1px solid rgba(22,163,74,${isDark ? '0.3' : '0.25'})`,
              borderRadius: '6px',
              padding: '5px 11px',
              cursor: 'pointer',
              color: isDark ? '#4ade80' : '#16a34a',
              fontSize: '11px',
              fontFamily: 'monospace',
              letterSpacing: '0.03em',
            }}
          >
            {isDark ? '☀ Light' : '◑ Dark'}
          </button>
        </div>

        {/* Welcome text */}
        <div style={{ marginBottom: '26px' }}>
          <div style={{ fontSize: '20px', fontWeight: 500, color: isDark ? '#ffffff' : '#111827', marginBottom: '5px', letterSpacing: '-0.3px' }}>
            Welcome back
          </div>
          <div style={{ fontSize: '13px', color: isDark ? '#666666' : '#6b7280' }}>
            Sign in to your dashboard
          </div>
        </div>

        <form onSubmit={handleSignIn}>
          {/* Username */}
          <div style={{ marginBottom: '13px' }}>
            <div style={{
              fontSize: '10px',
              color: isDark ? '#555555' : '#9ca3af',
              marginBottom: '6px',
              fontFamily: 'monospace',
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
            }}>
              Username
            </div>
            <input
              className="inp-f"
              type="text"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={isDark ? {
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#888888',
                borderRadius: '8px',
                padding: '9px 12px',
                width: '100%',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              } : undefined}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: '6px' }}>
            <div style={{
              fontSize: '10px',
              color: isDark ? '#555555' : '#9ca3af',
              marginBottom: '6px',
              fontFamily: 'monospace',
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
            }}>
              Password
            </div>
            <input
              className="inp-f"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={isDark ? {
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#888888',
                borderRadius: '8px',
                padding: '9px 12px',
                width: '100%',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              } : undefined}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              color: '#f85149',
              fontSize: '11px',
              padding: '8px 12px',
              background: 'rgba(248,81,73,0.1)',
              border: '0.5px solid #f85149',
              borderRadius: '6px',
              marginBottom: '10px',
              marginTop: '8px',
              animation: 'slideUp 0.2s',
            }}>
              {error}
            </div>
          )}

          {/* Sign in button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: '#16a34a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '11px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              marginTop: '14px',
              opacity: loading ? 0.7 : 1,
              transition: 'opacity 0.15s',
              boxShadow: isDark ? '0 0 20px rgba(22,163,74,0.3)' : 'none',
            }}
          >
            {loading ? 'Signing in...' : 'Sign in to Dashboard →'}
          </button>
        </form>

        {/* Demo hint */}
        <div style={{
          textAlign: 'center',
          marginTop: '20px',
          fontSize: '10px',
          color: isDark ? '#333333' : '#d1d5db',
          fontFamily: 'monospace',
        }}>
          demo mode · any credentials
        </div>
      </div>
    </div>
  )
}
