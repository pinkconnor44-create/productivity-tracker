'use client'
import { useState } from 'react'
import { Card, Section, Ring, TrendChart, MetricRow, RangeGauge, StatusChip, METRIC_COLORS, statusFor } from '@/components/ui'
import { HEALTH_CONSTANTS, deltaPct, interpolate, type HealthResponse } from '@/lib/health'
import { ChartTip, LoadingBlock, CalibratingNote, formatDay, latestDayWith, seriesOf, type Tip } from './shared'

// Recovery detail: the ring, the two inputs that drive it against their
// personal baselines, and an explicit breakdown of how the score was reached.
//
// The breakdown is the point of this tab. A recovery number with no visible
// derivation is exactly the thing Connor would have to take on faith, and
// these are approximations of Bevel's scores — showing the arithmetic makes
// them auditable instead of magic.

export function BevelRecovery({ data }: { data: HealthResponse }) {
  const [hrvTip, setHrvTip] = useState<Tip | null>(null)
  const [rhrTip, setRhrTip] = useState<Tip | null>(null)

  const day = latestDayWith(data.days, d => d.scores.recovery != null)
  const hrvSeries = seriesOf(data.days, 'hrv')
  const rhrSeries = seriesOf(data.days, 'restingHr')

  if (!day) {
    return <Card padding={20}><LoadingBlock label="Not enough data to score recovery yet." /></Card>
  }

  const hrvBase = data.baselines.hrv
  const rhrBase = data.baselines.restingHr
  const hrv = day.metrics.hrv ?? null
  const rhr = day.metrics.restingHr ?? null

  const C = HEALTH_CONSTANTS.RECOVERY
  // Recomputed here from the same pure functions the API used, so the
  // breakdown can never disagree with the score it is explaining.
  const components = [
    {
      name: 'HRV vs baseline',
      weight: C.W_HRV,
      score: hrv != null && hrvBase?.value ? interpolate(C.HRV_ANCHORS, hrv / hrvBase.value) : null,
      detail: hrv != null && hrvBase?.value ? `${hrv.toFixed(0)}ms vs ${hrvBase.value.toFixed(0)}ms` : 'no baseline yet',
    },
    {
      name: 'Resting HR vs baseline',
      weight: C.W_RHR,
      score: rhr != null && rhrBase?.value ? interpolate(C.RHR_ANCHORS, rhr / rhrBase.value) : null,
      detail: rhr != null && rhrBase?.value ? `${rhr.toFixed(0)}bpm vs ${rhrBase.value.toFixed(0)}bpm` : 'no baseline yet',
    },
    {
      name: 'Last night’s sleep',
      weight: C.W_SLEEP,
      score: day.scores.sleep,
      detail: day.scores.sleep != null ? `sleep score ${Math.round(day.scores.sleep)}` : 'no sleep recorded',
    },
  ]
  const live = components.filter(c => c.score != null)
  const wSum = live.reduce((s, c) => s + c.weight, 0)

  return (
    <div className="space-y-5">
      <div className="glass rounded-2xl px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center gap-6">
        <Ring
          pct={day.scores.recovery}
          size={132}
          color={METRIC_COLORS.recovery.base}
          colorTo={METRIC_COLORS.recovery.from}
          label="Recovery"
        />
        <div className="min-w-0 flex-1 w-full space-y-3">
          <div>
            <div className="text-micro font-bold uppercase tracking-[0.16em] text-on-surface-variant/55">
              {formatDay(day.date)}
            </div>
            {(hrvBase?.calibrating || rhrBase?.calibrating) && (
              <div className="mt-1.5"><CalibratingNote n={Math.max(hrvBase?.n ?? 0, rhrBase?.n ?? 0)} /></div>
            )}
          </div>
          <MetricRow
            label="HRV"
            value={hrv}
            unit="ms"
            delta={deltaPct(hrv, hrvBase?.value)}
            status={hrv != null && hrvBase?.value ? statusFor(hrv, hrvBase.value * 0.9, hrvBase.value * 1.1) : undefined}
            sub={hrvBase?.value ? `baseline ${hrvBase.value.toFixed(0)}ms` : 'no baseline yet'}
          />
          <MetricRow
            label="Resting heart rate"
            value={rhr}
            unit="bpm"
            delta={deltaPct(rhr, rhrBase?.value)}
            status={rhr != null && rhrBase?.value ? statusFor(rhr, rhrBase.value * 0.95, rhrBase.value * 1.05) : undefined}
            sub={rhrBase?.value ? `baseline ${rhrBase.value.toFixed(0)}bpm` : 'no baseline yet'}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section label="Where today sits · HRV" color={METRIC_COLORS.recovery.base} dotColor={METRIC_COLORS.recovery.base}>
          <Card padding={20}>
            <RangeGauge value={hrv} baseline={hrvBase?.value} color={METRIC_COLORS.recovery.base} format={v => `${Math.round(v)}ms`} />
          </Card>
        </Section>
        <Section label="Where today sits · Resting HR" color={METRIC_COLORS.recovery.base} dotColor={METRIC_COLORS.recovery.base}>
          <Card padding={20}>
            <RangeGauge value={rhr} baseline={rhrBase?.value} bandPct={0.05} color={METRIC_COLORS.recovery.base} format={v => `${Math.round(v)}`} />
          </Card>
        </Section>
      </div>

      <Section label="How this score was reached" color={METRIC_COLORS.recovery.base} dotColor={METRIC_COLORS.recovery.base}>
        <Card padding={20}>
          {components.map(c => {
            // Weights renormalise over whichever components have data, so the
            // percentages shown are the ones actually applied — not the
            // nominal 50/30/20 that would mislead on a day with no HRV.
            const applied = c.score != null && wSum > 0 ? (c.weight / wSum) * 100 : 0
            return (
              <div key={c.name} className="flex items-center gap-3 py-2.5 border-b border-outline-variant/25 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="text-caption font-medium text-on-surface">{c.name}</div>
                  <div className="text-micro text-on-surface-variant/45 mt-0.5">{c.detail}</div>
                </div>
                {c.score == null
                  ? <StatusChip status="normal" label="Not counted" className="opacity-50" />
                  : <span className="text-micro font-semibold text-on-surface-variant/50 tabular-nums shrink-0">
                      {Math.round(applied)}% weight
                    </span>}
                <div className="font-display text-body-lg font-semibold tabular-nums w-12 text-right shrink-0"
                  style={{ color: c.score == null ? undefined : METRIC_COLORS.recovery.base }}>
                  {c.score == null ? <span className="text-on-surface-variant/30">—</span> : Math.round(c.score)}
                </div>
              </div>
            )
          })}
        </Card>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section label="HRV trend" color={METRIC_COLORS.recovery.base} dotColor={METRIC_COLORS.recovery.base}>
          <Card padding={20}>
            {hrvSeries.length > 1
              ? <TrendChart
                  data={hrvSeries}
                  onHover={setHrvTip}
                  color={METRIC_COLORS.recovery.base}
                  format={v => `${v.toFixed(0)} ms`}
                  refLine={hrvBase?.value != null ? { value: hrvBase.value, label: 'baseline' } : null}
                />
              : <LoadingBlock height="h-24" label="Not enough HRV readings yet." />}
          </Card>
        </Section>
        <Section label="Resting HR trend" color={METRIC_COLORS.recovery.base} dotColor={METRIC_COLORS.recovery.base}>
          <Card padding={20}>
            {rhrSeries.length > 1
              ? <TrendChart
                  data={rhrSeries}
                  onHover={setRhrTip}
                  color={METRIC_COLORS.recovery.base}
                  format={v => `${v.toFixed(0)} bpm`}
                  refLine={rhrBase?.value != null ? { value: rhrBase.value, label: 'baseline' } : null}
                />
              : <LoadingBlock height="h-24" label="Not enough resting HR readings yet." />}
          </Card>
        </Section>
      </div>

      <ChartTip tip={hrvTip ?? rhrTip} />
    </div>
  )
}
