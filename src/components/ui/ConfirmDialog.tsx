'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { createPortal } from 'react-dom'

type ConfirmOptions = {
  title?: string
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type Resolver = (value: boolean) => void

type ConfirmContextValue = (opts?: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext)
  if (!ctx) {
    // Fallback: if Provider isn't mounted yet, fall back to native confirm so callers don't crash.
    return (opts?: ConfirmOptions) =>
      Promise.resolve(typeof window !== 'undefined' ? window.confirm(typeof opts?.message === 'string' ? opts.message : opts?.title ?? 'Are you sure?') : true)
  }
  return ctx
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [opts, setOpts] = useState<ConfirmOptions>({})
  const resolverRef = useRef<Resolver | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const confirm = useCallback<ConfirmContextValue>((nextOpts) => {
    return new Promise<boolean>((resolve) => {
      setOpts(nextOpts ?? {})
      resolverRef.current = resolve
      setOpen(true)
    })
  }, [])

  const close = useCallback((value: boolean) => {
    resolverRef.current?.(value)
    resolverRef.current = null
    setOpen(false)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false)
      else if (e.key === 'Enter') close(true)
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, close])

  const dialog = open && mounted ? createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => close(false)} />
      <div className="relative w-full max-w-sm rounded-2xl bg-surface-container border border-outline-variant/40 shadow-2xl overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <h2 className="text-base font-bold text-on-surface">
            {opts.title ?? 'Are you sure?'}
          </h2>
          {opts.message && (
            <div className="mt-2 text-[13px] text-on-surface-variant/80 leading-relaxed">
              {opts.message}
            </div>
          )}
        </div>
        <div className="flex gap-2 px-5 pb-5 pt-2">
          <button
            onClick={() => close(false)}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-outline-variant/60 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors"
          >
            {opts.cancelLabel ?? 'Cancel'}
          </button>
          <button
            onClick={() => close(true)}
            autoFocus
            className={
              opts.danger === false
                ? 'flex-1 py-2.5 rounded-xl text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 active:bg-violet-800 transition-colors'
                : 'flex-1 py-2.5 rounded-xl text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 transition-colors'
            }
          >
            {opts.confirmLabel ?? 'Delete'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  ) : null

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog}
    </ConfirmContext.Provider>
  )
}
