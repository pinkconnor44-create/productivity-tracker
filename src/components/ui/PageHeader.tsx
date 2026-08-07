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
          <div className="text-micro font-bold uppercase tracking-[0.18em] text-primary-400/90 mb-2">
            {eyebrow}
          </div>
        )}
        <h1 className="font-display text-headline sm:text-display-sm md:text-display font-semibold text-on-surface m-0">
          {title}
        </h1>
        {sub && (
          <div className="text-caption text-on-surface-variant/60 mt-2.5 max-w-[540px] leading-relaxed">
            {sub}
          </div>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}
