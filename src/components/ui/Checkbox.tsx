import { kindStyle } from './kindColors'

type Props = {
  checked: boolean
  onClick?: (e: React.MouseEvent) => void
  skipped?: boolean
  kind?: string | null
  // Color when checked (default: emerald).
  color?: string
  size?: number
  className?: string
  disabled?: boolean
  ariaLabel?: string
}

// 18px checkbox with three states: checked / skipped (excused) / unchecked.
// `kind` colors the unchecked ring so the calendar/task rows can carry kind hints in micro-UI.
export function Checkbox({
  checked,
  onClick,
  skipped,
  kind,
  color = '#10b981',
  size = 18,
  className = '',
  disabled,
  ariaLabel,
}: Props) {
  const k = kindStyle(kind)
  const ringColor = k?.dot ?? 'rgba(var(--c-p), 0.55)'
  const isLocked = disabled || skipped
  return (
    <button
      type="button"
      aria-label={ariaLabel ?? (checked ? 'Mark incomplete' : 'Mark complete')}
      aria-checked={checked}
      role="checkbox"
      onClick={onClick}
      disabled={isLocked}
      className={`p-0 inline-flex items-center justify-center shrink-0 rounded-md transition-all ${
        isLocked ? 'cursor-not-allowed' : 'cursor-pointer'
      } ${className}`}
      style={{
        width: size,
        height: size,
        border: skipped
          ? '2px solid rgba(245,158,11,0.4)'
          : checked
          ? 'none'
          : `2px solid ${ringColor}`,
        background: skipped ? 'rgba(245,158,11,0.15)' : checked ? color : 'transparent',
      }}
    >
      {checked && !skipped && (
        <svg width={Math.round(size * 0.6)} height={Math.round(size * 0.6)} viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}
