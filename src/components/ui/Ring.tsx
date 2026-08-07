'use client'
import { ReactNode, useId } from 'react'
import { scoreColor } from './index'

type Props = {
  /** 0–100. null renders the "no data" dashed state. */
  pct: number | null | undefined
  size?: number
  /** Stroke width in px. Scales with size when omitted. */
  stroke?: number
  /** Override the arc colour. Defaults to scoreColor(pct). Health metrics
   *  should pass metricColor(metric) — scoreColor is a productivity traffic
   *  light and would paint a legitimately low value red. */
  color?: string
  /** Second gradient stop. Falls back to a solid arc. */
  colorTo?: string
  label?: ReactNode
  /** Centre content. Defaults to the rounded percentage. */
  children?: ReactNode
  className?: string
}

// Progress ring. Arc starts at 12 o'clock and sweeps clockwise, with round
// caps and a soft bloom in the arc colour — the treatment fitness apps use for
// score dials. The track is a hairline so the arc reads as the only mark.
export function Ring({
  pct, size = 96, stroke, color, colorTo, label, children, className = '',
}: Props) {
  // useId gives a per-instance gradient id; colons are stripped because they
  // are legal in an HTML id but break any CSS selector reaching for it.
  const gid = `ring-${useId().replace(/:/g, '')}`
  const w = stroke ?? Math.max(5, Math.round(size * 0.085))
  const r = (size - w) / 2
  const c = 2 * Math.PI * r
  const has = pct != null && Number.isFinite(pct)
  const v = has ? Math.max(0, Math.min(100, pct as number)) : 0
  const arc = c * (v / 100)
  const base = color ?? scoreColor(pct)

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={colorTo ?? base} />
            <stop offset="100%" stopColor={base} />
          </linearGradient>
        </defs>
        <circle
          cx={size/2} cy={size/2} r={r}
          fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={w}
          strokeDasharray={has ? undefined : '3 6'}
        />
        {has && v > 0 && (
          <circle
            cx={size/2} cy={size/2} r={r}
            fill="none"
            stroke={`url(#${gid})`}
            strokeWidth={w}
            strokeLinecap="round"
            strokeDasharray={`${arc} ${c - arc}`}
            style={{
              filter: `drop-shadow(0 0 6px ${base}66)`,
              transition: 'stroke-dasharray 700ms cubic-bezier(0.32,0.72,0,1)',
            }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        {children ?? (
          <span
            className="font-display font-semibold tabular-nums leading-none"
            style={{ fontSize: size * 0.28, color: has ? undefined : 'rgba(255,255,255,0.25)' }}
          >
            {has ? Math.round(v) : '—'}
            {has && <span style={{ fontSize: size * 0.15 }} className="text-on-surface-variant/60">%</span>}
          </span>
        )}
        {label && (
          <span className="text-micro font-bold uppercase tracking-[0.14em] text-on-surface-variant/55 leading-none">
            {label}
          </span>
        )}
      </div>
    </div>
  )
}
