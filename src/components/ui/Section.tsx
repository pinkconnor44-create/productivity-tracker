import { ReactNode } from 'react'

type Props = {
  label: ReactNode
  count?: number
  total?: number
  color?: string       // CSS color for the leading dot + label tint (default: accent via primary-400)
  dotColor?: string    // override dot color separately
  right?: ReactNode
  children?: ReactNode
}

// "● LABEL · 3/5  [right]" header above a list/card. Use for any grouped section.
// `color` controls the dot AND label color when given as a hex/CSS color string.
// Pass nothing for the label to use the accent (primary-*).
export function Section({ label, count, total, color, dotColor, right, children }: Props) {
  const labelStyle = color ? { color } : undefined
  const dotStyle = { background: dotColor ?? color ?? undefined }
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5 px-0.5">
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${color || dotColor ? '' : 'bg-primary-400'}`}
          style={dotStyle}
        />
        <span
          className={`text-micro font-bold uppercase tracking-[0.16em] ${color ? '' : 'text-primary-400'}`}
          style={labelStyle}
        >
          {label}
        </span>
        {total != null && (
          <span className="text-tiny text-on-surface-variant/50 font-semibold tabular-nums ml-auto">
            {count ?? 0}/{total}
          </span>
        )}
        {right && <div className={total != null ? '' : 'ml-auto'}>{right}</div>}
      </div>
      {children}
    </div>
  )
}
