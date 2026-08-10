// Pure parser for Health Auto Export (HAE) payloads. No Prisma, no Next —
// everything here is a pure function so the shapes can be exercised from a
// script without a server or a database.
//
// HAE's JSON has drifted across versions (qty vs Min/Avg/Max, sleep field
// names, workout duration units), and Connor's exports will span whatever
// version his phone is on. The rule throughout: normalise what we recognise,
// keep everything else verbatim, and never throw on a single bad point — a
// batch of 30 days must not be lost because one row is malformed.

import { defForMetric } from './health'

export type MetricRow = {
  date: string
  metric: string
  qty: number | null
  min: number | null
  avg: number | null
  max: number | null
  units: string | null
}

/** One raw reading, as delivered with HAE's "Aggregate Data" switched off. */
export type SampleRow = {
  date: string
  metric: string
  start: string
  source: string
  qty: number | null
  min: number | null
  avg: number | null
  max: number | null
  units: string | null
}

export type SleepRow = {
  date: string
  start: string | null
  end: string | null
  inBedMin: number | null
  asleepMin: number | null
  coreMin: number | null
  deepMin: number | null
  remMin: number | null
  awakeMin: number | null
  raw: string
}

export type WorkoutRow = {
  externalId: string
  date: string
  type: string
  start: string | null
  end: string | null
  durationMin: number | null
  activeKcal: number | null
  avgHr: number | null
  maxHr: number | null
  distanceKm: number | null
  raw: string
}

export type ParseResult = {
  metrics: MetricRow[]
  /** Sub-daily readings, for the metrics we keep sample history on. */
  samples: SampleRow[]
  sleep: SleepRow[]
  workouts: WorkoutRow[]
  /** Points we could not read. Reported in the response so a silent parser
   *  regression shows up as a number instead of as missing history. */
  skipped: number
  /** Human-readable reasons, capped so a pathological payload can't produce
   *  a megabyte of response body. */
  warnings: string[]
}

const MAX_WARNINGS = 20

// ── primitives ────────────────────────────────────────────────────────────

/** HAE timestamps look like "2026-01-21 06:00:00 +0000" or ISO-8601.
 *  The first 10 chars are already the calendar day *in the offset HAE sent*,
 *  which with "Aggregate: Days" is the phone's local day — exactly the day we
 *  want to key on. Parsing to a Date and reading UTC fields would be wrong:
 *  it would push evening entries onto the next day.
 *
 *  This is the single highest-risk assumption in the import path (plan.md
 *  "Key risks"). Every raw timestamp is stored alongside, so if the first live
 *  payload disagrees, history can be reprocessed rather than re-exported. */
export function toLocalDay(ts: unknown): string | null {
  if (typeof ts !== 'string') return null
  const day = ts.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null
}

/** True when a timestamp sits exactly on local midnight. */
function isMidnight(ts: string): boolean {
  return /^\d{4}-\d{2}-\d{2}[ T]00:00:00/.test(ts)
}

/** Whether a point is a whole-day total rather than a reading taken at an
 *  instant. That distinction is the difference between a correct day and a
 *  destroyed one — a one-hour delta labelled with a day looks exactly like
 *  that day's total unless something else separates them.
 *
 *  Midnight alone is NOT enough to decide it. HAE's "time grouping" can bucket
 *  readings by hour, and the 00:00–01:00 bucket carries the identical
 *  `00:00:00` stamp a daily aggregate does — so a midnight-only test reads
 *  that hour as the whole day and loses it from the roll-up, every day,
 *  silently.
 *
 *  So require BOTH: stamped at midnight, and the only point this metric has
 *  for this day. One point at midnight is an aggregate; one of twenty-four is
 *  an hour. A day whose only readings happen to fall in the midnight hour is
 *  still classified as an aggregate, but its value is then the same either
 *  way, and the next export — which carries the rest of the day — reclassifies
 *  it. */
function isDayTotal(ts: string, pointsThatDay: number): boolean {
  return pointsThatDay === 1 && isMidnight(ts)
}

/** Metrics we keep per-reading history for.
 *
 *  Deliberately just these two. They are Watch-only, so raw readings can be
 *  aggregated without worrying about the iPhone recording the same event —
 *  and they are the two recovery is scored on. Steps and active energy are
 *  recorded by BOTH devices, Apple de-duplicates them when it reports a daily
 *  total, and summing raw per-source readings would overshoot. Those stay in
 *  the aggregate lane where Apple has already done that work. */
const SAMPLE_METRICS = new Set(['heart_rate', 'heart_rate_variability', 'respiratory_rate'])

