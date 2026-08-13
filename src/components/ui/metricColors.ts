// Health-metric palette.
//
// Deliberately separate from scoreColor(): that is a productivity traffic
// light (>=75 green, >=50 amber, else red) and is wrong for health rings.
// A 7% Strain day is not a failure — it is a rest day — but scoreColor would
// paint it red. docs/BEVEL-PLAN.md:68 originally made scoreColor the Ring default; this
// is the correction.
//
// The three hues are not decoration. Dala's reference palette supplies
// Electric Iris and Saffron Spark, and Bevel already draws Sleep in violet
// and Strain in amber-gold, so the metric colours ARE the brand colours.

export type Metric = 'strain' | 'recovery' | 'sleep'

export const METRIC_COLORS: Record<Metric, { base: string; from: string; to: string; tint: string }> = {
  // Saffron Spark
  strain:   { base: '#ffb829', from: '#ffcb5c', to: '#f5a300', tint: 'rgba(255,184,41,0.15)' },
  recovery: { base: '#4ade80', from: '#a3e635', to: '#22c55e', tint: 'rgba(74,222,128,0.15)' },
  // Electric Iris
  sleep:    { base: '#8052ff', from: '#b096ff', to: '#6d3ae8', tint: 'rgba(128,82,255,0.15)' },
}

export function metricColor(metric: Metric): string {
  return METRIC_COLORS[metric].base
}

// Status semantics for MetricRow / StatusChip. Bevel uses green for "in the
// normal band" and blue for either direction outside it — directional, not
// judgemental, because high HRV and low RHR are both good.
export type MetricStatus = 'normal' | 'above' | 'below'

export const STATUS_STYLE: Record<MetricStatus, { fg: string; label: string; glyph: string }> = {
  normal: { fg: 'text-emerald-400', label: 'Normal range', glyph: '✓' },
  above:  { fg: 'text-blue-400',    label: 'Above normal', glyph: '↑' },
  below:  { fg: 'text-blue-400',    label: 'Below normal', glyph: '↓' },
}

/** Where `value` sits relative to a trailing baseline band. */
export function statusFor(value: number, lo: number, hi: number): MetricStatus {
  if (value > hi) return 'above'
  if (value < lo) return 'below'
  return 'normal'
}
