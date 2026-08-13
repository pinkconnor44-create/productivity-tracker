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
// Health primitives (C4). Shared, not bevel/-local, so any view can use them.
export { RingCluster } from './RingCluster'
export type { ClusterItem } from './RingCluster'
export { MetricRow } from './MetricRow'
export { StatusChip } from './StatusChip'
export { RangeGauge } from './RangeGauge'
export { SegmentedBar } from './SegmentedBar'
export type { BarSegment } from './SegmentedBar'
export { InsightCard } from './InsightCard'
export { METRIC_COLORS, metricColor, STATUS_STYLE, statusFor } from './metricColors'
export type { Metric, MetricStatus } from './metricColors'

export { WeightPicker } from './WeightPicker'

// Score colour — productivity traffic light, used across views for "today"
// stats and bars. NOT for health metrics: a low Strain day is a rest day,
// not a failure. Use metricColor() from ./metricColors for those.
//
// This is THE one threshold ladder (item 15): every score-coloured element
// routes through scoreGrade, and the colours come from the --success/--warn/
// --danger tokens in globals.css rather than hard-coded hex twins. Four
// parallel ladders had already drifted — two adjacent StatCards painted
// different greens, and a 60% day rendered two different hues on one page.
export type ScoreGrade = 'high' | 'mid' | 'low'
export function scoreGrade(pct: number | null | undefined): ScoreGrade {
  const p = pct ?? 0
  return p >= 75 ? 'high' : p >= 50 ? 'mid' : 'low'
}
const GRADE_VAR: Record<ScoreGrade, string> = {
  high: '--success', mid: '--warn', low: '--danger',
}
export function scoreColor(pct: number | null | undefined): string {
  return `rgb(var(${GRADE_VAR[scoreGrade(pct)]}))`
}
/** Same ladder, translucent — the tokens are space-separated tuples so the
 *  slash-alpha form is valid. */
export function scoreColorAlpha(pct: number | null | undefined, alpha: number): string {
  return `rgb(var(${GRADE_VAR[scoreGrade(pct)]}) / ${alpha})`
}
