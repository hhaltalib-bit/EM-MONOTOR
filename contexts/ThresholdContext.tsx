'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface ThresholdContextValue {
  warnThreshold: number
  critThreshold: number
  setWarnThreshold: (v: number) => void
  setCritThreshold: (v: number) => void
}

const ThresholdContext = createContext<ThresholdContextValue>({
  warnThreshold: 80,
  critThreshold: 90,
  setWarnThreshold: () => {},
  setCritThreshold: () => {},
})

export function ThresholdProvider({ children }: { children: ReactNode }) {
  const [warnThreshold, setWarnThresholdState] = useState(80)
  const [critThreshold, setCritThresholdState] = useState(90)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('em_thresholds')
      const parsed = saved ? JSON.parse(saved) : null
      const warn = parsed?.warn ?? 80
      const crit = parsed?.crit ?? 90
      if (!isNaN(warn) && warn >= 50 && warn <= 99) setWarnThresholdState(warn)
      if (!isNaN(crit) && crit >= 50 && crit <= 99) setCritThresholdState(crit)
    } catch {}
  }, [])

  const setWarnThreshold = (v: number) => {
    setWarnThresholdState(v)
    try { localStorage.setItem('em_thresholds', JSON.stringify({ warn: v, crit: critThreshold })) } catch {}
  }

  const setCritThreshold = (v: number) => {
    setCritThresholdState(v)
    try { localStorage.setItem('em_thresholds', JSON.stringify({ warn: warnThreshold, crit: v })) } catch {}
  }

  return (
    <ThresholdContext.Provider value={{ warnThreshold, critThreshold, setWarnThreshold, setCritThreshold }}>
      {children}
    </ThresholdContext.Provider>
  )
}

export function useThresholds() {
  return useContext(ThresholdContext)
}
