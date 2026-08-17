import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const show = useCallback((message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="fixed top-4 left-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }) {
  const icons = {
    success: <CheckCircle size={18} className="text-accent-green shrink-0" />,
    error:   <XCircle size={18} className="text-accent-red shrink-0" />,
    warning: <AlertCircle size={18} className="text-accent-orange shrink-0" />,
  }

  return (
    <div className="pointer-events-auto flex items-center gap-3 bg-bg-card border border-border
                    rounded-xl px-4 py-3 shadow-lg shadow-black/50 animate-in fade-in slide-in-from-top-2">
      {icons[toast.type] || icons.success}
      <span className="text-sm text-text-primary flex-1">{toast.message}</span>
      <button onClick={onDismiss} className="text-text-muted">
        <X size={16} />
      </button>
    </div>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
