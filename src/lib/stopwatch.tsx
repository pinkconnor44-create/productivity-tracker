'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react'

// Lifts-tab rest timer hoisted to app-level so the docked variant stays visible
// while the user navigates between tabs. The floating variant is still rendered
// inside LiftTracker (only on the Lifts tab); the docked variant is rendered by
// Shell and persists across tab switches.

export type StopwatchMode = 'float' | 'dock'
const MODE_KEY = 'stopwatch-mode-v1'

type StopwatchCtx = {
  ms: number
  running: boolean
  mode: StopwatchMode
  start: () => void
  stop: () => void
  reset: () => void
  setMode: (m: StopwatchMode) => void
}

const Ctx = createContext<StopwatchCtx | null>(null)

export function StopwatchProvider({ children }: { children: ReactNode }) {
  const [ms, setMs] = useState(0)
  const [running, setRunning] = useState(false)
  const [mode, setModeState] = useState<StopwatchMode>('float')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef<number>(0)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(MODE_KEY)
      if (raw === 'float' || raw === 'dock') setModeState(raw)
    } catch {}
  }, [])

  const setMode = useCallback((m: StopwatchMode) => {
    setModeState(m)
    try { localStorage.setItem(MODE_KEY, m) } catch {}
  }, [])

  const start = useCallback(() => {
    startRef.current = Date.now() - ms
    intervalRef.current = setInterval(() => setMs(Date.now() - startRef.current), 100)
    setRunning(true)
  }, [ms])
  const stop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setRunning(false)
  }, [])
  const reset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setMs(0); setRunning(false)
  }, [])

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  return <Ctx.Provider value={{ ms, running, mode, start, stop, reset, setMode }}>{children}</Ctx.Provider>
}

export function useStopwatch() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStopwatch must be used within StopwatchProvider')
  return v
}
