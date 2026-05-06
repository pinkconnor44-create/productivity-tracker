type Props = { className?: string }

// 1px horizontal divider tinted by the active accent.
export function Hairline({ className = '' }: Props) {
  return <div className={`h-px w-full bg-violet-500/10 ${className}`} />
}
