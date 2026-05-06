import { ReactNode, HTMLAttributes } from 'react'

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  padding?: number | string
  className?: string
  noBorder?: boolean
  // Toggle the inset top highlight + drop shadow combo from the design.
  flat?: boolean
}

// Standard panel container — glass-tinted, accent-bordered.
// Use for any list, chart, or grouped content. Inherits accent color via globals.css overrides.
export function Card({
  children,
  padding,
  className = '',
  noBorder = false,
  flat = false,
  style,
  ...rest
}: Props) {
  const padStyle =
    padding === undefined
      ? undefined
      : typeof padding === 'number'
      ? { padding: `${padding}px` }
      : { padding }
  return (
    <div
      {...rest}
      style={{ ...padStyle, ...style }}
      className={[
        'bg-surface-container rounded-2xl overflow-hidden',
        noBorder ? '' : 'border border-outline-variant/40',
        flat ? '' : 'shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_32px_rgba(0,0,0,0.4)]',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  )
}
