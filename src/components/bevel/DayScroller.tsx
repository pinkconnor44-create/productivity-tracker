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
// Time runs LEFT TO RIGHT: oldest on the left, today on the right, matching
// every calendar and chart in the app — and the arrows agree with it, left
// going back and right going forward. The first version ran newest-first to
// avoid needing a scroll-to-end on mount; that saved one effect and cost the
// reading direction everyone already has, which was the wrong trade.

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
  const selectedRef = useRef<HTMLButtonElement | null>(null)

  // `days` already arrives oldest-first from the API, which is the order the
  // strip renders in: oldest left, today right.
  const ordered = days
  const withData = useMemo(() => new Set(days.filter(hasAny).map(d => d.date)), [days])

  const t = today()
  const index = ordered.findIndex(d => d.date === selected)
  const oldest = ordered[0]?.date
  const newest = ordered[ordered.length - 1]?.date

  // Keep the selection in view. This also does the initial scroll: the default
  // selection is the newest day with data, which sits at the far RIGHT of a
  // strip that opens scrolled to the left.
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [selected])

  function step(delta: number) {
    // +1 = forward in time (right), -1 = back in time (left).
    const next = ordered[index + delta]
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
        className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto no-scrollbar py-0.5"
        role="group"
        aria-label="Select a day"
      >
        {/* Older days live to the LEFT, so the widen-the-window control does
            too — putting it at the end of the strip would mean scrolling past
            today into the future to load the past. */}
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
