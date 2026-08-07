'use client'
import { StatCard, RingCluster, InsightCard, Section, Card, TrendChart, METRIC_COLORS } from '@/components/ui'
import { deltaPct, formatMinutes, METRIC_DEFS, type HealthResponse, type MetricKey } from '@/lib/health'
import { ChartTip, CalibratingNote, formatDay, latestDayWith, scoreSeries, type Tip } from './shared'
import { useState } from 'react'
import type { BevelTab } from '../BevelView'

// Dashboard — the "how am I today" surface. Three score rings, then the raw
// readings behind them, then a short line of interpretation. Everything below
// the rings exists to answer "why is that number what it is".

const STAT_KEYS: MetricKey[] = ['hrv', 'restingHr', 'steps', 'activeKcal', 'exerciseMin', 'respRate', 'spo2', 'vo2Max']

export function BevelDashboard({ data, onOpen }: { data: HealthResponse; onOpen: (t: BevelTab) => void }) {
  const [tip, setTip] = useState<Tip | null>(null)

  // "Today" is the most recent day carrying any reading. Before HAE's first
  // run of the morning that is yesterday, and labelling it honestly is better
  // than showing a page of dashes.
  const day = latestDayWith(data.days, d =>
    Object.values(d.metrics).some(v => v != null) || d.sleep != null || d.workouts.length > 0
  )
  const isToday = day?.date === data.end

  if (!day) {
    return (
      <div className="glass rounded-2xl px-5 py-8 text-center">
        <div className="text-body font-semibold text-on-surface">No readings in this range</div>
        <div className="text-caption text-on-surface-variant/55 mt-1.5">
          Widen the range, or check that the export automation ran.
        </div>
      </div>
    )
  }

  const recentScores = scoreSeries(data.days.slice(-14), 'recovery')

  return (
    <div className="space-y-5">
      {!isToday && (
        <div className="text-tiny text-amber-400/80 font-semibold">
          Showing {formatDay(day.date)} — no readings have arrived for today yet.
        </div>
      )}

      {/* Hero rings. Tapping one opens its detail tab — the same affordance
          Bevel uses, and it saves a trip back up to the sub-tab bar. */}
      <div className="glass rounded-2xl px-4 sm:px-6 py-6">
        <RingCluster
          items={[
            { metric: 'recovery', value: day.scores.recovery, label: 'Recovery', onClick: () => onOpen('recovery') },
            { metric: 'sleep', value: day.scores.sleep, label: 'Sleep', sub: formatMinutes(day.sleep?.asleepMin), onClick: () => onOpen('sleep') },
            { metric: 'strain', value: day.scores.strain, label: 'Strain', onClick: () => onOpen('strain') },
          ]}
        />
      </div>

      {/* Readings behind the rings */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {STAT_KEYS.map(key => {
          const def = METRIC_DEFS.find(d => d.key === key)!
          const value = day.metrics[key] ?? null
          const base = data.baselines[key]
          const d = deltaPct(value, base?.value)
          return (
            <StatCard
              key={key}
              label={def.label}
              value={value == null ? '—' : value.toFixed(def.decimals)}
              suffix={def.unit || undefined}
              sub={
                base?.calibrating
                  ? <CalibratingNote n={base.n} />
                  : d != null
                    ? `${d > 0 ? '+' : ''}${d}% vs baseline`
                    : 'no baseline yet'
              }
            />
          )
        })}
      </div>

      {/* Interpretation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <InsightCard icon="🛏" title="Last night" color={METRIC_COLORS.sleep.base}>
          {day.sleep?.asleepMin != null
            ? <>You slept {formatMinutes(day.sleep.asleepMin)}
                {day.sleep.deepMin != null && <> with {formatMinutes(day.sleep.deepMin)} of deep sleep</>}.
                {day.scores.sleep != null && <> That scores {Math.round(day.scores.sleep)}.</>}</>
            : <>No sleep recorded for this night.</>}
        </InsightCard>
        <InsightCard icon="⚡" title="Today's load" color={METRIC_COLORS.strain.base}>
          {day.workouts.length > 0
            ? <>{day.workouts.length} workout{day.workouts.length > 1 ? 's' : ''} · {' '}
                {formatMinutes(day.workouts.reduce((s, w) => s + (w.durationMin ?? 0), 0))} · {' '}
                {Math.round(day.workouts.reduce((s, w) => s + (w.activeKcal ?? 0), 0))} kcal</>
            : day.metrics.activeKcal != null
              ? <>No workouts logged. {Math.round(day.metrics.activeKcal)} kcal of active energy so far.</>
              : <>Nothing logged yet.</>}
        </InsightCard>
      </div>

      <Section label="Recovery · last 14 days" color={METRIC_COLORS.recovery.base} dotColor={METRIC_COLORS.recovery.base}>
        <Card padding={20}>
          {recentScores.length > 1
            ? <TrendChart
                data={recentScores}
                onHover={setTip}
                domain={[0, 100]}
                gridValues={[0, 25, 50, 75, 100]}
                movingAvgWindow={null}
                color={METRIC_COLORS.recovery.base}
                format={v => `${Math.round(v)}`}
              />
            : <div className="h-24 flex items-center justify-center text-tiny text-on-surface-variant/45">
                Two days of data are needed to draw a trend.
              </div>}
        </Card>
      </Section>

      <ChartTip tip={tip} />
    </div>
  )
}
