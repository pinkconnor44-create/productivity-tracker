'use client'
import { useState } from 'react'
import { Card, Section, Ring, TrendChart, MetricRow, RangeGauge, StatusChip, METRIC_COLORS, statusFor } from '@/components/ui'
import { HEALTH_CONSTANTS, deltaPct, interpolate, type HealthResponse } from '@/lib/health'
import { ChartTip, LoadingBlock, CalibratingNote, NoDayData, dayOf, formatDay, seriesOf, type Tip } from './shared'

// Recovery detail: the ring, the three sleep-window readings that drive it
// against their personal baselines, and an explicit breakdown of how the score
// was reached.
//
// The breakdown is the point of this tab. A recovery number with no visible
// derivation is exactly the thing Connor would have to take on faith, and
// these are approximations of Bevel's scores — showing the arithmetic makes
// them auditable instead of magic.
//
// Everything shown is measured INSIDE last night's sleep window, which is why
// the number holds still all day. The daytime HRV and resting-HR readings that
// used to be shown here were not what the score was computed from — the score
// had already moved to a sleeping heart rate while this panel still explained
// it with Apple's resting HR, so the "derivation" was describing a different
// calculation from the one that produced the number above it.

export function BevelRecovery({ data, selected }: { data: HealthResponse; selected: string }) {
  const [hrvTip, setHrvTip] = useState<Tip | null>(null)
  const [rhrTip, setRhrTip] = useState<Tip | null>(null)

  const day = dayOf(data.days, selected)
  // Trends over the same quantity the score uses, not the daytime one.
  const hrvSeries = data.days
    .filter(d => d.sleepWindow?.hrv != null)
    .map(d => ({ date: d.date, value: d.sleepWindow!.hrv! }))
  const rhrSeries = data.days
    .filter(d => d.sleepWindow?.hr != null)
    .map(d => ({ date: d.date, value: d.sleepWindow!.hr! }))

  if (!day || day.scores.recovery == null) {
    return <NoDayData date={selected} what="recovery score" />
  }

  const sw = day.sleepWindow
  const hrv = sw?.hrv ?? null
  const hrvBaseValue = sw?.hrvBaseline ?? null
  const hr = sw?.hr ?? null
  const hrBaseValue = sw?.hrBaseline ?? null
  const resp = sw?.resp ?? null
  const respBaseValue = sw?.respBaseline ?? null

  const C = HEALTH_CONSTANTS.RECOVERY
  // Recomputed here from the same pure functions and the same inputs the API
  // used, so the breakdown can never disagree with the score it is explaining.
  const components = [
    {
      name: 'Sleeping heart rate',
      weight: C.W_SLEEP_HR,
      score: hr != null && hrBaseValue ? interpolate(C.HR_ANCHORS, hr / hrBaseValue) : null,
      detail: hr != null && hrBaseValue ? `${hr.toFixed(1)}bpm vs ${hrBaseValue.toFixed(1)}bpm baseline` : 'no readings in the sleep window',
    },
    {
      name: 'Sleeping HRV',
      weight: C.W_SLEEP_HRV,
      score: hrv != null && hrvBaseValue ? interpolate(C.HRV_ANCHORS, hrv / hrvBaseValue) : null,
      detail: hrv != null && hrvBaseValue ? `${hrv.toFixed(0)}ms vs ${hrvBaseValue.toFixed(0)}ms baseline` : 'no readings in the sleep window',
    },
    {
      name: 'Sleeping respiratory rate',
      weight: C.W_SLEEP_RESP,
      score: resp != null && respBaseValue ? interpolate(C.RESP_ANCHORS, resp / respBaseValue) : null,
      detail: resp != null && respBaseValue ? `${resp.toFixed(1)} br/min vs ${respBaseValue.toFixed(1)} baseline` : 'no readings in the sleep window',
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
            <div className="text-micro text-on-surface-variant/45 mt-1">
              Locked at wake · from {sw?.hrN ?? 0} readings during sleep
            </div>
          </div>
          <MetricRow
            label="Sleeping HRV"
            value={hrv}
            unit="ms"
            delta={deltaPct(hrv, hrvBaseValue)}
            status={hrv != null && hrvBaseValue ? statusFor(hrv, hrvBaseValue * 0.9, hrvBaseValue * 1.1) : undefined}
            sub={hrvBaseValue ? `baseline ${hrvBaseValue.toFixed(0)}ms` : 'no baseline yet'}
          />
          <MetricRow
            label="Sleeping heart rate"
            value={hr}
            unit="bpm"
            delta={deltaPct(hr, hrBaseValue)}
            status={hr != null && hrBaseValue ? statusFor(hr, hrBaseValue * 0.95, hrBaseValue * 1.05) : undefined}
            sub={hrBaseValue ? `baseline ${hrBaseValue.toFixed(1)}bpm` : 'no baseline yet'}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section label="Where last night sits · Sleeping HRV" color={METRIC_COLORS.recovery.base} dotColor={METRIC_COLORS.recovery.base}>
          <Card padding={20}>
            <RangeGauge value={hrv} baseline={hrvBaseValue} color={METRIC_COLORS.recovery.base} format={v => `${Math.round(v)}ms`} />
          </Card>
        </Section>
        <Section label="Where last night sits · Sleeping HR" color={METRIC_COLORS.recovery.base} dotColor={METRIC_COLORS.recovery.base}>
          <Card padding={20}>
            <RangeGauge value={hr} baseline={hrBaseValue} bandPct={0.05} color={METRIC_COLORS.recovery.base} format={v => `${v.toFixed(1)}`} />
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
        <Section label="Sleeping HRV trend" color={METRIC_COLORS.recovery.base} dotColor={METRIC_COLORS.recovery.base}>
          <Card padding={20}>
            {hrvSeries.length > 1
              ? <TrendChart
                  data={hrvSeries}
                  onHover={setHrvTip}
                  color={METRIC_COLORS.recovery.base}
                  format={v => `${v.toFixed(0)} ms`}
                  refLine={hrvBaseValue != null ? { value: hrvBaseValue, label: 'baseline' } : null}
                />
              : <LoadingBlock height="h-24" label="Not enough nights with HRV readings yet." />}
          </Card>
        </Section>
        <Section label="Sleeping HR trend" color={METRIC_COLORS.recovery.base} dotColor={METRIC_COLORS.recovery.base}>
          <Card padding={20}>
            {rhrSeries.length > 1
              ? <TrendChart
                  data={rhrSeries}
                  onHover={setRhrTip}
                  color={METRIC_COLORS.recovery.base}
                  format={v => `${v.toFixed(1)} bpm`}
                  refLine={hrBaseValue != null ? { value: hrBaseValue, label: 'baseline' } : null}
                />
              : <LoadingBlock height="h-24" label="Not enough nights with heart-rate readings yet." />}
          </Card>
        </Section>
      </div>

      <ChartTip tip={hrvTip ?? rhrTip} />
    </div>
  )
}
