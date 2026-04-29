import { createContext, useContext, useState, useEffect } from 'react'

// style: 'default' | 'editorial' | 'cards' | 'timetable'
// mode:  'dark' | 'light'
const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [style, setStyle] = useState(() => localStorage.getItem('cadence_style') || 'default')
  const [mode,  setMode]  = useState(() => localStorage.getItem('cadence_mode')  || 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-style', style)
    document.documentElement.setAttribute('data-mode', mode)
    localStorage.setItem('cadence_style', style)
    localStorage.setItem('cadence_mode', mode)
  }, [style, mode])

  const toggleMode = () => setMode(m => m === 'dark' ? 'light' : 'dark')

  return (
    <ThemeContext.Provider value={{ style, setStyle, mode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

export const STYLES = [
  { id: 'default',   label: 'Midnight',   desc: 'Dark navy, gold accents' },
  { id: 'editorial', label: 'Editorial',  desc: 'Clean serif, minimal colour' },
  { id: 'cards',     label: 'Card tiles', desc: 'Day-per-card, icon rail' },
  { id: 'timetable', label: 'Timetable',  desc: 'Class rows, days across' },
]
