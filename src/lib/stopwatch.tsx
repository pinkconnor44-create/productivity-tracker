'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react'

// Lifts rest timer, hoisted to app level so a running timer survives tab
// switches: the interval lives here, not in the components that draw it.
//
// `liftsActive` exists because the timer must be VISIBLE only on the Lifts
// sub-tab (Connor, 2026-08-09) while still being RENDERED by Shell — Shell is
// outside the `tab-fade` subtree, and tab-fade animates `transform`, which
// would otherwise become the containing block for these `position: fixed`
// overlays (see CLAUDE.md). Shell cannot see Bevel's sub-tab, and Bevel cannot
// safely render the overlays itself, so the flag crosses through this context.

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
  /** True only while the Lifts sub-tab is open. Set by BevelView. */
  liftsActive: boolean
  setLiftsActive: (v: boolean) => void
}

const Ctx = createContext<StopwatchCtx | null>(null)

export function StopwatchProvider({ children }: { children: ReactNode }) {
  const [ms, setMs] = useState(0)
  const [running, setRunning] = useState(false)
  const [mode, setModeState] = useState<StopwatchMode>('float')
  const [liftsActive, setLiftsActive] = useState(false)
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
    if (intervalRef.current) clearInterval(intervalRef.current)
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

  return (
    <Ctx.Provider value={{ ms, running, mode, start, stop, reset, setMode, liftsActive, setLiftsActive }}>
      {children}
    </Ctx.Provider>
  )
}

export function useStopwatch() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStopwatch must be used within StopwatchProvider')
  return v
}
