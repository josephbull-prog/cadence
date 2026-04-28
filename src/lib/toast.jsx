import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  const removeToast = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), [])

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error', 5000),
    info: (msg) => addToast(msg, 'info'),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="animate-slide-up pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl max-w-sm"
            style={{
              background: t.type === 'success' ? 'rgba(90,158,110,0.95)' : t.type === 'error' ? 'rgba(200,80,80,0.95)' : 'var(--bg-overlay)',
              border: `1px solid ${t.type === 'success' ? 'rgba(90,158,110,0.4)' : t.type === 'error' ? 'rgba(200,80,80,0.4)' : 'var(--border)'}`,
              backdropFilter: 'blur(8px)'
            }}>
            {t.type === 'success' && <CheckCircle size={16} className="shrink-0 text-white" />}
            {t.type === 'error' && <AlertCircle size={16} className="shrink-0 text-white" />}
            {t.type === 'info' && <Info size={16} className="shrink-0" style={{ color: 'var(--text-secondary)' }} />}
            <span className="text-sm font-medium" style={{ color: t.type === 'info' ? 'var(--text-primary)' : 'white' }}>{t.message}</span>
            <button onClick={() => removeToast(t.id)} className="ml-auto" style={{ color: t.type === 'info' ? 'var(--text-muted)' : 'rgba(255,255,255,0.7)' }}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
