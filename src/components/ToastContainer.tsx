'use client'
import { useState, useEffect } from 'react'

type ToastItem = { id: number; message: string; type: string; exiting: boolean }

const ICONS: Record<string, string> = {
  success: '✓',
  info: 'ℹ',
  warning: '⚠',
}
const COLORS: Record<string, string> = {
  success: 'bg-emerald-500',
  info: 'bg-violet-500',
  warning: 'bg-amber-500',
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    function handler(e: Event) {
      const { message, type = 'success' } = (e as CustomEvent).detail
      const id = Date.now() + Math.random()
      setToasts(prev => [...prev, { id, message, type, exiting: false }])
      setTimeout(() => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 200)
      }, 2600)
    }
    window.addEventListener('app-toast', handler)
    return () => window.removeEventListener('app-toast', handler)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-4 z-[100] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className={`${t.exiting ? 'toast-exit' : 'toast-enter'} flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-lg text-white text-sm font-medium backdrop-blur-sm bg-slate-800/90 dark:bg-white/10 border border-white/10`}>
          <span className={`w-5 h-5 rounded-full ${COLORS[t.type] ?? COLORS.success} flex items-center justify-center text-[11px] font-bold shrink-0`}>
            {ICONS[t.type] ?? ICONS.success}
          </span>
          {t.message}
        </div>
      ))}
    </div>
  )
}
