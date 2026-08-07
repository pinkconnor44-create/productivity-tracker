import { STATUS_STYLE, type MetricStatus } from './metricColors'

type Props = {
  status: MetricStatus
  /** Replaces the default "Above normal" wording. */
  label?: string
  className?: string
}

// Tiny status pill: glyph + word. Bevel uses green for "inside your normal
// band" and blue for either direction outside it — deliberately directional
// rather than judgemental, because a high HRV and a low resting HR are both
// good news and a traffic light would paint one of them red.
export function StatusChip({ status, label, className = '' }: Props) {
  const s = STATUS_STYLE[status]
  return (
    <span
      className={[
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full',
        'text-micro font-bold uppercase tracking-[0.1em] whitespace-nowrap',
        'bg-white/[0.04] border border-outline-variant/40',
        s.fg,
        className,
      ].join(' ')}
    >
      <span aria-hidden>{s.glyph}</span>
      {label ?? s.label}
    </span>
  )
}
