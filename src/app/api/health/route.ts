import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  HEALTH_CONSTANTS, METRIC_DEFS, defForMetric,
  baselineOf, sleepScore, recoveryScore, strainScore,
  type Baseline, type HealthDay, type HealthResponse, type MetricKey,
} from '@/lib/health'

// GET /api/health?start=YYYY-MM-DD&end=YYYY-MM-DD
//
// Returns one entry per day in [start, end] with metrics, sleep, workouts and
// the three scores. Reads BASELINE_DAYS beyond `start` so the first day in
// range is scored against a full trailing baseline rather than against
// nothing — without that lead-in, the left edge of every chart would show a
// day artificially "calibrating".
//
// Shape and error handling follow /api/scores: a failure returns an empty
// payload with a 500 rather than throwing into the client.

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const EMPTY = (start: string, end: string, lastImport: HealthResponse['lastImport'] = null): HealthResponse =>
  ({ start, end, days: [], baselines: {}, empty: true, lastImport })

async function latestImport(): Promise<HealthResponse['lastImport']> {
  try {
    const r = await prisma.healthImportLog.findFirst({ orderBy: { at: 'desc' } })
    if (!r) return null
    return {
      at: r.at.toISOString(), ok: r.ok, metrics: r.metrics, sleep: r.sleep,
      workouts: r.workouts, skipped: r.skipped, span: r.span, note: r.note,
    }
  } catch {
    // Never let the import log break the health read.
    return null
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const t = today()
  const end = searchParams.get('end') ?? t
  const start = searchParams.get('start') ?? addDays(end, -29)

  // Lead-in window: fetched for baselines, trimmed from the response.
  const fetchStart = addDays(start, -HEALTH_CONSTANTS.BASELINE_DAYS)

  try {
    const [metricRows, sleepRows, workoutRows, lastImport] = await Promise.all([
      prisma.healthMetricDaily.findMany({
        where: { date: { gte: fetchStart, lte: end } },
        orderBy: { date: 'asc' },
      }),
      prisma.sleepSession.findMany({
        where: { date: { gte: fetchStart, lte: end } },
        orderBy: { date: 'asc' },
      }),
      prisma.healthWorkout.findMany({
        where: { date: { gte: fetchStart, lte: end } },
        orderBy: { start: 'asc' },
      }),
      latestImport(),
    ])

    if (metricRows.length === 0 && sleepRows.length === 0 && workoutRows.length === 0) {
      return NextResponse.json(EMPTY(start, end, lastImport))
    }

    // ── index everything by day ──────────────────────────────────────────
    type DayBucket = {
      metrics: Partial<Record<MetricKey, number | null>>
      extra: Record<string, number | null>
    }
    const buckets = new Map<string, DayBucket>()
    const bucket = (d: string): DayBucket => {
      let b = buckets.get(d)
      if (!b) { b = { metrics: {}, extra: {} }; buckets.set(d, b) }
      return b
    }

    for (const r of metricRows) {
      const def = defForMetric(r.metric)
      const b = bucket(r.date)
      if (def) {
        // `field` picks the column that means something for this metric:
        // a total for steps/energy, an average for sampled vitals. The other
        // is a fallback so a metric delivered in the unexpected shape still
        // lands rather than reading as missing.
        const primary = def.field === 'qty' ? r.qty : r.avg
        b.metrics[def.key] = primary ?? (def.field === 'qty' ? r.avg : r.qty) ?? null
      } else {
        b.extra[r.metric] = r.qty ?? r.avg ?? null
      }
    }

    const sleepByDay = new Map(sleepRows.map(s => [s.date, s]))
    const workoutsByDay = new Map<string, typeof workoutRows>()
    for (const w of workoutRows) {
      const list = workoutsByDay.get(w.date) ?? []
      list.push(w)
      workoutsByDay.set(w.date, list)
    }

    // ── walk the calendar, carrying trailing histories ───────────────────
    // One pass, appending each day's reading to a per-metric history. The
    // baseline for a day is computed from the history *before* that day is
    // appended, which is what makes it trailing-and-exclusive.
    const history: Partial<Record<MetricKey, (number | null)[]>> = {}
    for (const def of METRIC_DEFS) history[def.key] = []

    const days: HealthDay[] = []
    let latestBaselines: Partial<Record<MetricKey, Baseline>> = {}

    for (let d = fetchStart; d <= end; d = addDays(d, 1)) {
      const b = buckets.get(d) ?? { metrics: {}, extra: {} }
      const sleep = sleepByDay.get(d) ?? null
      const workouts = workoutsByDay.get(d) ?? []

      const dayBaselines: Partial<Record<MetricKey, Baseline>> = {}
      for (const def of METRIC_DEFS) {
        dayBaselines[def.key] = baselineOf(history[def.key] ?? [])
      }

      const sScore = sleepScore(sleep)
      const rScore = recoveryScore({
        hrv: b.metrics.hrv ?? null,
        hrvBaseline: dayBaselines.hrv?.value ?? null,
        restingHr: b.metrics.restingHr ?? null,
        rhrBaseline: dayBaselines.restingHr?.value ?? null,
        sleepScore: sScore,
      })
      const xScore = strainScore({
        activeKcal: b.metrics.activeKcal ?? null,
        kcalBaseline: dayBaselines.activeKcal?.value ?? null,
        exerciseMin: b.metrics.exerciseMin ?? null,
        exerciseBaseline: dayBaselines.exerciseMin?.value ?? null,
      })

      if (d >= start) {
        days.push({
          date: d,
          metrics: b.metrics,
          extra: b.extra,
          sleep: sleep && {
            date: sleep.date, start: sleep.start, end: sleep.end,
            inBedMin: sleep.inBedMin, asleepMin: sleep.asleepMin,
            coreMin: sleep.coreMin, deepMin: sleep.deepMin,
            remMin: sleep.remMin, awakeMin: sleep.awakeMin,
          },
          workouts: workouts.map(w => ({
            id: w.id, date: w.date, type: w.type, start: w.start, end: w.end,
            durationMin: w.durationMin, activeKcal: w.activeKcal,
            avgHr: w.avgHr, maxHr: w.maxHr, distanceKm: w.distanceKm,
          })),
          scores: { sleep: sScore, recovery: rScore, strain: xScore },
          baselines: Object.fromEntries(
            METRIC_DEFS.map(def => [def.key, dayBaselines[def.key]?.value ?? null])
          ) as Partial<Record<MetricKey, number | null>>,
        })
        latestBaselines = dayBaselines
      }

      // Append after scoring — a day never contributes to its own baseline.
      for (const def of METRIC_DEFS) {
        history[def.key]!.push(b.metrics[def.key] ?? null)
      }
    }

    const res: HealthResponse = {
      start, end, days,
      baselines: latestBaselines,
      empty: false,
      lastImport,
    }
    return NextResponse.json(res)
  } catch (e) {
    console.error('[/api/health]', e)
    return NextResponse.json(EMPTY(start, end), { status: 500 })
  }
}
