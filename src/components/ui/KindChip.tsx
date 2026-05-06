import { Kind, kindStyle } from './kindColors'

type Props = {
  kind: Kind | string | null | undefined
  size?: 'sm' | 'md'
  className?: string
}

// Small pill rendering a task's kind (meeting/focus/personal/admin/planning).
// Returns null for unrecognized/missing kinds — render nothing, don't show "untagged".
export function KindChip({ kind, size = 'md', className = '' }: Props) {
  const s = kindStyle(kind)
  if (!s) return null
  const padding = size === 'sm' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full font-bold tracking-[0.04em]',
        s.bg, s.fg, padding, className,
      ].join(' ')}
    >
      <span className="w-1 h-1 rounded-full" style={{ background: s.dot }} />
      {s.label}
    </span>
  )
}
