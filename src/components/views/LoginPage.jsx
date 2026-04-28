import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { setTestMode } from '../../lib/storage'
import { BookOpen, FlaskConical } from 'lucide-react'

export default function LoginPage() {
  const { user, signIn } = useAuth()
  const navigate = useNavigate()

  useEffect(() => { if (user) navigate('/', { replace: true }) }, [user])

  const handleTestMode = () => { setTestMode(true); signIn() }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
      style={{ background: 'var(--bg-base)' }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl" style={{ background: 'rgba(230,176,32,0.04)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full blur-3xl" style={{ background: 'rgba(96,144,192,0.04)' }} />
      </div>

      <div className="relative max-w-sm w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
            style={{ background: 'rgba(230,176,32,0.12)', border: '1px solid rgba(230,176,32,0.2)' }}>
            <BookOpen size={28} style={{ color: 'var(--gold)' }} />
          </div>
          <h1 className="font-display text-4xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Cadence</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Your intelligent teaching companion</p>
        </div>

        <div className="card p-6 space-y-4">
          <p className="text-sm text-center mb-5" style={{ color: 'var(--text-secondary)' }}>
            Sign in to access your timetable, lesson plans, and class admin.
          </p>

          <button onClick={() => signIn()}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 font-semibold px-4 py-3 rounded-lg text-sm transition-all hover:bg-gray-50 active:scale-95 min-h-[48px]">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="relative flex items-center gap-3">
            <div className="flex-1" style={{ borderTop: '1px solid var(--border)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>or</span>
            <div className="flex-1" style={{ borderTop: '1px solid var(--border)' }} />
          </div>

          <button onClick={handleTestMode}
            className="w-full flex items-center justify-center gap-2 font-medium px-4 py-3 rounded-lg text-sm transition-all active:scale-95 min-h-[48px]"
            style={{ background: 'rgba(240,160,64,0.12)', color: '#f0a040', border: '1px solid rgba(240,160,64,0.2)' }}>
            <FlaskConical size={16} />
            Try in Test Mode (no account needed)
          </button>

          <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            Test Mode stores all data locally in your browser. No sign-in required.
          </p>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
          Data stored securely with Supabase · RLS enforced
        </p>
      </div>
    </div>
  )
}
