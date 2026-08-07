import { ReactNode, HTMLAttributes } from 'react'

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  padding?: number | string
  className?: string
  noBorder?: boolean
  // Toggle the inset top highlight + drop shadow combo from the design.
  flat?: boolean
  // Opt out of translucency — opaque near-black surface instead.
  solid?: boolean
}

// Standard panel container. Renders as real glass (`.glass` — translucent +
// backdrop blur), so the ambient bloom reads through it. Pass `solid` for the
// rare case that needs an opaque surface, e.g. a panel sitting over another
// blurred panel, where stacking two backdrop-filters muddies both.
export function Card({
  children,
  padding,
  className = '',
  noBorder = false,
  flat = false,
  solid = false,
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
        'rounded-2xl overflow-hidden',
        // `.glass` supplies its own border + highlight + depth shadow, and it
        // is declared after @tailwind utilities, so it would win the border at
        // equal specificity anyway. Only the solid variant styles those here.
        solid ? 'bg-surface-container' : 'glass',
        solid && !noBorder ? 'border border-outline-variant/40' : '',
        solid && !flat ? 'shadow-glass' : '',
        noBorder ? 'border-0' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  )
}
