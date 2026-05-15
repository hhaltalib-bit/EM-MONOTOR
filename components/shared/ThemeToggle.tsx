'use client'

import { useTheme } from './ThemeProvider'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        background: 'var(--bg4)',
        border: '0.5px solid var(--bdv)',
        borderRadius: '6px',
        padding: '5px 10px',
        cursor: 'pointer',
        color: 'var(--tx2)',
        fontSize: '11px',
        fontFamily: 'monospace',
      }}
    >
      <i
        className={`ti ${theme === 'dark' ? 'ti-sun' : 'ti-moon'}`}
        style={{ fontSize: '13px' }}
      />
      {theme === 'dark' ? 'Light' : 'Dark'}
    </button>
  )
}
