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

  /* ── theme tokens ─────────────────────────────────────────── */
  const D = isDark

  // left panel cards
  const cardBg     = D ? 'rgba(4,12,8,0.92)'            : '#ffffff'
  const cardBorder = D ? '0.5px solid rgba(22,163,74,0.35)' : '0.5px solid rgba(22,163,74,0.25)'
  const cardShadow = D ? 'none'                          : '0 4px 14px rgba(22,163,74,0.08)'
  const cardIcon   = D ? '#4ade80'                       : '#16a34a'
  const cardTitle  = D ? '#ffffff'                       : '#111111'
  const cardSub    = D ? 'rgba(74,222,128,0.6)'          : '#16a34a'

  // right panel
  const rBg        = D ? '#0A0F0B'    : '#ffffff'
  const rBorder    = D ? 'rgba(22,163,74,0.15)' : 'rgba(22,163,74,0.12)'
  const logoBg     = D ? 'rgba(22,163,74,0.12)' : '#EAF3DE'
  const logoBrd    = D ? 'rgba(22,163,74,0.4)'  : '#639922'
  const logoStroke = D ? '#4ade80'    : '#3B6D11'
  const logoText   = D ? '#e0e0e0'    : '#111111'
  const badgeColor = D ? '#4ade80'    : '#639922'
  const headColor  = D ? '#ffffff'    : '#111111'
  const subColor   = D ? '#555555'    : '#888888'
  const labelColor = D ? '#444444'    : '#999999'
  const inpBg      = D ? 'rgba(255,255,255,0.03)' : '#F9F9F9'
  const inpBrd     = D ? 'rgba(255,255,255,0.08)' : '#E0E0E0'
  const inpColor   = D ? '#666666'    : '#666666'
  const btnShadow  = D ? '0 0 20px rgba(22,163,74,0.25)' : '0 3px 14px rgba(22,163,74,0.28)'
  const statusText = D ? '#333333'    : '#AAAAAA'
  const togBg      = D ? 'rgba(255,255,255,0.04)' : '#F5F5F5'
  const togBrd     = D ? 'rgba(255,255,255,0.08)' : '#E0E0E0'
  const togColor   = D ? '#555555'    : '#666666'

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      fontFamily: 'system-ui, sans-serif',
      animation: 'pgFade 0.3s',
    }}>

      {/* ── LEFT PANEL ──────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        background: D ? '#040C08' : '#F7FDF9',
        position: 'relative',
        overflow: 'hidden',
      }}>

        {/* Grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            linear-gradient(rgba(22,163,74,${D ? '0.08' : '0.07'}) 1px, transparent 1px),
            linear-gradient(90deg, rgba(22,163,74,${D ? '0.08' : '0.07'}) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px',
          pointerEvents: 'none',
        }}/>

        {/* Scanline */}
        <div style={{
          position: 'absolute', left: 0, right: 0, height: '2px',
          background: `linear-gradient(90deg, transparent, rgba(22,163,74,${D ? '0.2' : '0.15'}), transparent)`,
          animation: 'em-scanline 5s linear infinite',
          pointerEvents: 'none', zIndex: 1,
        }}/>

        {/* Orb 1 — top-right */}
        <div style={{
          position: 'absolute', top: '-100px', right: '-100px',
          width: '400px', height: '400px', borderRadius: '50%',
          background: `radial-gradient(circle, rgba(22,163,74,${D ? '0.18' : '0.10'}) 0%, transparent 65%)`,
          animation: 'em-glow 4s ease-in-out infinite',
          pointerEvents: 'none',
        }}/>

        {/* Orb 2 — bottom-left */}
        <div style={{
          position: 'absolute', bottom: '-80px', left: '-60px',
          width: '300px', height: '300px', borderRadius: '50%',
          background: `radial-gradient(circle, rgba(14,165,233,${D ? '0.10' : '0.06'}) 0%, transparent 65%)`,
          animation: 'em-glow 4s ease-in-out infinite 1.2s',
          pointerEvents: 'none',
        }}/>

        {/* SVG flow lines */}
        <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%' }}
          viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="em-lg" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="rgba(22,163,74,0)"/>
              <stop offset="50%"  stopColor={D ? 'rgba(22,163,74,0.35)' : 'rgba(22,163,74,0.18)'}/>
              <stop offset="100%" stopColor="rgba(22,163,74,0)"/>
            </linearGradient>
          </defs>
          <line x1="0" y1="150" x2="400" y2="150" stroke="rgba(22,163,74,0.07)" strokeWidth="1"/>
          <line x1="0" y1="300" x2="400" y2="300" stroke="rgba(22,163,74,0.06)" strokeWidth="1"/>
          <line x1="0" y1="450" x2="400" y2="450" stroke="rgba(22,163,74,0.05)" strokeWidth="1"/>
          <line x1="0" y1="200" x2="400" y2="200" stroke="url(#em-lg)" strokeWidth="1.5"
            strokeDasharray="80 120" style={{ animation:'em-stream 3s linear infinite' }}/>
          <line x1="400" y1="380" x2="0" y2="380" stroke="url(#em-lg)" strokeWidth="1"
            strokeDasharray="60 140" style={{ animation:'em-stream 4s linear infinite 1.5s' }}/>
          <line x1="0" y1="480" x2="400" y2="480" stroke="url(#em-lg)" strokeWidth="0.8"
            strokeDasharray="40 160" style={{ animation:'em-stream 5s linear infinite 0.7s' }}/>
        </svg>

        {/* Orbit rings — centered */}
        <OrbitRings dark={D} />

        {/* Card: top-left */}
        <div style={{
          position:'absolute', top:'40px', left:'14px',
          background:cardBg, border:cardBorder, borderRadius:'10px',
          padding:'9px 12px', backdropFilter: D ? 'blur(8px)' : 'none',
          boxShadow: cardShadow, animation:'em-float-a 3.5s ease-in-out infinite',
        }}>
          <i className="ti ti-eye" style={{ fontSize:'14px', color:cardIcon }}/>
          <div style={{ fontSize:'12px', fontWeight:500, color:cardTitle, marginTop:'4px' }}>Real-time</div>
          <div style={{ fontSize:'10px', color:cardSub, fontFamily:'monospace' }}>Live monitoring</div>
        </div>

        {/* Card: top-right */}
        <div style={{
          position:'absolute', top:'40px', right:'14px',
          background:cardBg, border:cardBorder, borderRadius:'10px',
          padding:'9px 12px', backdropFilter: D ? 'blur(8px)' : 'none',
          boxShadow: cardShadow, animation:'em-float-b 4s ease-in-out infinite 0.8s',
        }}>
          <i className="ti ti-bell-ringing" style={{ fontSize:'14px', color:cardIcon }}/>
          <div style={{ fontSize:'12px', fontWeight:500, color:cardTitle, marginTop:'4px' }}>Auto Alert</div>
          <div style={{ fontSize:'10px', color:cardSub, fontFamily:'monospace' }}>Email &amp; notify</div>
        </div>

        {/* Card: bottom-left */}
        <div style={{
          position:'absolute', bottom:'40px', left:'14px',
          background:cardBg, border:cardBorder, borderRadius:'10px',
          padding:'9px 12px', backdropFilter: D ? 'blur(8px)' : 'none',
          boxShadow: cardShadow, animation:'em-float-c 3s ease-in-out infinite 1.2s',
        }}>
          <i className="ti ti-mail-forward" style={{ fontSize:'14px', color:cardIcon }}/>
          <div style={{ fontSize:'12px', fontWeight:500, color:cardTitle, marginTop:'4px' }}>Auto Ingest</div>
          <div style={{ fontSize:'10px', color:cardSub, fontFamily:'monospace' }}>Gmail → System</div>
        </div>

        {/* Card: bottom-right */}
        <div style={{
          position:'absolute', bottom:'40px', right:'14px',
          background:cardBg, border:cardBorder, borderRadius:'10px',
          padding:'9px 12px', backdropFilter: D ? 'blur(8px)' : 'none',
          boxShadow: cardShadow, animation:'em-float-a 3.8s ease-in-out infinite 0.4s',
        }}>
          <i className="ti ti-chart-line" style={{ fontSize:'14px', color:cardIcon }}/>
          <div style={{ fontSize:'12px', fontWeight:500, color:cardTitle, marginTop:'4px' }}>30-day</div>
          <div style={{ fontSize:'10px', color:cardSub, fontFamily:'monospace' }}>Growth trends</div>
        </div>

        {/* Terminal line */}
        <div style={{
          position:'absolute', bottom:'14px', left:'14px', right:'14px',
          fontSize:'10px', color:'rgba(22,163,74,0.5)',
          fontFamily:'monospace', display:'flex', alignItems:'center', gap:'6px',
        }}>
          <span style={{ color: D ? 'rgba(22,163,74,0.75)' : '#16a34a' }}>›</span>
          <span>system.status = OPERATIONAL</span>
          <span style={{ animation:'em-blink 1s step-end infinite' }}>_</span>
        </div>

        {/* Keyframe animations (all prefixed em-) */}
        <style>{`
          @keyframes pgFade     { from { opacity:0; } to { opacity:1; } }
          @keyframes slideUp    { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }
          @keyframes em-scanline{ 0%      { top:-2px;  } 100%      { top:100%;           } }
          @keyframes em-glow    { 0%,100% { opacity:.5;} 50%       { opacity:1;           } }
          @keyframes em-stream  { 0%      { stroke-dashoffset:300; } 100%{ stroke-dashoffset:0; } }
          @keyframes em-float-a { 0%,100% { transform:translateY(0);  } 50%{ transform:translateY(-7px); } }
          @keyframes em-float-b { 0%,100% { transform:translateY(0);  } 50%{ transform:translateY(-5px); } }
          @keyframes em-float-c { 0%,100% { transform:translateY(0);  } 50%{ transform:translateY(-6px); } }
          @keyframes em-blink   { 0%,100% { opacity:1; } 50%{ opacity:0; } }
          @keyframes em-pulse   { 0%,100% { opacity:1; transform:scale(1);   }
                                  50%     { opacity:.4; transform:scale(0.7); } }
          .em-inp:focus {
            outline: none !important;
            border-color: ${D ? 'rgba(22,163,74,0.4)' : '#16a34a'} !important;
            background:   ${D ? 'rgba(22,163,74,0.04)' : '#F9F9F9'} !important;
            box-shadow:   ${D ? '0 0 0 3px rgba(22,163,74,0.07)' : '0 0 0 3px rgba(22,163,74,0.08)'} !important;
          }
        `}</style>
      </div>

      {/* ── RIGHT PANEL ─────────────────────────────────────────── */}
      <div style={{
        width: '420px',
        background: rBg,
        borderLeft: `0.5px solid ${rBorder}`,
        display: 'flex',
        flexDirection: 'column',
        padding: '44px 48px',
        animation: 'slideUp 0.5s 0.1s ease-out both',
      }}>

        {/* Logo row + toggle */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'40px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            {/* Icon box */}
            <div style={{
              width:'34px', height:'34px',
              background: logoBg,
              border: `0.5px solid ${logoBrd}`,
              borderRadius:'9px',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                stroke={logoStroke} strokeWidth="2" strokeLinecap="round">
                <ellipse cx="12" cy="5" rx="9" ry="3"/>
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
              </svg>
            </div>
            {/* Name + badge */}
            <div>
              <div style={{ fontSize:'14px', fontWeight:500, color:logoText, lineHeight:1 }}>EM MONITOR</div>
              <div style={{ fontSize:'10px', color:badgeColor, fontFamily:'monospace', marginTop:'3px' }}>Enterprise Edition</div>
            </div>
          </div>

          {/* Theme toggle */}
          <button
            onClick={() => setIsDark(d => !d)}
            style={{
              background: togBg,
              border: `1px solid ${togBrd}`,
              borderRadius:'7px',
              padding:'5px 12px',
              cursor:'pointer',
              color: togColor,
              fontSize:'11px',
              fontFamily:'monospace',
              letterSpacing:'0.03em',
              flexShrink:0,
            }}
          >
            {D ? '☀ Light' : '◑ Dark'}
          </button>
        </div>

        {/* Headline */}
        <div style={{ marginBottom:'30px' }}>
          <div style={{ fontSize:'22px', fontWeight:500, color:headColor, marginBottom:'6px', letterSpacing:'-0.4px' }}>
            Welcome back
          </div>
          <div style={{ fontSize:'13px', color:subColor }}>
            Sign in to your dashboard
          </div>
        </div>

        <form onSubmit={handleSignIn}>
          {/* Username */}
          <div style={{ marginBottom:'16px' }}>
            <div style={{
              fontSize:'11px', color:labelColor,
              marginBottom:'7px', fontFamily:'monospace',
              textTransform:'uppercase', letterSpacing:'0.6px',
            }}>
              Username
            </div>
            <input
              className="em-inp"
              type="text"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                background: inpBg,
                border: `1px solid ${inpBrd}`,
                color: inpColor,
                borderRadius:'9px',
                padding:'12px 16px',
                width:'100%',
                fontSize:'14px',
                outline:'none',
                boxSizing:'border-box',
                transition:'border-color 0.15s, box-shadow 0.15s',
              }}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom:'26px' }}>
            <div style={{
              fontSize:'11px', color:labelColor,
              marginBottom:'7px', fontFamily:'monospace',
              textTransform:'uppercase', letterSpacing:'0.6px',
            }}>
              Password
            </div>
            <input
              className="em-inp"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                background: inpBg,
                border: `1px solid ${inpBrd}`,
                color: inpColor,
                borderRadius:'9px',
                padding:'12px 16px',
                width:'100%',
                fontSize:'14px',
                outline:'none',
                boxSizing:'border-box',
                transition:'border-color 0.15s, box-shadow 0.15s',
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              color:'#f85149',
              fontSize:'12px',
              padding:'9px 14px',
              background:'rgba(248,81,73,0.08)',
              border:'0.5px solid rgba(248,81,73,0.4)',
              borderRadius:'8px',
              marginBottom:'14px',
              animation:'slideUp 0.2s',
            }}>
              {error}
            </div>
          )}

          {/* Sign in button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width:'100%',
              background:'#16a34a',
              color:'#ffffff',
              border:'none',
              borderRadius:'10px',
              padding:'14px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize:'14px',
              fontWeight:500,
              marginBottom:'14px',
              opacity: loading ? 0.7 : 1,
              transition:'opacity 0.15s',
              boxShadow: btnShadow,
            }}
          >
            {loading ? 'Signing in...' : 'Sign in to Dashboard →'}
          </button>
        </form>

        {/* Status indicator */}
        <div style={{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'10px' }}>
          <div style={{
            width:'6px', height:'6px', borderRadius:'50%',
            background:'#16a34a',
            flexShrink:0,
            animation:'em-pulse 2s ease-in-out infinite',
          }}/>
          <span style={{ fontSize:'12px', color:statusText, fontFamily:'monospace' }}>
            system online
          </span>
        </div>

      </div>
    </div>
  )
}
