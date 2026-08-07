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
export { SegmentedControl } from './SegmentedControl'
export type { SegmentOption } from './SegmentedControl'
export { Ring } from './Ring'
export { TrendChart } from './TrendChart'
export type { TrendPoint, TrendTip } from './TrendChart'
export { METRIC_COLORS, metricColor, STATUS_STYLE, statusFor } from './metricColors'
export type { Metric, MetricStatus } from './metricColors'

// Score color helper — productivity traffic light, used across views for
// "today" stats and bars. NOT for health metrics: a low Strain day is a rest
// day, not a failure. Use metricColor() from ./metricColors for those.
export function scoreColor(pct: number | null | undefined): string {
  const p = pct ?? 0
  if (p >= 75) return '#4ade80'
  if (p >= 50) return '#ffb829'
  return '#f43f5e'
}
