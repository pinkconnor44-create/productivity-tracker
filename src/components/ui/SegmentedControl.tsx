'use client'
import { ReactNode } from 'react'

export type SegmentOption<T extends string> = { value: T; label: ReactNode }

type Props<T extends string> = {
  options: SegmentOption<T>[]
  value: T
  onChange: (v: T) => void
  /** Horizontal scroll instead of wrapping. Needed once there are more than
   *  ~4 segments, e.g. the Bevel sub-tab bar on a phone. */
  scrollable?: boolean
  className?: string
  ariaLabel?: string
}

// Pill-in-a-trough segmented control. Extracted verbatim from StatsView's
// 30/90/365 range picker so the Bevel sub-tab bar consumes it instead of
// forking the styling (which is what plan.md originally called for).
export function SegmentedControl<T extends string>({
  options, value, onChange, scrollable = false, className = '', ariaLabel,
}: Props<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={[
        'flex bg-surface-container-low border border-outline-variant/40 rounded-lg p-0.5 gap-0.5',
        scrollable ? 'overflow-x-auto no-scrollbar max-w-full' : 'flex-wrap',
        className,
      ].join(' ')}
    >
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`shrink-0 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors ${
            value === o.value
              ? 'bg-violet-500/16 text-violet-300 border border-violet-400/30'
              : 'text-on-surface-variant/70 hover:text-on-surface'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
