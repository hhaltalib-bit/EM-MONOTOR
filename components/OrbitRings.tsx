'use client'

export default function OrbitRings() {
  return (
    <div style={{
      position: 'absolute',
      right: '30px',
      top: '50%',
      transform: 'translateY(-50%)',
      width: '180px',
      height: '180px',
      zIndex: 1,
      pointerEvents: 'none',
    }}>

      {/* Ring 1 — outer */}
      <div style={{
        position: 'absolute',
        width: '180px', height: '180px',
        top: 0, left: 0,
        borderRadius: '50%',
        border: '1.5px solid rgba(22,163,74,0.15)',
        animation: 'orbit-spin 16s linear infinite',
      }}>
        <div style={{
          position: 'absolute',
          width: '7px', height: '7px',
          borderRadius: '50%',
          background: '#16a34a',
          top: '-3.5px',
          left: 'calc(50% - 3.5px)',
          boxShadow: '0 0 0 2px rgba(22,163,74,0.2)',
        }}/>
      </div>

      {/* Ring 2 — middle */}
      <div style={{
        position: 'absolute',
        width: '130px', height: '130px',
        top: '25px', left: '25px',
        borderRadius: '50%',
        border: '1.5px solid rgba(22,163,74,0.22)',
        animation: 'orbit-spin 10s linear infinite reverse',
      }}>
        <div style={{
          position: 'absolute',
          width: '7px', height: '7px',
          borderRadius: '50%',
          background: '#16a34a',
          top: '-3.5px',
          left: 'calc(50% - 3.5px)',
          boxShadow: '0 0 0 2px rgba(22,163,74,0.2)',
        }}/>
      </div>

      {/* Ring 3 — inner */}
      <div style={{
        position: 'absolute',
        width: '80px', height: '80px',
        top: '50px', left: '50px',
        borderRadius: '50%',
        border: '1.5px solid rgba(22,163,74,0.32)',
        animation: 'orbit-spin 7s linear infinite',
      }}>
        <div style={{
          position: 'absolute',
          width: '7px', height: '7px',
          borderRadius: '50%',
          background: '#16a34a',
          top: '-3.5px',
          left: 'calc(50% - 3.5px)',
          boxShadow: '0 0 0 2px rgba(22,163,74,0.2)',
        }}/>
      </div>

      {/* Center — database icon */}
      <div style={{
        position: 'absolute',
        width: '36px', height: '36px',
        top: '72px', left: '72px',
        borderRadius: '50%',
        background: 'rgba(22,163,74,0.1)',
        border: '1.5px solid rgba(22,163,74,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="#16a34a" strokeWidth="2" strokeLinecap="round">
          <ellipse cx="12" cy="5" rx="9" ry="3"/>
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
        </svg>
      </div>

      <style>{`
        @keyframes orbit-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
