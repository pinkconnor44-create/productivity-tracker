'use client'
import { useEffect, useState } from 'react'

export default function PWASetup() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showAndroid, setShowAndroid] = useState(false)
  const [showIos, setShowIos] = useState(false)

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    // Already installed as standalone — don't show banners
    if (window.matchMedia('(display-mode: standalone)').matches) return

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const dismissed = sessionStorage.getItem('pwa-banner-dismissed')
    if (dismissed) return

    if (isIos) {
      setShowIos(true)
      return
    }

    // Android / Chrome install prompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowAndroid(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    sessionStorage.setItem('pwa-banner-dismissed', '1')
    setShowAndroid(false)
    setShowIos(false)
  }

  async function installAndroid() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    dismiss()
  }

  const banner = showAndroid || showIos
  if (!banner) return null

  return (
    <div className="fixed bottom-20 sm:bottom-6 left-4 right-4 z-50 flex items-center gap-3 bg-white dark:bg-[#16161e] border border-violet-200 dark:border-violet-700 rounded-2xl shadow-xl px-4 py-3">
      <div className="text-2xl">📲</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight">Install App</div>
        {showIos && (
          <div className="text-xs text-slate-600 dark:text-slate-300 leading-tight mt-0.5">
            Tap <strong>Share</strong> → <strong>Add to Home Screen</strong>
          </div>
        )}
        {showAndroid && (
          <div className="text-xs text-slate-600 dark:text-slate-300 leading-tight mt-0.5">
            Add to home screen for the full experience
          </div>
        )}
      </div>
      {showAndroid && (
        <button
          onClick={installAndroid}
          className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
        >
          Install
        </button>
      )}
      <button
        onClick={dismiss}
        className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl text-base font-bold text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 bg-slate-100 dark:bg-white/[0.08] transition-all"
      >
        ✕
      </button>
    </div>
  )
}
