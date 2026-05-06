import { ReactNode } from 'react'

type Props = {
  eyebrow?: ReactNode
  title: ReactNode
  sub?: ReactNode
  right?: ReactNode
  className?: string
}

// Standard page header: eyebrow + display title + sub + optional right slot.
// Used at the top of every view for visual continuity.
export function PageHeader({ eyebrow, title, sub, right, className = '' }: Props) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6 ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-violet-400 mb-1.5">
            {eyebrow}
          </div>
        )}
        <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight leading-[1.1] text-on-surface m-0">
          {title}
        </h1>
        {sub && (
          <div className="text-[13px] text-on-surface-variant/70 mt-2 max-w-[540px] leading-relaxed">
            {sub}
          </div>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}
