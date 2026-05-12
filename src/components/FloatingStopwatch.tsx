'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useStopwatch } from '@/lib/stopwatch'

// Draggable rest-timer widget. Rendered globally by Shell (alongside
// DockedStopwatch) so it survives tab switches and stays interactive when
// expanded from the dock on a tab whose view is `hidden` in the DOM.
// Position is persisted to localStorage.

const STOPWATCH_POS_KEY = 'stopwatch-pos-v1'
type StopwatchPos = { x: number; y: number }

function loadStopwatchPos(): StopwatchPos | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STOPWATCH_POS_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as StopwatchPos
    if (typeof p.x === 'number' && typeof p.y === 'number') return p
  } catch {}
  return null
}

function saveStopwatchPos(p: StopwatchPos) {
  try { localStorage.setItem(STOPWATCH_POS_KEY, JSON.stringify(p)) } catch {}
}

function clampPos(p: StopwatchPos, w: number, h: number): StopwatchPos {
  if (typeof window === 'undefined') return p
  const vw = window.innerWidth
  const vh = window.innerHeight
  return {
    x: Math.max(8, Math.min(p.x, vw - w - 8)),
    y: Math.max(8, Math.min(p.y, vh - h - 8)),
  }
}

export default function FloatingStopwatch() {
  const { ms, running, mode, start, stop, reset, setMode } = useStopwatch()
  const [pos, setPos] = useState<StopwatchPos | null>(null)
  const dragRef = useRef<{ dx: number; dy: number; w: number; h: number; pid: number } | null>(null)
  const elRef = useRef<HTMLDivElement | null>(null)
  const movedRef = useRef(false)

  useEffect(() => {
    const saved = loadStopwatchPos()
    if (saved) { setPos(saved); return }
    const measure = () => {
      const w = elRef.current?.offsetWidth ?? 260
      const h = elRef.current?.offsetHeight ?? 152
      setPos({ x: window.innerWidth - w - 16, y: window.innerHeight - h - 16 })
    }
    requestAnimationFrame(measure)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function onResize() {
      setPos(prev => {
        if (!prev || !elRef.current) return prev
        return clampPos(prev, elRef.current.offsetWidth, elRef.current.offsetHeight)
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!elRef.current) return
    const r = elRef.current.getBoundingClientRect()
    dragRef.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, h: r.height, pid: e.pointerId }
    movedRef.current = false
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch {}
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const d = dragRef.current
    if (!d || d.pid !== e.pointerId) return
    e.preventDefault()
    movedRef.current = true
    const next = clampPos({ x: e.clientX - d.dx, y: e.clientY - d.dy }, d.w, d.h)
    setPos(next)
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const d = dragRef.current
    if (!d || d.pid !== e.pointerId) return
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch {}
    dragRef.current = null
    if (movedRef.current && pos) saveStopwatchPos(pos)
  }, [pos])

  if (mode === 'dock') return null

  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  const tenth = Math.floor((ms % 1000) / 100)
  const display = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${tenth}`

  const style: React.CSSProperties = pos
    ? { top: pos.y, left: pos.x, touchAction: 'none' }
    : { top: 0, left: 0, visibility: 'hidden', touchAction: 'none' }

  return (
    <div
      ref={elRef}
      data-no-swipe
      style={style}
      className="fixed z-[55] w-[260px] rounded-2xl bg-surface-container-high/95 border border-violet-400/40 shadow-2xl backdrop-blur-md overflow-hidden select-none"
    >
      <div
        className="flex items-center gap-2 px-4 pt-3 cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className="text-sm">⏱</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/70">Rest Timer</span>
        <span className="ml-auto text-[10px] text-on-surface-variant/40 select-none" aria-hidden>⋮⋮</span>
        <button
          onClick={() => setMode('dock')}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-6 h-6 flex items-center justify-center rounded-md text-on-surface-variant/60 hover:text-on-surface hover:bg-surface-container transition-colors text-xs"
          aria-label="Dock timer to right edge"
          title="Dock to side"
        >
          –
        </button>
      </div>
      <div className="px-4 pt-1 pb-3 flex flex-col items-center gap-3">
        <span className={`text-3xl font-mono font-bold tabular-nums tracking-tight ${running ? 'text-violet-300' : ms > 0 ? 'text-on-surface' : 'text-on-surface-variant/40'}`}>
          {display}
        </span>
        <div className="flex gap-2 w-full">
          {!running ? (
            <button onClick={start} className="flex-1 py-2 text-sm font-bold rounded-xl bg-violet-600 text-white hover:bg-violet-700 active:bg-violet-800 transition-colors">
              {ms > 0 ? 'Resume' : 'Start'}
            </button>
          ) : (
            <button onClick={stop} className="flex-1 py-2 text-sm font-bold rounded-xl bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700 transition-colors">
              Stop
            </button>
          )}
          {ms > 0 && (
            <button onClick={reset} className="px-3 py-2 text-sm font-bold rounded-xl border border-outline-variant/60 text-on-surface-variant/60 hover:text-rose-400 hover:border-rose-500/40 transition-colors">
              ⟲
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
