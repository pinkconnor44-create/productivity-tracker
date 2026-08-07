type Props = {
  value: number | null | undefined
  /** Centre of the normal band — the trailing baseline. */
  baseline: number | null | undefined
  /** Half-width of the normal band, as a fraction of the baseline. */
  bandPct?: number
  color?: string
  format?: (v: number) => string
  className?: string
}

// Horizontal "where does today sit against your normal" gauge: a tinted band
// for the usual range, a hairline at the baseline, and a marker for today.
//
// The axis spans baseline ± 2.5 band-widths so a value well outside the band
// still lands on the track instead of clipping off the end — the marker is
// clamped, but the number beside it is not, so an outlier is still readable.
export function RangeGauge({
  value, baseline, bandPct = 0.10, color = 'var(--c-p-hex)', format = v => String(Math.round(v)), className = '',
}: Props) {
  const hasBase = baseline != null && Number.isFinite(baseline) && baseline !== 0
  const hasVal = value != null && Number.isFinite(value)

  if (!hasBase) {
    return (
      <div className={`text-micro text-on-surface-variant/40 ${className}`}>
        Calibrating — no baseline yet
      </div>
    )
  }

  const base = baseline as number
  const half = Math.abs(base * bandPct)
  const lo = base - half
  const hi = base + half
  const axisLo = base - half * 2.5
  const axisHi = base + half * 2.5
  const span = axisHi - axisLo || 1
  const pos = (v: number) => Math.max(0, Math.min(100, ((v - axisLo) / span) * 100))

  return (
    <div className={className}>
      <div className="relative h-2 rounded-full bg-white/[0.05] overflow-hidden">
        <div
          className="absolute inset-y-0 rounded-full"
          style={{ left: `${pos(lo)}%`, width: `${pos(hi) - pos(lo)}%`, background: color, opacity: 0.22 }}
        />
        <div className="absolute inset-y-0 w-px bg-white/25" style={{ left: `${pos(base)}%` }} />
      </div>
      {hasVal && (
        <div className="relative h-0">
          <div
            className="absolute -top-[13px] w-[3px] h-[14px] rounded-full"
            style={{ left: `calc(${pos(value as number)}% - 1.5px)`, background: color, boxShadow: `0 0 6px ${color}` }}
          />
        </div>
      )}
      <div className="flex justify-between mt-2 text-micro text-on-surface-variant/40 tabular-nums">
        <span>{format(lo)}</span>
        <span className="text-on-surface-variant/55">baseline {format(base)}</span>
        <span>{format(hi)}</span>
      </div>
    </div>
  )
}
