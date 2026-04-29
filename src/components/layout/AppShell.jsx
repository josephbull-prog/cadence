import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import {
  CalendarDays, LayoutGrid, ClipboardList, StickyNote, Settings,
  Menu, X, LogOut, Wifi, WifiOff, FileText, Sun, Moon, Search, FolderInput
} from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { useTheme } from '../../lib/theme'
import { useClasses } from '../../lib/hooks'
import { useOnlineStatus } from '../../lib/useOnlineStatus'

// ─── Shared nav items config ───────────────────
const NAV_ITEMS = [
  { to: '/week',          icon: CalendarDays, label: 'Week View' },
  { to: '/class-planner', icon: LayoutGrid,   label: 'Class Planner' },
  { to: '/homework',      icon: ClipboardList, label: 'Homework' },
  { to: '/notes',         icon: StickyNote,    label: 'Notes' },
  { to: '/cover-slip',    icon: FileText,      label: 'Cover Slips' },
  { to: '/import',        icon: FolderInput,   label: 'Import' },
  { to: '/settings',      icon: Settings,      label: 'Settings' },
]

// ─── Sidebar nav item ──────────────────────────
function SideNavItem({ to, icon: Icon, label, onClick, showLabel = true }) {
  return (
    <NavLink to={to} onClick={onClick} end={to === '/week'}
      className="flex items-center gap-3 rounded-lg text-sm font-medium transition-all min-h-[44px]"
      style={({ isActive }) => ({
        padding: showLabel ? '0.6rem 0.75rem' : '0.6rem',
        justifyContent: showLabel ? 'flex-start' : 'center',
        background: isActive ? 'var(--nav-active-bg)' : 'transparent',
        color: isActive ? 'var(--nav-active-color)' : 'var(--text-secondary)',
        border: isActive ? `1px solid var(--nav-active-border)` : '1px solid transparent',
      })}
    >
      <Icon size={18} className="shrink-0" />
      {showLabel && <span>{label}</span>}
    </NavLink>
  )
}

