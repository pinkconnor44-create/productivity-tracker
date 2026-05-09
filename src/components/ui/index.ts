// Shared UI primitives — Lumina design system.
// All components route through Tailwind + the semantic surface ladder + accent CSS variables
// in globals.css. Do NOT add inline raw hex here — it breaks accent theme switching.

export { PageHeader } from './PageHeader'
export { StatCard } from './StatCard'
export { Card } from './Card'
export { Section } from './Section'
export { KindChip } from './KindChip'
export { KindPicker } from './KindPicker'
export { ConfirmProvider, useConfirm } from './ConfirmDialog'
export { KIND_COLORS, KIND_LIST, kindStyle } from './kindColors'
export type { Kind } from './kindColors'

// Score color helper — used across views for "today" stats and bars.
export function scoreColor(pct: number | null | undefined): string {
  const p = pct ?? 0
  if (p >= 75) return '#10b981'
  if (p >= 50) return '#f59e0b'
  return '#f43f5e'
}