/** Units whose readings ADD UP over a day. Everything else is a rate, a level
 *  or a percentage, and averages instead.
 *
 *  Consulted only for metrics with no MetricDef — the known ones carry the
 *  answer already in `field` ('qty' totals, 'avg' samples). Defaulting the
 *  unknown ones to averaging is the safe direction: averaging a total
 *  understates a number that is still recognisably itself, while summing a
 *  percentage or a temperature produces a value with no meaning at all. */
const CUMULATIVE_UNITS = new Set([
  'count', 'kcal', 'kj', 'min', 'mi', 'km', 'ft', 'l', 'ml', 'g', 'mg', 'mcg', 'iu',
])

type Bucket = {
  units: string | null
  cumulative: boolean
  sum: number
  nSum: number
  min: number | null
  max: number | null
  sumAvg: number
  nAvg: number
}

/** Accumulate one sub-daily reading into its day. */
function rollUp(
  buckets: Map<string, Bucket>,
  date: string,
  metric: string,
  units: string | null,
  p: { qty: number | null; min: number | null; avg: number | null; max: number | null },
) {
  const def = defForMetric(metric)
  const cumulative = def ? def.field === 'qty' : CUMULATIVE_UNITS.has((units ?? '').toLowerCase())
  const k = `${date}|${metric}`
  let b = buckets.get(k)
  if (!b) {
    b = { units, cumulative, sum: 0, nSum: 0, min: null, max: null, sumAvg: 0, nAvg: 0 }
    buckets.set(k, b)
  }
  if (p.qty != null) { b.sum += p.qty; b.nSum++ }
  // A heart-rate reading carries Min/Avg/Max of its own bucket; a plain
  // reading carries only qty. Fall back so both shapes land in one place.
  const lo = p.min ?? p.qty, hi = p.max ?? p.qty, mid = p.avg ?? p.qty
  if (lo != null) b.min = b.min == null ? lo : Math.min(b.min, lo)
  if (hi != null) b.max = b.max == null ? hi : Math.max(b.max, hi)
  if (mid != null) { b.sumAvg += mid; b.nAvg++ }
}

/** Turn the accumulated buckets into one daily row each. */
function flushBuckets(buckets: Map<string, Bucket>): MetricRow[] {
  const rows: MetricRow[] = []
  for (const [k, b] of buckets) {
    const i = k.indexOf('|')
    const date = k.slice(0, i), metric = k.slice(i + 1)
    rows.push(b.cumulative
      ? { date, metric, qty: b.nSum > 0 ? b.sum : null, min: null, avg: null, max: null, units: b.units }
      : {
          date, metric,
          qty: null,
          min: b.min,
          avg: b.nAvg > 0 ? b.sumAvg / b.nAvg : null,
          max: b.max,
          units: b.units,
        })
  }
  return rows
}

/** Unwrap HAE's two number shapes: a bare number, or `{qty, units}`. */
function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  if (v && typeof v === 'object') {
    const q = (v as Record<string, unknown>).qty
    if (q !== undefined) return num(q)
  }
  return null
}

/** First present key wins. HAE renames fields between versions, so every
 *  read goes through this rather than a single hard-coded key. */
function pick(o: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (o[k] !== undefined && o[k] !== null) return o[k]
    // case-insensitive fallback — "Avg" vs "avg" differs by HAE version
    const hit = Object.keys(o).find(x => x.toLowerCase() === k.toLowerCase())
    if (hit && o[hit] !== undefined && o[hit] !== null) return o[hit]
  }
  return undefined
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null
}

/** First candidate that is a real, positive number.
 *
 *  Needed because HAE emits `"asleep": 0` alongside a populated `totalSleep`
 *  on most nights — 58 of 62 in the first real 90-day export. A plain
 *  first-non-null pick returns that 0, which is indistinguishable from "slept
 *  zero hours" and silently destroys the night. Zero is not a measurement
 *  here; it is HAE's way of saying "this field is not the one carrying the
 *  value". */
function firstPositive(...vals: (number | null | undefined)[]): number | null {
  for (const v of vals) if (v != null && Number.isFinite(v) && v > 0) return v
  return null
}

/** Canonical snake_case metric key. Unknown metrics keep their normalised
 *  name and are still stored — nothing is dropped for being unrecognised. */
