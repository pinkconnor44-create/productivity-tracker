'use client'
import { useMemo, useState } from 'react'
import { Card, Section, StatCard, SegmentedControl, TrendChart, METRIC_COLORS } from '@/components/ui'
import { METRIC_DEFS, type HealthResponse, type MetricKey } from '@/lib/health'
import { ChartTip, LoadingBlock, formatDay, seriesOf, scoreSeries, type Tip } from './shared'
import { DayTimeline } from './DayTimeline'

// Trends — pick any metric (or score) and see it over the range, with a
// week-over-week comparison and a per-day timeline underneath.
//
// The picker is built from METRIC_DEFS plus whatever unrecognised metrics HAE
// actually delivered, so a new Apple metric appears here without a code change
// rather than being invisible until someone notices.

type Selection = { key: string; label: string; unit: string; decimals: number; color: string; kind: 'metric' | 'score' | 'extra' }

const SCORE_OPTIONS: Selection[] = [
  { key: 'score:recovery', label: 'Recovery', unit: '', decimals: 0, color: METRIC_COLORS.recovery.base, kind: 'score' },
  { key: 'score:sleep', label: 'Sleep score', unit: '', decimals: 0, color: METRIC_COLORS.sleep.base, kind: 'score' },
  { key: 'score:strain', label: 'Strain', unit: '', decimals: 0, color: METRIC_COLORS.strain.base, kind: 'score' },
]

export function BevelTrends({ data }: { data: HealthResponse }) {
  const [tip, setTip] = useState<Tip | null>(null)
  const [sel, setSel] = useState<string>('score:recovery')
  const [pickedDay, setPickedDay] = useState<string | null>(null)

  const options = useMemo<Selection[]>(() => {
    const present = new Set<MetricKey>()
    const extras = new Set<string>()
    for (const d of data.days) {
      for (const def of METRIC_DEFS) if (d.metrics[def.key] != null) present.add(def.key)
      for (const k of Object.keys(d.extra)) extras.add(k)
    }
    return [
      ...SCORE_OPTIONS,
      ...METRIC_DEFS.filter(d => present.has(d.key)).map<Selection>(d => ({
        key: `metric:${d.key}`, label: d.label, unit: d.unit, decimals: d.decimals,
        color: 'var(--c-p-hex)', kind: 'metric',
      })),
      ...[...extras].map<Selection>(k => ({
        // HAE's own snake_case name, humanised for display only.
        key: `extra:${k}`, label: k.replace(/_/g, ' '), unit: '', decimals: 1,
        color: 'var(--c-p-hex)', kind: 'extra',
      })),
    ]
  }, [data.days])

  const current = options.find(o => o.key === sel) ?? options[0]

  const series = useMemo(() => {
    if (!current) return []
    if (current.kind === 'score') {
      return scoreSeries(data.days, current.key.slice(6) as 'sleep' | 'recovery' | 'strain')
    }
    if (current.kind === 'metric') {
      return seriesOf(data.days, current.key.slice(7) as MetricKey)
    }
    const name = current.key.slice(6)
    return data.days
      .filter(d => d.extra[name] != null)
      .map(d => ({ date: d.date, value: d.extra[name] as number }))
  }, [current, data.days])

  // Week-over-week. Averages, not sums, so a partially-recorded week is not
  // reported as a collapse in the metric.
  const last7 = series.slice(-7)
  const prev7 = series.slice(-14, -7)
  const mean = (xs: { value: number }[]) => xs.length ? xs.reduce((s, x) => s + x.value, 0) / xs.length : null
  const avgNow = mean(last7)
  const avgPrev = mean(prev7)
  const delta = avgNow != null && avgPrev != null && avgPrev !== 0
    ? Math.round(((avgNow - avgPrev) / avgPrev) * 100)
    : null

  const allValues = series.map(s => s.value)
  const hi = allValues.length ? Math.max(...allValues) : null
  const lo = allValues.length ? Math.min(...allValues) : null

  const daysWithAnything = data.days.filter(d => d.sleep != null || d.workouts.length > 0)
  const timelineDay = data.days.find(d => d.date === pickedDay)
    ?? daysWithAnything[daysWithAnything.length - 1]
    ?? null

  const fmt = (v: number) => `${v.toFixed(current?.decimals ?? 0)}${current?.unit ? ` ${current.unit}` : ''}`

  return (
    <div className="space-y-5">
      <SegmentedControl
        ariaLabel="Metric"
        scrollable
        options={options.map(o => ({ value: o.key, label: o.label }))}
        value={current?.key ?? ''}
        onChange={setSel}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <StatCard label="7-day avg" value={avgNow != null ? avgNow.toFixed(current?.decimals ?? 0) : '—'} suffix={current?.unit || undefined} sub="mean of readings" color={current?.color} />
        <StatCard
          label="vs prior week"
          value={delta != null ? `${delta > 0 ? '+' : ''}${delta}` : '—'}
          suffix={delta != null ? '%' : undefined}
          sub={avgPrev != null ? `prior ${avgPrev.toFixed(current?.decimals ?? 0)}` : 'no prior week'}
        />
        <StatCard label="Range high" value={hi != null ? hi.toFixed(current?.decimals ?? 0) : '—'} suffix={current?.unit || undefined} sub={`${series.length} readings`} />
        <StatCard label="Range low" value={lo != null ? lo.toFixed(current?.decimals ?? 0) : '—'} suffix={current?.unit || undefined} sub={`${data.days.length}-day window`} />
      </div>

      <Section label={current?.label ?? 'Trend'} color={current?.color} dotColor={current?.color}>
        <Card padding={20}>
          {series.length > 1
            ? <TrendChart
                data={series}
                onHover={setTip}
                color={current?.color}
                format={fmt}
                domain={current?.kind === 'score' ? [0, 100] : undefined}
                gridValues={current?.kind === 'score' ? [0, 25, 50, 75, 100] : undefined}
              />
            : <LoadingBlock height="h-32" label="Not enough readings for this metric yet." />}
        </Card>
      </Section>

      <Section label="Day timeline" color="var(--c-p-hex)">
        <Card padding={20}>
          {/* Day picker. Horizontally scrollable rather than wrapped — a
              365-day range would otherwise build a wall of chips. */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-3 -mx-1 px-1">
            {[...daysWithAnything].reverse().slice(0, 60).map(d => {
              const active = timelineDay?.date === d.date
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => setPickedDay(d.date)}
                  className={`shrink-0 px-2.5 py-1.5 rounded-lg text-micro font-semibold transition-colors ${
                    active
                      ? 'bg-primary-500/16 text-primary-300 border border-primary-400/30'
                      : 'border border-outline-variant/40 text-on-surface-variant/60 md:hover:text-on-surface'
                  }`}
                >
                  {formatDay(d.date).replace(/^\w+, /, '')}
                </button>
              )
            })}
          </div>
          {timelineDay
            ? <DayTimeline day={timelineDay} />
            : <div className="text-caption text-on-surface-variant/45 py-3">No days with sleep or workouts in range.</div>}
        </Card>
      </Section>

      <ChartTip tip={tip} />
    </div>
  )
}
