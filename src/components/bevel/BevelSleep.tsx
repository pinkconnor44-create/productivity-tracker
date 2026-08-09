'use client'
import { useState } from 'react'
import { Card, Section, Ring, SegmentedBar, TrendChart, MetricRow, METRIC_COLORS } from '@/components/ui'
import { formatMinutes, type HealthResponse } from '@/lib/health'
import { ChartTip, LoadingBlock, NoDayData, clockTime, dayOf, formatDay, type Tip } from './shared'

// Sleep detail: last night's ring, the stage breakdown, then the duration
// trend and a scrollable history. Stage colours are steps along the Electric
// Iris ramp — deep is the densest, awake the faintest — so the bar reads as
// one material rather than as four unrelated categories.

const STAGE_COLORS = {
  deep: '#6d3ae8',
  rem: '#8052ff',
  core: '#b096ff',
  awake: 'rgba(255,255,255,0.18)',
}

export function BevelSleep({ data, selected }: { data: HealthResponse; selected: string }) {
  const [tip, setTip] = useState<Tip | null>(null)

  const nights = data.days.filter(d => d.sleep?.asleepMin != null)
  const last = dayOf(data.days, selected)

  if (!last?.sleep?.asleepMin) {
    return <NoDayData date={selected} what="sleep recorded" />
  }

  const s = last.sleep
  const durations = nights.map(d => ({ date: d.date, value: (d.sleep!.asleepMin as number) / 60 }))
  const avgMin = nights.length
    ? nights.reduce((sum, d) => sum + (d.sleep!.asleepMin as number), 0) / nights.length
    : null
  const efficiency = s.inBedMin && s.asleepMin ? (s.asleepMin / s.inBedMin) * 100 : null

  return (
    <div className="space-y-5">
      <div className="glass rounded-2xl px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center gap-6">
        <Ring
          pct={last.scores.sleep}
          size={132}
          color={METRIC_COLORS.sleep.base}
          colorTo={METRIC_COLORS.sleep.from}
          label="Sleep"
        />
        <div className="min-w-0 flex-1 w-full">
          <div className="text-micro font-bold uppercase tracking-[0.16em] text-on-surface-variant/55">
            {formatDay(last.date)}
          </div>
          <div className="font-display text-display-sm font-semibold text-on-surface tabular-nums mt-1.5">
            {formatMinutes(s.asleepMin)}
          </div>
          <div className="text-tiny text-on-surface-variant/55 mt-1">
            {clockTime(s.start)} → {clockTime(s.end)}
            {efficiency != null && <> · {Math.round(efficiency)}% efficiency</>}
          </div>
          <div className="mt-4">
            <SegmentedBar
              segments={[
                { label: 'Deep', value: s.deepMin ?? 0, color: STAGE_COLORS.deep },
                { label: 'REM', value: s.remMin ?? 0, color: STAGE_COLORS.rem },
                { label: 'Core', value: s.coreMin ?? 0, color: STAGE_COLORS.core },
                { label: 'Awake', value: s.awakeMin ?? 0, color: STAGE_COLORS.awake },
              ]}
              format={v => formatMinutes(v)}
              emptyMessage="This night has no stage breakdown — the watch was not worn, or only recorded time asleep."
            />
          </div>
        </div>
      </div>

      <Section label="Duration · hours asleep" color={METRIC_COLORS.sleep.base} dotColor={METRIC_COLORS.sleep.base}>
        <Card padding={20}>
          {durations.length > 1
            ? <TrendChart
                data={durations}
                onHover={setTip}
                movingAvgWindow={7}
                color={METRIC_COLORS.sleep.base}
                format={v => formatMinutes(v * 60)}
              />
            : <LoadingBlock height="h-24" label="Two nights are needed to draw a trend." />}
        </Card>
      </Section>

      <Section label={`History · ${nights.length} night${nights.length === 1 ? '' : 's'}`} color={METRIC_COLORS.sleep.base} dotColor={METRIC_COLORS.sleep.base}>
        <Card padding={20}>
          <div className="mb-1">
            <MetricRow
              label="Average asleep"
              value={avgMin != null ? avgMin / 60 : null}
              unit="hr"
              decimals={1}
              sub={`across ${nights.length} night${nights.length === 1 ? '' : 's'} in range`}
            />
          </div>
          {/* Newest first — the question is almost always "how did I sleep
              recently", not "how did the range begin". */}
          <div className="max-h-[420px] overflow-y-auto no-scrollbar -mx-1 px-1">
            {[...nights].reverse().map(d => (
              <div key={d.date} className="py-2.5 border-b border-outline-variant/25 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-caption font-medium text-on-surface">{formatDay(d.date)}</div>
                    <div className="text-micro text-on-surface-variant/45 mt-0.5">
                      {clockTime(d.sleep!.start)} → {clockTime(d.sleep!.end)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-display text-body font-semibold text-on-surface tabular-nums leading-none">
                      {formatMinutes(d.sleep!.asleepMin)}
                    </div>
                    {d.scores.sleep != null && (
                      <div className="text-micro font-semibold tabular-nums mt-1" style={{ color: METRIC_COLORS.sleep.base }}>
                        {Math.round(d.scores.sleep)}
                      </div>
                    )}
                  </div>
                </div>
                <SegmentedBar
                  className="mt-2"
                  height={5}
                  legend={false}
                  segments={[
                    { label: 'Deep', value: d.sleep!.deepMin ?? 0, color: STAGE_COLORS.deep },
                    { label: 'REM', value: d.sleep!.remMin ?? 0, color: STAGE_COLORS.rem },
                    { label: 'Core', value: d.sleep!.coreMin ?? 0, color: STAGE_COLORS.core },
                    { label: 'Awake', value: d.sleep!.awakeMin ?? 0, color: STAGE_COLORS.awake },
                  ]}
                  emptyMessage=""
                />
              </div>
            ))}
          </div>
        </Card>
      </Section>

      <ChartTip tip={tip} />
    </div>
  )
}