export function normaliseMetricName(name: string): string {
  return name.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

/** HAE sleep values arrive in hours ("hr") on most versions and minutes on
 *  some. Convert to minutes using the declared units, falling back to hours
 *  because that is the documented default. */
function sleepToMinutes(v: unknown, units: string | null): number | null {
  const n = num(v)
  if (n == null) return null
  const u = (units ?? 'hr').toLowerCase()
  if (u.startsWith('min')) return n
  if (u.startsWith('s')) return n / 60
  return n * 60
}

function kmFrom(v: unknown, units: string | null): number | null {
  const n = num(v)
  if (n == null) return null
  const u = (units ?? '').toLowerCase()
  if (u.startsWith('mi')) return n * 1.609344
  if (u === 'm') return n / 1000
  return n
}

// ── the parser ────────────────────────────────────────────────────────────

export function parseHealthPayload(body: unknown): ParseResult {
  const out: ParseResult = { metrics: [], samples: [], sleep: [], workouts: [], skipped: 0, warnings: [] }
  const warn = (m: string) => { if (out.warnings.length < MAX_WARNINGS) out.warnings.push(m) }

  if (!body || typeof body !== 'object') {
    warn('payload is not an object')
    return out
  }
  // HAE nests under `data`; a hand-rolled backfill chunk may not.
  const root = (body as Record<string, unknown>).data ?? body
  if (!root || typeof root !== 'object') {
    warn('payload has no `data` object')
    return out
  }
  const r = root as Record<string, unknown>

  const metrics = Array.isArray(r.metrics) ? r.metrics : []
  const workouts = Array.isArray(r.workouts) ? r.workouts : []
  // Sub-daily readings, accumulated per (day, metric) and flushed to daily
  // rows once every point has been seen.
  const buckets = new Map<string, Bucket>()

  for (const raw of metrics) {
    if (!raw || typeof raw !== 'object') { out.skipped++; continue }
    const m = raw as Record<string, unknown>
    const name = str(pick(m, 'name', 'metric'))
    if (!name) { out.skipped++; warn('metric with no name'); continue }
    const key = normaliseMetricName(name)
    const units = str(pick(m, 'units', 'unit'))
    const points = Array.isArray(m.data) ? m.data : []

    // How many points this metric carries for each day, counted before any of
    // them are classified — a point cannot be told apart from a whole-day
    // total without knowing whether it has siblings.
    const perDay = new Map<string, number>()
    for (const p of points) {
      if (!p || typeof p !== 'object') continue
      const d = toLocalDay(pick(p as Record<string, unknown>, 'date', 'startDate', 'start'))
      if (d) perDay.set(d, (perDay.get(d) ?? 0) + 1)
    }

    for (const p of points) {
      if (!p || typeof p !== 'object') { out.skipped++; continue }
      const pt = p as Record<string, unknown>

      if (key === 'sleep_analysis') {
        const row = parseSleepPoint(pt, units)
        if (row) out.sleep.push(row)
        else { out.skipped++; warn('unparseable sleep point') }
        continue
      }

      const stamp = str(pick(pt, 'date', 'startDate', 'start'))
      const date = toLocalDay(stamp)
      if (!date || !stamp) { out.skipped++; warn(`${key}: point with no readable date`); continue }
      const qty = num(pick(pt, 'qty', 'value', 'quantity'))
      const min = num(pick(pt, 'Min', 'min'))
      const avg = num(pick(pt, 'Avg', 'avg', 'average'))
      const max = num(pick(pt, 'Max', 'max'))
      if (qty == null && min == null && avg == null && max == null) {
        out.skipped++; warn(`${key}: point with no numeric value`); continue
      }

      if (isDayTotal(stamp, perDay.get(date) ?? 1)) {
        // Whole-day total, straight into the aggregate lane.
        out.metrics.push({ date, metric: key, qty, min, avg, max, units })
        continue
      }

      // Sub-daily reading. Rolled up into the day below, and additionally kept
      // verbatim when it is one of the metrics recovery needs a sleep window
      // of. Summing is safe here: Health Auto Export merges the iPhone and the
      // Watch before exporting — every step reading arrives under the single
      // source "Connor's Apple Watch|iPhone" with no duplicate timestamps, and
      // summing 2026-08-10 reproduces Apple's own 4,391 to within 0.3%.
      if (SAMPLE_METRICS.has(key)) {
        out.samples.push({
          date, metric: key, start: stamp,
          source: str(pick(pt, 'source')) ?? '',
          qty, min, avg, max, units,
        })
      }
      rollUp(buckets, date, key, units, { qty, min, avg, max })
    }
  }

  for (const w of workouts) {
    if (!w || typeof w !== 'object') { out.skipped++; continue }
    const row = parseWorkout(w as Record<string, unknown>)
    if (row) out.workouts.push(row)
    else { out.skipped++; warn('unparseable workout') }
  }

  // Rolled-up days go in AFTER the whole-day rows, so that if a payload
  // somehow carries both shapes for one (day, metric), the roll-up — built
  // from every reading rather than one pre-aggregated number — is the one the
  // caller's de-dupe keeps.
  out.metrics.push(...flushBuckets(buckets))

  return out
}

function parseSleepPoint(pt: Record<string, unknown>, units: string | null): SleepRow | null {
  const start = str(pick(pt, 'sleepStart', 'startDate', 'start', 'inBedStart'))
  const end = str(pick(pt, 'sleepEnd', 'endDate', 'end', 'inBedEnd'))
  // The night is filed under the WAKE day — the day Connor experiences it as.
  // Falls back to the point's own date when HAE omits an end timestamp.
  const date = toLocalDay(end) ?? toLocalDay(pick(pt, 'date')) ?? toLocalDay(start)
  if (!date) return null

  const core = sleepToMinutes(pick(pt, 'core', 'light'), units)
  const deep = sleepToMinutes(pick(pt, 'deep'), units)
  const rem = sleepToMinutes(pick(pt, 'rem'), units)
  const awake = sleepToMinutes(pick(pt, 'awake'), units)
  const inBed = firstPositive(sleepToMinutes(pick(pt, 'inBed', 'in_bed'), units))

  // In the real export, `asleep` is not the total — it is the *unspecified
  // stage* component, and totalSleep = core + deep + rem + asleep. So
  // totalSleep is preferred, and the fallback sums all four rather than only
  // the three named stages. Older HAE builds that emit no total at all still
  // work via that sum.
  const unspecified = sleepToMinutes(pick(pt, 'asleep', 'asleepUnspecified'), units)
  const total = sleepToMinutes(pick(pt, 'totalSleep'), units)
  const stageSum = [core, deep, rem, unspecified]
    .filter((x): x is number => x != null && Number.isFinite(x))
    .reduce((s, x) => s + x, 0)
  const asleepFinal = firstPositive(total, stageSum, unspecified)

  if (asleepFinal == null && inBed == null) return null
  return {
    date, start, end,
    inBedMin: inBed, asleepMin: asleepFinal,
    coreMin: core, deepMin: deep, remMin: rem, awakeMin: awake,
    raw: JSON.stringify(pt),
  }
}

function parseWorkout(w: Record<string, unknown>): WorkoutRow | null {
  const start = str(pick(w, 'start', 'startDate'))
  const end = str(pick(w, 'end', 'endDate'))
  const date = toLocalDay(start) ?? toLocalDay(pick(w, 'date')) ?? toLocalDay(end)
  if (!date) return null

  const type = str(pick(w, 'name', 'workoutActivityType', 'type')) ?? 'Workout'
  // Prefer a duration measured from the timestamps: it needs no unit guess.
  // HAE's own `duration` is documented in seconds, but has shipped in minutes
  // on some builds — the >600 test disambiguates (a 600-minute workout is not
  // a thing; a 600-second one is a normal 10 minutes).
  let durationMin: number | null = null
  const ts = spanMinutes(start, end)
  if (ts != null) durationMin = ts
  else {
    const d = num(pick(w, 'duration'))
    if (d != null) durationMin = d > 600 ? d / 60 : d
  }

  // Identity: HAE's own id when present. Without one, a stable synthetic key
  // from the natural identifiers — re-importing the same export must update in
  // place, not duplicate, and HAE re-sends overlapping windows by design.
  const externalId = str(pick(w, 'id', 'uuid', 'workoutID'))
    ?? `${date}|${type}|${start ?? ''}|${Math.round(durationMin ?? 0)}`

  const energyUnits = str((pick(w, 'activeEnergyBurned', 'activeEnergy') as Record<string, unknown> | undefined)?.units)
  const kcal = num(pick(w, 'activeEnergyBurned', 'activeEnergy', 'totalEnergyBurned'))

  const distRaw = pick(w, 'distance', 'totalDistance')
  const distUnits = str((distRaw as Record<string, unknown> | undefined)?.units)

  return {
    externalId,
    date,
    type,
    start,
    end,
    durationMin,
    activeKcal: energyUnits?.toLowerCase().startsWith('kj') && kcal != null ? kcal / 4.184 : kcal,
    avgHr: num(pick(w, 'avgHeartRate', 'heartRateAvg', 'averageHeartRate')),
    maxHr: num(pick(w, 'maxHeartRate', 'heartRateMax')),
    distanceKm: kmFrom(distRaw, distUnits),
    raw: JSON.stringify(scalarsOnly(w)),
  }
}

/** Workout minus its per-minute sample arrays.
 *
 *  A real workout carries heartRateData / activeEnergy / basalEnergy /
 *  stepCount arrays and weighs 8–25KB; the scalars we might ever want to
 *  reprocess are a few hundred bytes. `raw` exists so a parser fix can
 *  reprocess history without a re-export — it is not a sample archive, and
 *  storing one in a row we read on every page load is pure cost. */
function scalarsOnly(w: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(w)) if (!Array.isArray(v)) out[k] = v
  return out
}

function spanMinutes(start: string | null, end: string | null): number | null {
  if (!start || !end) return null
  const a = Date.parse(start.replace(' ', 'T').replace(/ ([+-]\d{4})$/, '$1'))
  const b = Date.parse(end.replace(' ', 'T').replace(/ ([+-]\d{4})$/, '$1'))
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null
  return (b - a) / 60000
}
