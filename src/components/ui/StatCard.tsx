import { ReactNode } from 'react'

type Props = {
  label: ReactNode
  value: ReactNode
  suffix?: ReactNode
  sub?: ReactNode
  // CSS color string (hex). When provided, used for the value text + bar fill.
  // When omitted, uses on-surface for value and accent (primary-400) for bar.
  color?: string
  barPct?: number    // 0..100; if provided, renders a 3px progress bar
  className?: string
}

// Hero stat block: eyebrow / big tabular metric / sub / progress meter.
//
// The metric carries the whole card, so it is deliberately large and set in
// the display face with tabular figures and negative tracking — the same
// treatment fitness apps give their headline numbers. Everything else recedes:
// the eyebrow is a quiet micro-label and the meter is a hairline.
export function StatCard({ label, value, suffix, sub, color, barPct, className = '' }: Props) {
  const isPlaceholder = value === '—' || value == null
  const valueStyle = color && !isPlaceholder ? { color } : undefined
  const barStyle = color ? { background: color } : undefined
  return (
    <div
      className={[
        'group flex-1 min-w-0 px-4 py-4 rounded-xl flex flex-col gap-2.5',
        'glass transition-colors duration-200',
        className,
      ].filter(Boolean).join(' ')}
    >
      <div className="text-micro font-bold uppercase tracking-[0.14em] text-on-surface-variant/60">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={`font-display text-display-sm font-semibold tabular-nums ${
            isPlaceholder ? 'text-on-surface-variant/30' : color ? '' : 'text-on-surface'
          }`}
          style={valueStyle}
        >
          {isPlaceholder ? '—' : value}
        </span>
        {suffix != null && !isPlaceholder && (
          <span className="text-caption font-semibold text-on-surface-variant/60">{suffix}</span>
        )}
      </div>
      {sub && (
        <div className="text-tiny text-on-surface-variant/50 leading-snug">{sub}</div>
      )}
      {barPct != null && (
        <div className="h-[2px] bg-white/[0.06] rounded-full overflow-hidden mt-auto">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ease-snap ${color ? '' : 'bg-primary-400'}`}
            style={{ width: `${Math.max(0, Math.min(100, barPct))}%`, ...barStyle }}
          />
        </div>
      )}
    </div>
  )
}
