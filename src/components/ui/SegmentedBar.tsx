import { ReactNode } from 'react'

export type BarSegment = {
  label: string
  value: number
  color: string
}

type Props = {
  segments: BarSegment[]
  /** Renders label · value under the bar. */
  format?: (v: number) => string
  height?: number
  legend?: boolean
  emptyMessage?: ReactNode
  className?: string
}

// Proportional stacked bar — sleep stages, energy splits, anything that is a
// whole divided into parts. Segments size themselves by share of the total, so
// callers pass raw values and never percentages.
export function SegmentedBar({
  segments, format = v => String(Math.round(v)), height = 12, legend = true, emptyMessage, className = '',
}: Props) {
  const usable = segments.filter(s => Number.isFinite(s.value) && s.value > 0)
  const total = usable.reduce((s, x) => s + x.value, 0)

  if (total <= 0) {
    return (
      <div className={`text-tiny text-on-surface-variant/45 ${className}`}>
        {emptyMessage ?? 'No breakdown recorded'}
      </div>
    )
  }

  return (
    <div className={className}>
      <div
        className="flex w-full rounded-full overflow-hidden bg-white/[0.05]"
        style={{ height }}
        role="img"
        aria-label={usable.map(s => `${s.label} ${format(s.value)}`).join(', ')}
      >
        {usable.map(s => (
          <div
            key={s.label}
            // Bare title, not a hover-revealed overlay: this has to stay
            // readable on a phone, where hover does not exist at all.
            title={`${s.label} · ${format(s.value)}`}
            style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
          />
        ))}
      </div>
      {legend && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
          {usable.map(s => (
            <span key={s.label} className="inline-flex items-center gap-1.5 text-tiny">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="text-on-surface-variant/60">{s.label}</span>
              <span className="font-semibold text-on-surface tabular-nums">{format(s.value)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
