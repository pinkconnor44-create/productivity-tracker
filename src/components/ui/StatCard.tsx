import { ReactNode } from 'react'

type Props = {
  label: ReactNode
  value: ReactNode
  suffix?: ReactNode
  sub?: ReactNode
  // CSS color string (hex). When provided, used for the value text + bar fill.
  // When omitted, uses on-surface for value and accent (violet-400) for bar.
  color?: string
  barPct?: number    // 0..100; if provided, renders a 3px progress bar
  className?: string
}

// Hero stat block. Used in stat strips at the top of every redesigned view.
// Faithful to the design mock: eyebrow / huge tnum value / sub / colored bar.
export function StatCard({ label, value, suffix, sub, color, barPct, className = '' }: Props) {
  const isPlaceholder = value === '—' || value == null
  const valueStyle = color && !isPlaceholder ? { color } : undefined
  const barStyle = color ? { background: color } : undefined
  return (
    <div
      className={[
        'flex-1 min-w-0 px-3.5 py-3.5 rounded-xl flex flex-col gap-2',
        'bg-surface-container border border-outline-variant/40',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
        className,
      ].filter(Boolean).join(' ')}
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/70">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={`font-display text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums ${
            isPlaceholder ? 'text-on-surface-variant/40' : color ? '' : 'text-on-surface'
          }`}
          style={valueStyle}
        >
          {isPlaceholder ? '—' : value}
        </span>
        {suffix != null && !isPlaceholder && (
          <span className="text-[12px] font-semibold text-on-surface-variant/70">{suffix}</span>
        )}
      </div>
      {sub && (
        <div className="text-[11px] text-on-surface-variant/60 leading-snug">{sub}</div>
      )}
      {barPct != null && (
        <div className="h-[3px] bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${color ? '' : 'bg-violet-400'}`}
            style={{ width: `${Math.max(0, Math.min(100, barPct))}%`, ...barStyle }}
          />
        </div>
      )}
    </div>
  )
}
