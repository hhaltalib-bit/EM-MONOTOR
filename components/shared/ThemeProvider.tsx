'use client'

import { createContext, useContext, useEffect, useState } from "react"

interface ThemeContextType {
  theme: 'dark' | 'light'
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('ts-monitor-theme') as 'dark' | 'light' | null
    if (stored) {
      setTheme(stored)
      if (stored === 'light') {
        document.documentElement.classList.add('lt')
      }
    }
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('ts-monitor-theme', next)
    if (next === 'light') {
      document.documentElement.classList.add('lt')
    } else {
      document.documentElement.classList.remove('lt')
    }
  }

  if (!mounted) {
    return <div style={{ visibility: 'hidden' }}>{children}</div>
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
