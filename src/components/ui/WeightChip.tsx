type Props = {
  weight: number
  size?: 'sm' | 'md'
  className?: string
}

const LABELS = ['', 'Normal', 'Important', 'Critical']
const STYLES = [
  '',
  'bg-surface-container-high text-on-surface-variant/70',  // normal — only renders if explicitly requested via showNormal
  'bg-blue-500/15 text-blue-300',
  'bg-orange-500/15 text-orange-300',
] as const

// Pill for task/habit weight. Hidden for weight=1 (the default) — clutter reducer.
// Use `<WeightChip weight={2}/>` to show Important. Pass weight=1 and it returns null.
export function WeightChip({ weight, size = 'md', className = '' }: Props) {
  if (weight == null || weight === 1) return null
  const padding = size === 'sm' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'
  return (
    <span className={`inline-flex items-center rounded-full font-bold tracking-[0.04em] ${STYLES[weight] ?? STYLES[1]} ${padding} ${className}`}>
      {LABELS[weight] ?? ''}
    </span>
  )
}
