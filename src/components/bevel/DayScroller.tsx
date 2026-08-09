'use client'
import { useEffect, useMemo, useRef } from 'react'
import type { HealthDay } from '@/lib/health'
import { addDays, today } from './shared'

// The day picker that replaced Bevel's page header and its 30/90/365 range
// control. Bevel is a "what happened on a day" surface — every sub-tab except
// Trends shows exactly one day — so the primary control should select a day,
// not a window length. The window is now an implementation detail: it starts
// at 90 days and only grows when the user actually scrolls back that far.
//
// Newest is LEFTMOST and time runs rightward into the past. That is the wrong
// direction for a chart and the right one for this: it opens on today with no
// scroll-to-end effect, and "scroll right to go back" matches how the strip is
// read on a phone.

type Props = {
  days: HealthDay[]
  selected: string
  onSelect: (date: string) => void
  /** Widen the loaded window. Null when there is nothing older to ask for. */
  onLoadEarlier: (() => void) | null
  loadingEarlier?: boolean
}

/** A day is worth showing a dot for when it carries anything at all. */
function hasAny(d: HealthDay): boolean {
  return (
    d.sleep != null ||
    d.workouts.length > 0 ||
    Object.values(d.metrics).some(v => v != null)
  )
}

export function DayScroller({ days, selected, onSelect, onLoadEarlier, loadingEarlier }: Props) {
  const strip = useRef<HTMLDivElement | null>(null)
  const selectedRef = useRef<HTMLButtonElement | null>(null)

  // Newest first. `days` arrives oldest-first from the API.
  const ordered = useMemo(() => [...days].reverse(), [days])
  const withData = useMemo(() => new Set(days.filter(hasAny).map(d => d.date)), [days])

  const t = today()
  const index = ordered.findIndex(d => d.date === selected)
  const newest = ordered[0]?.date
  const oldest = ordered[ordered.length - 1]?.date

  // Keep the selection in view when it moves by arrow rather than by tap.
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [selected])

  function step(delta: number) {
    // delta -1 = older (rightward in this strip), +1 = newer.
    const next = ordered[index - delta]
    if (next) onSelect(next.date)
  }

  const label = (date: string) => {
    if (date === t) return 'Today'
    if (date === addDays(t, -1)) return 'Yesterday'
    return new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })
  }

  return (
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        aria-label="Previous day"
        disabled={selected === oldest && !onLoadEarlier}
        onClick={() => step(-1)}
        className="shrink-0 w-9 rounded-lg border border-outline-variant/40 bg-surface-container-low text-on-surface-variant/70 hover:text-on-surface disabled:opacity-30 disabled:hover:text-on-surface-variant/70 transition-colors"
      >
        ‹
      </button>

      <div
        ref={strip}
        className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto no-scrollbar py-0.5"
        role="group"
        aria-label="Select a day"
      >
        {ordered.map(d => {
          const active = d.date === selected
          const dot = withData.has(d.date)
          return (
            <button
              key={d.date}
              ref={active ? selectedRef : undefined}
              type="button"
              aria-current={active ? 'date' : undefined}
              onClick={() => onSelect(d.date)}
              className={`shrink-0 w-[52px] rounded-xl border px-1 py-2 flex flex-col items-center gap-0.5 transition-colors ${
                active
                  ? 'bg-primary-500/16 border-primary-400/40 text-primary-200'
                  : 'bg-surface-container-low border-outline-variant/40 text-on-surface-variant/70 hover:text-on-surface'
              }`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide leading-none">
                {label(d.date)}
              </span>
              <span className="text-[15px] font-bold leading-tight tabular-nums">
                {Number(d.date.slice(8, 10))}
              </span>
              {/* Presence dot, not a score: it answers "is there anything to
                  look at on this day" before the tap, which is the whole
                  reason to scroll. */}
              <span
                className={`w-1 h-1 rounded-full ${
                  dot ? (active ? 'bg-primary-300' : 'bg-on-surface-variant/45') : 'bg-transparent'
                }`}
              />
            </button>
          )
        })}

        {onLoadEarlier && (
          <button
            type="button"
            onClick={onLoadEarlier}
            disabled={loadingEarlier}
            className="shrink-0 w-[52px] rounded-xl border border-dashed border-outline-variant/50 px-1 py-2 flex flex-col items-center justify-center gap-0.5 text-on-surface-variant/60 hover:text-on-surface transition-colors disabled:opacity-50"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide leading-none">
              {loadingEarlier ? '…' : 'More'}
            </span>
            <span className="text-[15px] leading-tight">↺</span>
          </button>
        )}
      </div>

      <button
        type="button"
        aria-label="Next day"
        disabled={selected === newest}
        onClick={() => step(1)}
        className="shrink-0 w-9 rounded-lg border border-outline-variant/40 bg-surface-container-low text-on-surface-variant/70 hover:text-on-surface disabled:opacity-30 disabled:hover:text-on-surface-variant/70 transition-colors"
      >
        ›
      </button>
    </div>
  )
}
