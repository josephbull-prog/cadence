import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { CalendarDays, ClipboardList, StickyNote, Settings, Menu, X, LogOut, Wifi, WifiOff, FileText, Sun, Moon } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { useTheme } from '../../lib/theme'
import { useClasses } from '../../lib/hooks'
import { useOnlineStatus } from '../../lib/useOnlineStatus'

function NavItem({ to, icon: Icon, label, end, onClick }) {
  return (
    <NavLink to={to} end={end} onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 min-h-[44px] ${
          isActive
            ? 'font-semibold'
            : ''
        }`
      }
      style={({ isActive }) => isActive
        ? { background: 'rgba(230,176,32,0.12)', color: 'var(--gold)', border: '1px solid rgba(230,176,32,0.2)' }
        : { color: 'var(--text-secondary)' }
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={18} className="shrink-0" />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  )
}

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, signOut, testMode } = useAuth()
  const { data: classes = [] } = useClasses()
  const online = useOnlineStatus()
  const { theme, toggleTheme } = useTheme()
  const closeSidebar = () => setSidebarOpen(false)

  const Sidebar = () => (
    <nav className="flex flex-col h-full p-4 gap-1" style={{ color: 'var(--text-primary)' }}>
      {/* Logo */}
      <div className="mb-6 px-2 pt-2">
        <h1 className="font-display text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Cadence
        </h1>
        <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }}>Teacher Planner</p>
      </div>

      {testMode && (
        <div className="mb-3 px-2 py-1.5 rounded-lg" style={{ background: 'rgba(240,160,64,0.12)', border: '1px solid rgba(240,160,64,0.2)' }}>
          <p className="text-xs font-medium" style={{ color: '#f0a040' }}>⚗ Test Mode — Local Storage</p>
        </div>
      )}

      <NavItem to="/week" icon={CalendarDays} label="Week View" onClick={closeSidebar} />
      <NavItem to="/homework" icon={ClipboardList} label="Homework" onClick={closeSidebar} />
      <NavItem to="/notes" icon={StickyNote} label="Notes" onClick={closeSidebar} />
      <NavItem to="/cover-slip" icon={FileText} label="Cover Slips" onClick={closeSidebar} />

      {classes.length > 0 && (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wider px-3 mb-2" style={{ color: 'var(--text-muted)' }}>Classes</p>
          {classes.map(cls => (
            <NavLink key={cls.id} to={`/class/${cls.id}`} onClick={closeSidebar}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 min-h-[44px]"
              style={({ isActive }) => isActive
                ? { background: 'var(--hover-bg-strong)', color: 'var(--text-primary)' }
                : { color: 'var(--text-secondary)' }
              }
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cls.color_code || '#888' }} />
              <span className="truncate">{cls.name}</span>
            </NavLink>
          ))}
        </div>
      )}

      <div className="flex-1" />

      <div className="space-y-1 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        {/* Online status */}
        <div className="flex items-center gap-2 px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          {online
            ? <><Wifi size={12} style={{ color: '#7db88d' }} /><span>Synced ✓</span></>
            : <><WifiOff size={12} style={{ color: '#f0a040' }} /><span style={{ color: '#f0a040' }}>Offline — read only</span></>
          }
        </div>

        {/* Theme toggle */}
        <button onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium min-h-[44px] transition-all"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--text-secondary)' }}
        >
          {theme === 'dark' ? <Sun size={18} className="shrink-0" /> : <Moon size={18} className="shrink-0" />}
          <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>

        <NavItem to="/settings" icon={Settings} label="Settings" onClick={closeSidebar} />

        <button onClick={() => signOut()}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[44px]"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
          onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          <LogOut size={18} className="shrink-0" />
          <span>Sign out</span>
        </button>
      </div>
    </nav>
  )

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 overflow-y-auto"
        style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}>
        <Sidebar />
      </aside>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeSidebar} />
          <aside className="relative w-72 overflow-y-auto animate-slide-in"
            style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}>
            <button onClick={closeSidebar} className="absolute top-4 right-4 p-1" style={{ color: 'var(--text-muted)' }}>
              <X size={20} />
            </button>
            <Sidebar />
          </aside>
        </div>
      )}

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 shrink-0"
          style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setSidebarOpen(true)} className="p-1 min-w-[44px] min-h-[44px] flex items-center justify-center" style={{ color: 'var(--text-secondary)' }}>
            <Menu size={20} />
          </button>
          <span className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Cadence</span>
          {testMode && <span className="text-xs ml-auto" style={{ color: '#f0a040' }}>⚗ Test</span>}
        </header>
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
