'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { HealthResponse, HealthDay, MetricKey } from '@/lib/health'

// ── dates ─────────────────────────────────────────────────────────────────
// Same local-day helpers every other view in this repo carries. Deliberately
// not shared with them: they are four lines, and importing across views to
// save them has caused circular-import pain here before.

export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function addDays(s: string, n: number): string {
  const d = new Date(s + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function formatDay(s: string): string {
  return new Date(s + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
/** "11:12 PM" from an HAE timestamp, without trusting Date to parse it. */
export function clockTime(ts: string | null | undefined): string {
  if (!ts) return '—'
  const m = ts.match(/[T ](\d{2}):(\d{2})/)
  if (!m) return '—'
  let h = Number(m[1])
  const suffix = h >= 12 ? 'PM' : 'AM'
  h = h % 12 === 0 ? 12 : h % 12
  return `${h}:${m[2]} ${suffix}`
}

// ── the data hook ─────────────────────────────────────────────────────────

export type HealthState = {
  data: HealthResponse | null
  loading: boolean
  error: boolean
  refetch: () => void
}

/** Single fetch for the whole Bevel tab. Sub-tabs receive slices of this as
 *  props rather than fetching their own — six sub-tabs each holding a fetch
 *  would issue six requests on first open, and they all want the same range.
 *
 *  AbortController per request: the range picker can change faster than Turso
 *  answers, and a stale 365-day response must not overwrite a fresh 30-day one. */
export function useHealthData(days: number): HealthState {
  const [data, setData] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const inflight = useRef<AbortController | null>(null)

  const load = useCallback(() => {
    inflight.current?.abort()
    const ctrl = new AbortController()
    inflight.current = ctrl
    setLoading(true)
    const end = today()
    const start = addDays(end, -(days - 1))
    fetch(`/api/health?start=${start}&end=${end}`, { signal: ctrl.signal })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
      .then((json: HealthResponse) => {
        if (ctrl.signal.aborted) return
        setData(json); setError(false); setLoading(false)
      })
      .catch(e => {
        if (ctrl.signal.aborted || e?.name === 'AbortError') return
        setError(true); setLoading(false)
      })
  }, [days])

  useEffect(() => {
    load()
    return () => inflight.current?.abort()
  }, [load])

  // Shell dispatches this on every tab change; keeps Bevel current without a
  // poll when Connor comes back to it after an import has landed.
  useEffect(() => {
    window.addEventListener('score-refresh', load)
    return () => window.removeEventListener('score-refresh', load)
  }, [load])

  return { data, loading, error, refetch: load }
}

// ── derived helpers ───────────────────────────────────────────────────────

/** Most recent day that has any reading at all. Today is usually still empty
 *  in the morning — HAE has not run yet — and showing an empty "today" would
 *  read as broken rather than as pending. */
export function latestDayWith(days: HealthDay[], has: (d: HealthDay) => boolean): HealthDay | null {
  for (let i = days.length - 1; i >= 0; i--) if (has(days[i])) return days[i]
  return null
}

export function seriesOf(days: HealthDay[], key: MetricKey): { date: string; value: number }[] {
  return days
    .filter(d => d.metrics[key] != null && Number.isFinite(d.metrics[key] as number))
    .map(d => ({ date: d.date, value: d.metrics[key] as number }))
}

export function scoreSeries(days: HealthDay[], key: 'sleep' | 'recovery' | 'strain'): { date: string; value: number }[] {
  return days
    .filter(d => d.scores[key] != null)
    .map(d => ({ date: d.date, value: d.scores[key] as number }))
}

// ── shared chrome ─────────────────────────────────────────────────────────

export type Tip = { x: number; y: number; text: string }

/** Fixed-position chart tooltip. Rendered at the view root, never inside a
 *  `.neon-card` — a hovered card applies a transform, which would become the
 *  containing block for anything fixed inside it (see CLAUDE.md). */
export function ChartTip({ tip }: { tip: Tip | null }) {
  if (!tip) return null
  return (
    <div
      className="fixed z-[60] pointer-events-none"
      style={{ left: tip.x, top: tip.y - 10, transform: 'translate(-50%, -100%)' }}
    >
      <div className="bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-2.5 py-1.5 shadow-xl text-xs whitespace-nowrap">
        {tip.text}
      </div>
    </div>
  )
}

export function LoadingBlock({ height = 'h-40', label = 'Loading…' }: { height?: string; label?: string }) {
  return (
    <div className={`${height} flex items-center justify-center text-on-surface-variant/50 text-sm`}>
      {label}
    </div>
  )
}

/** Calibration note shown wherever a baseline is still filling. */
export function CalibratingNote({ n, of = 30 }: { n: number; of?: number }) {
  return (
    <span className="text-micro font-semibold text-amber-400/80">
      Calibrating · {n}/{of} days
    </span>
  )
}
