'use client'

interface OrbitRingsProps {
  dark?: boolean
}

export default function OrbitRings({ dark = false }: OrbitRingsProps) {
  const dot1     = '#16a34a'
  const dot2     = dark ? '#4ade80' : '#22c55e'
  const dot3     = dark ? '#86efac' : '#4ade80'
  const ring1    = dark ? 'rgba(22,163,74,0.2)'  : 'rgba(22,163,74,0.2)'
  const ring2    = dark ? 'rgba(22,163,74,0.3)'  : 'rgba(22,163,74,0.3)'
  const ring3    = dark ? 'rgba(22,163,74,0.4)'  : 'rgba(22,163,74,0.4)'
  const coreBg   = dark ? 'rgba(22,163,74,0.15)' : 'rgba(22,163,74,0.09)'
  const coreStroke = dark ? '#4ade80' : '#16a34a'

  return (
    <div style={{
      position: 'absolute',
      left: '50%', top: '50%',
      transform: 'translate(-50%, -50%)',
      width: '190px', height: '190px',
      pointerEvents: 'none',
      zIndex: 1,
    }}>
      <style>{`
        @keyframes orbit-spin-a { from { transform: rotate(0deg);   } to { transform: rotate(360deg);  } }
        @keyframes orbit-spin-b { from { transform: rotate(0deg);   } to { transform: rotate(-360deg); } }
        @keyframes orbit-spin-c { from { transform: rotate(0deg);   } to { transform: rotate(360deg);  } }
      `}</style>

      {/* Ring outer */}
      <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:`1.5px solid ${ring1}`, animation:'orbit-spin-a 18s linear infinite' }}>
        <div style={{ position:'absolute', width:'9px', height:'9px', borderRadius:'50%', background:dot1, top:'-4.5px', left:'calc(50% - 4.5px)', boxShadow: dark ? '0 0 8px rgba(22,163,74,0.8)' : '0 0 6px rgba(22,163,74,0.5)' }}/>
      </div>

      {/* Ring mid */}
      <div style={{ position:'absolute', inset:'27px', borderRadius:'50%', border:`1.5px solid ${ring2}`, animation:'orbit-spin-b 11s linear infinite' }}>
        <div style={{ position:'absolute', width:'8px', height:'8px', borderRadius:'50%', background:dot2, top:'-4px', left:'calc(50% - 4px)', boxShadow: dark ? '0 0 7px rgba(74,222,128,0.8)' : '0 0 5px rgba(34,197,94,0.5)' }}/>
      </div>

      {/* Ring inner */}
      <div style={{ position:'absolute', inset:'54px', borderRadius:'50%', border:`1.5px solid ${ring3}`, animation:'orbit-spin-c 7s linear infinite' }}>
        <div style={{ position:'absolute', width:'7px', height:'7px', borderRadius:'50%', background:dot3, top:'-3.5px', left:'calc(50% - 3.5px)', boxShadow: dark ? '0 0 6px rgba(134,239,172,0.8)' : '0 0 5px rgba(74,222,128,0.5)' }}/>
      </div>

      {/* Core */}
      <div style={{ position:'absolute', inset:'80px', borderRadius:'50%', background:coreBg, border:'1.5px solid rgba(22,163,74,0.4)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={coreStroke} strokeWidth="2" strokeLinecap="round">
          <ellipse cx="12" cy="5" rx="9" ry="3"/>
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
        </svg>
      </div>
    </div>
  )
}
