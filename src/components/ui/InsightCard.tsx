import { ReactNode } from 'react'

type Props = {
  icon?: ReactNode
  title: ReactNode
  children: ReactNode
  /** Accent for the icon chip and the left rule. Defaults to the accent. */
  color?: string
  right?: ReactNode
  className?: string
}

// Short piece of interpretation — "you slept 52 minutes below your average"
// — rather than another number. Kept visually lighter than a Card so a column
// of these does not compete with the rings above them.
export function InsightCard({ icon, title, children, color, right, className = '' }: Props) {
  const accent = color ?? 'var(--c-p-hex)'
  return (
    <div
      className={`glass rounded-xl px-4 py-3.5 flex gap-3.5 items-start border-l-2 ${className}`}
      style={{ borderLeftColor: accent }}
    >
      {icon && (
        <span
          className="w-7 h-7 rounded-lg shrink-0 inline-flex items-center justify-center text-caption"
          style={{ background: `color-mix(in srgb, ${accent} 16%, transparent)`, color: accent }}
          aria-hidden
        >
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-caption font-semibold text-on-surface leading-snug">{title}</div>
        <div className="text-tiny text-on-surface-variant/60 leading-relaxed mt-1">{children}</div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}
