import { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
}

// Tiny uppercase tracked label. Used above titles and inside cards.
export function Eyebrow({ children, className = '' }: Props) {
  return (
    <div className={`text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/60 ${className}`}>
      {children}
    </div>
  )
}
