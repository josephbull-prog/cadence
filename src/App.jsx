import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { ToastProvider } from './lib/toast'
import { ThemeProvider } from './lib/theme'
import AppShell from './components/layout/AppShell'
import LoginPage from './components/views/LoginPage'
import WeekView from './components/views/WeekView'
import ClassView from './components/views/ClassView'
import HomeworkView from './components/views/HomeworkView'
import NotesView from './components/views/NotesView'
import SettingsView from './components/views/SettingsView'
import CoverSlipView from './components/views/CoverSlipView'
import ClassPlannerView from './components/views/ClassPlannerView'
import ImportView from './components/views/ImportView'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div style={{ color: 'var(--text-muted)', fontFamily: "'Playfair Display', serif" }} className="text-2xl animate-pulse">Cadence</div>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={
        <ProtectedRoute>
          <AppShell />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/week" replace />} />
        <Route path="week" element={<WeekView />} />
        <Route path="class-planner" element={<ClassPlannerView />} />
        <Route path="import" element={<ImportView />} />
        <Route path="class/:classId" element={<ClassView />} />
        <Route path="homework" element={<HomeworkView />} />
        <Route path="notes" element={<NotesView />} />
        <Route path="settings" element={<SettingsView />} />
        <Route path="cover-slip" element={<CoverSlipView />} />
        <Route path="cover-slip/:slipId" element={<CoverSlipView />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