// ─── DEFAULT + EDITORIAL sidebar layout ────────
function FullSidebar({ classes, online, testMode, style }) {
  const { mode, toggleMode, setStyle } = useTheme()
  const { signOut } = useAuth()
  const isEditorial = style === 'editorial'
  const logoStyle = { fontFamily: 'var(--font-logo)', fontSize: isEditorial ? '20px' : '22px', fontWeight: isEditorial ? 400 : 700 }

  return (
    <nav className="flex flex-col h-full py-4 px-3 gap-0.5" style={{ color: 'var(--text-primary)' }}>
      {/* Logo */}
      <div style={{ padding: '4px 8px 20px' }}>
        <div style={{ ...logoStyle, color: 'var(--text-primary)', letterSpacing: isEditorial ? '0.02em' : '-0.01em' }}>
          Cadence
        </div>
        {!isEditorial && (
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'monospace', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Teacher Planner
          </div>
        )}
      </div>

      {testMode && (
        <div style={{ margin: '0 0 12px', padding: '6px 10px', borderRadius: '8px', background: 'rgba(240,160,64,0.1)', border: '1px solid rgba(240,160,64,0.2)' }}>
          <span style={{ fontSize: '11px', color: '#f0a040' }}>⚗ Test Mode</span>
        </div>
      )}

      {NAV_ITEMS.slice(0, 4).map(item => (
        <SideNavItem key={item.to} {...item} />
      ))}

      {/* Classes */}
      {classes.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', padding: '0 10px', marginBottom: '4px' }}>
            Classes
          </div>
          {classes.map(cls => (
            <NavLink key={cls.id} to={`/class/${cls.id}`}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all min-h-[40px]"
              style={({ isActive }) => ({
                background: isActive ? 'var(--hover-bg-strong)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              })}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cls.color_code || '#888' }} />
              <span className="truncate text-xs">{cls.name}</span>
            </NavLink>
          ))}
        </div>
      )}

      <div className="flex-1" />

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', fontSize: '11px', color: 'var(--text-muted)' }}>
          {online ? <><Wifi size={11} style={{ color: '#7db88d' }} /><span>Synced</span></> : <><WifiOff size={11} style={{ color: '#f0a040' }} /><span style={{ color: '#f0a040' }}>Offline</span></>}
        </div>

        <button onClick={toggleMode}
          className="flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-all min-h-[40px] w-full text-left"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--text-secondary)' }}>
          {mode === 'dark' ? <Sun size={16} className="shrink-0" /> : <Moon size={16} className="shrink-0" />}
          <span className="text-xs">{mode === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>

        <SideNavItem to="/settings" icon={Settings} label="Settings" />

        <button onClick={() => signOut()}
          className="flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-all min-h-[40px] w-full text-left"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
          onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--text-muted)' }}>
          <LogOut size={16} className="shrink-0" />
          <span className="text-xs">Sign out</span>
        </button>
      </div>
    </nav>
  )
}

// ─── CARDS icon-rail sidebar ───────────────────
function IconRailSidebar({ classes, online, testMode }) {
  const { mode, toggleMode } = useTheme()
  const { signOut } = useAuth()
  const location = useLocation()

  return (
    <nav className="flex flex-col h-full items-center py-4 gap-1" style={{ width: '68px', color: 'var(--text-primary)' }}>
      {/* Logo — vertical */}
      <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontFamily: 'var(--font-logo)', fontSize: '13px', color: 'var(--text-primary)', letterSpacing: '0.06em', marginBottom: '12px' }}>
        Cadence
      </div>

      {NAV_ITEMS.slice(0, 4).map(({ to, icon: Icon, label }) => {
        const isActive = to === '/week' ? location.pathname === '/week' : location.pathname.startsWith(to)
        return (
          <NavLink key={to} to={to} title={label}
            className="flex items-center justify-center rounded-xl transition-all"
            style={{ width: '44px', height: '44px', background: isActive ? 'var(--nav-active-bg)' : 'transparent', color: isActive ? 'var(--nav-active-color)' : 'var(--text-muted)' }}>
            <Icon size={20} />
          </NavLink>
        )
      })}

      {/* Class dots with abbreviated names */}
      {classes.length > 0 && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
          {classes.map(cls => {
            // Abbreviate: "Year 9 Maths" → "Y9 Ma", "Year 10 English" → "Y10 En"
            const abbr = cls.name
              .replace(/\bYear\b/gi, 'Y').replace(/\byr\b/gi, 'Y')
              .split(' ').slice(0, 2).join(' ')
              .slice(0, 7)
            return (
              <NavLink key={cls.id} to={`/class/${cls.id}`} title={cls.name}
                className="flex flex-col items-center justify-center rounded-xl transition-all gap-0.5"
                style={{ width: '60px', height: '40px', padding: '3px 2px' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span className="rounded-full" style={{ width: '9px', height: '9px', background: cls.color_code || '#888', display: 'block', flexShrink: 0 }} />
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.1, maxWidth: '56px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {abbr}
                </span>
              </NavLink>
            )
          })}
        </div>
      )}

      <div className="flex-1" />

      <button onClick={toggleMode} title={mode === 'dark' ? 'Light mode' : 'Dark mode'}
        className="flex items-center justify-center rounded-xl transition-all"
        style={{ width: '44px', height: '44px', color: 'var(--text-muted)' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text-primary)' }}
        onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--text-muted)' }}>
        {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <NavLink to="/settings" title="Settings"
        className="flex items-center justify-center rounded-xl transition-all"
        style={{ width: '44px', height: '44px', color: 'var(--text-muted)' }}>
        <Settings size={18} />
      </NavLink>

      <button onClick={() => signOut()} title="Sign out"
        className="flex items-center justify-center rounded-xl transition-all"
        style={{ width: '44px', height: '44px', color: 'var(--text-muted)' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
        onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--text-muted)' }}>
        <LogOut size={18} />
      </button>
    </nav>
  )
}

// ─── TIMETABLE top-bar navigation ─────────────
function TopBar({ classes, online, testMode, onMobileMenu }) {
  const { mode, toggleMode } = useTheme()
  const { signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <header className="flex items-center gap-0 shrink-0 px-4"
      style={{ height: '52px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontFamily: 'var(--font-logo)', fontSize: '17px', color: 'var(--text-primary)', marginRight: '24px', letterSpacing: '0.02em', flexShrink: 0 }}>
        Cadence
      </div>

      <div className="flex items-center gap-0 flex-1">
        {NAV_ITEMS.slice(0, 4).map(({ to, label }) => {
          const isActive = to === '/week' ? location.pathname === '/week' : location.pathname.startsWith(to)
          return (
            <NavLink key={to} to={to}
              className="flex items-center px-3 text-sm transition-all"
              style={{ height: '52px', borderBottom: isActive ? '2px solid var(--gold)' : '2px solid transparent', color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isActive ? 500 : 400 }}>
              {label}
            </NavLink>
          )
        })}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {testMode && <span style={{ fontSize: '11px', color: '#f0a040' }}>⚗ Test</span>}
        {online
          ? <Wifi size={13} style={{ color: '#7db88d' }} />
          : <WifiOff size={13} style={{ color: '#f0a040' }} />
        }
        <button onClick={toggleMode} className="btn-ghost p-2" style={{ minHeight: 'unset', padding: '6px' }}>
          {mode === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <NavLink to="/settings" className="btn-ghost p-2" style={{ minHeight: 'unset', padding: '6px' }}>
          <Settings size={15} />
        </NavLink>
        <button onClick={() => signOut()} className="btn-ghost p-2" style={{ minHeight: 'unset', padding: '6px' }}>
          <LogOut size={15} />
        </button>
      </div>
    </header>
  )
}

// ─── Main AppShell ─────────────────────────────
export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, signOut, testMode } = useAuth()
  const { data: classes = [] } = useClasses()
  const online = useOnlineStatus()
  const { style } = useTheme()

  const isTimetable = style === 'timetable'
  const isCards = style === 'cards'

  const sidebarWidth = isCards ? '72px' : isTimetable ? '0' : style === 'editorial' ? '220px' : '256px'

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>

      {/* Sidebar — hidden for timetable style */}
      {!isTimetable && (
        <>
          <aside className="hidden lg:flex lg:flex-col shrink-0 overflow-y-auto"
            style={{ width: sidebarWidth, background: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}>
            {isCards
              ? <IconRailSidebar classes={classes} online={online} testMode={testMode} />
              : <FullSidebar classes={classes} online={online} testMode={testMode} style={style} />
            }
          </aside>

          {/* Mobile overlay */}
          {sidebarOpen && (
            <div className="lg:hidden fixed inset-0 z-50 flex">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
              <aside className="relative overflow-y-auto animate-slide-in"
                style={{ width: '280px', background: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}>
                <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 p-1" style={{ color: 'var(--text-muted)' }}>
                  <X size={18} />
                </button>
                <FullSidebar classes={classes} online={online} testMode={testMode} style={style} />
              </aside>
            </div>
          )}
        </>
      )}

      {/* Main area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Timetable style top bar (desktop) */}
        {isTimetable && (
          <div className="hidden lg:block">
            <TopBar classes={classes} online={online} testMode={testMode} />
          </div>
        )}

        {/* Mobile header (all non-timetable styles, and timetable on mobile) */}
        <header className={`${isTimetable ? 'lg:hidden' : 'lg:hidden'} flex items-center gap-3 px-4 py-3 shrink-0`}
          style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setSidebarOpen(true)} className="p-1 min-w-[44px] min-h-[44px] flex items-center justify-center" style={{ color: 'var(--text-secondary)' }}>
            <Menu size={20} />
          </button>
          <span style={{ fontFamily: 'var(--font-logo)', fontSize: '18px', color: 'var(--text-primary)' }}>Cadence</span>
          {testMode && <span className="text-xs ml-auto" style={{ color: '#f0a040' }}>⚗ Test</span>}
        </header>

        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
