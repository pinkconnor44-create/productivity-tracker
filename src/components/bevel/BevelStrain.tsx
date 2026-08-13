'use client'
import { useState } from 'react'
import { Card, Section, Ring, MetricRow, TrendChart, METRIC_COLORS } from '@/components/ui'
import { deltaPct, formatMinutes, type HealthResponse, type HealthWorkoutLite } from '@/lib/health'
import { ChartTip, LoadingBlock, CalibratingNote, NoDayData, clockTime, dayOf, formatDay, seriesOf, type Tip } from './shared'

// Strain detail: the ring, today's workouts, and the active-energy history
// that the score is measured against.
//
// A low strain score is a rest day, not a failure — nothing on this tab uses
// scoreColor's traffic light, and the copy never calls a light day "bad".

export function BevelStrain({ data, selected }: { data: HealthResponse; selected: string }) {
  const [tip, setTip] = useState<Tip | null>(null)

  const day = dayOf(data.days, selected)
  const kcalSeries = seriesOf(data.days, 'activeKcal')

  if (!day || (day.scores.strain == null && day.workouts.length === 0)) {
    return <NoDayData date={selected} what="activity recorded" />
  }

  const kcalBase = data.baselines.activeKcal
  const exBase = data.baselines.exerciseMin
  const kcal = day.metrics.activeKcal ?? null
  const exMin = day.metrics.exerciseMin ?? null

  const maxKcal = Math.max(1, ...kcalSeries.map(p => p.value))
  // Newest first, and capped: the bar history is a glance, not the archive.
  // Anchored to the SELECTED day, not today — with a past day selected, a
  // strip running to today read eight days into the future relative to the
  // header beside it (item 09).
  const recent = data.days.filter(d => d.date <= selected).reverse().slice(0, 21)

  return (
    <div className="space-y-5">
      <div className="glass rounded-2xl px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center gap-6">
        <Ring
          pct={day.scores.strain}
          size={132}
          color={METRIC_COLORS.strain.base}
          colorTo={METRIC_COLORS.strain.from}
          label="Strain"
        />
        <div className="min-w-0 flex-1 w-full space-y-3">
          <div>
            <div className="text-micro font-bold uppercase tracking-[0.16em] text-on-surface-variant/55">
              {formatDay(day.date)}
            </div>
            {(kcalBase?.calibrating || exBase?.calibrating) && (
              <div className="mt-1.5"><CalibratingNote n={Math.max(kcalBase?.n ?? 0, exBase?.n ?? 0)} /></div>
            )}
          </div>
          <MetricRow
            label="Active energy"
            value={kcal}
            unit="kcal"
            delta={deltaPct(kcal, kcalBase?.value)}
            sub={kcalBase?.value ? `baseline ${Math.round(kcalBase.value)} kcal` : 'no baseline yet'}
          />
          <MetricRow
            label="Exercise minutes"
            value={exMin}
            unit="min"
            delta={deltaPct(exMin, exBase?.value)}
            sub={exBase?.value ? `baseline ${Math.round(exBase.value)} min` : 'no baseline yet'}
          />
        </div>
      </div>

      <Section
        label={`Workouts · ${formatDay(day.date)}`}
        color={METRIC_COLORS.strain.base}
        dotColor={METRIC_COLORS.strain.base}
      >
        <Card padding={20}>
          {day.workouts.length === 0
            ? <div className="text-caption text-on-surface-variant/45 py-2">
                No workouts on this day. Active energy still counts toward strain.
              </div>
            : <div className="space-y-2.5">
                {day.workouts.map(w => <WorkoutRow key={w.id} w={w} />)}
              </div>}
        </Card>
      </Section>

      <Section label="Active energy trend" color={METRIC_COLORS.strain.base} dotColor={METRIC_COLORS.strain.base}>
        <Card padding={20}>
          {kcalSeries.length > 1
            ? <TrendChart
                data={kcalSeries}
                onHover={setTip}
                color={METRIC_COLORS.strain.base}
                format={v => `${Math.round(v)} kcal`}
                refLine={kcalBase?.value != null ? { value: kcalBase.value, label: 'baseline' } : null}
              />
            : <LoadingBlock height="h-24" label="Not enough days of activity yet." />}
        </Card>
      </Section>

      <Section label="Daily load · last 21 days" color={METRIC_COLORS.strain.base} dotColor={METRIC_COLORS.strain.base}>
        <Card padding={20}>
          {/* Oldest-left reading order, from a newest-first slice. */}
          <div className="flex items-end gap-1 h-[110px]">
            {[...recent].reverse().map(d => {
              const v = d.metrics.activeKcal ?? 0
              return (
                <div
                  key={d.date}
                  className="flex-1 min-w-0 rounded-t-sm transition-[height] duration-500"
                  style={{
                    height: `${Math.max(2, (v / maxKcal) * 100)}%`,
                    background: METRIC_COLORS.strain.base,
                    opacity: v > 0 ? 0.85 : 0.18,
                  }}
                  title={`${formatDay(d.date)} · ${Math.round(v)} kcal`}
                />
              )
            })}
          </div>
          <div className="flex justify-between mt-2 text-micro text-on-surface-variant/40">
            <span>{recent.length ? formatDay(recent[recent.length - 1].date) : ''}</span>
            <span>{recent.length ? formatDay(recent[0].date) : ''}</span>
          </div>
        </Card>
      </Section>

      <ChartTip tip={tip} />
    </div>
  )
}

function WorkoutRow({ w }: { w: HealthWorkoutLite }) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-white/[0.03] border border-outline-variant/30">
      <span
        className="w-8 h-8 rounded-lg shrink-0 inline-flex items-center justify-center"
        style={{ background: METRIC_COLORS.strain.tint, color: METRIC_COLORS.strain.base }}
        aria-hidden
      >
        ⚡
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-caption font-semibold text-on-surface truncate">{w.type}</div>
        <div className="text-micro text-on-surface-variant/45 mt-0.5">
          {clockTime(w.start)} · {formatMinutes(w.durationMin)}
          {w.distanceKm != null && <> · {w.distanceKm.toFixed(2)} km</>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-display text-body font-semibold tabular-nums leading-none" style={{ color: METRIC_COLORS.strain.base }}>
          {w.activeKcal != null ? Math.round(w.activeKcal) : '—'}
          <span className="text-micro text-on-surface-variant/50 ml-1">kcal</span>
        </div>
        {w.avgHr != null && (
          <div className="text-micro text-on-surface-variant/45 tabular-nums mt-1">
            avg {Math.round(w.avgHr)} bpm{w.maxHr != null && ` · max ${Math.round(w.maxHr)}`}
          </div>
        )}
      </div>
    </div>
  )
}
