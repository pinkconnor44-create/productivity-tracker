import { Kind, KIND_COLORS, KIND_LIST } from './kindColors'

type Props = {
  value: Kind | null | undefined
  onChange: (next: Kind | null) => void
  size?: 'sm' | 'md'
}

// Row of 5 chip buttons + a "Clear" affordance. Click the active chip to clear.
// Used in the task create/edit form.
export function KindPicker({ value, onChange, size = 'md' }: Props) {
  const padding = size === 'sm' ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-[11px]'
  return (
    <div className="flex flex-wrap gap-1.5">
      {KIND_LIST.map((k) => {
        const s = KIND_COLORS[k]
        const active = value === k
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(active ? null : k)}
            className={[
              'inline-flex items-center gap-1.5 rounded-full font-semibold transition-all',
              padding,
              active
                ? `${s.bg} ${s.fg} ${s.border} border`
                : 'bg-surface-container-low text-on-surface-variant/70 border border-outline-variant/40 hover:text-on-surface',
            ].join(' ')}
            aria-pressed={active}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
            {s.label}
          </button>
        )
      })}
    </div>
  )
}
