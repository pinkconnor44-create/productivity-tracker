// Pure parser for Health Auto Export (HAE) payloads. No Prisma, no Next —
// everything here is a pure function so the shapes can be exercised from a
// script without a server or a database.
//
// HAE's JSON has drifted across versions (qty vs Min/Avg/Max, sleep field
// names, workout duration units), and Connor's exports will span whatever
// version his phone is on. The rule throughout: normalise what we recognise,
// keep everything else verbatim, and never throw on a single bad point — a
// batch of 30 days must not be lost because one row is malformed.

export type MetricRow = {
  date: string
  metric: string
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
  const out: ParseResult = { metrics: [], sleep: [], workouts: [], skipped: 0, warnings: [] }
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

  for (const raw of metrics) {
    if (!raw || typeof raw !== 'object') { out.skipped++; continue }
    const m = raw as Record<string, unknown>
    const name = str(pick(m, 'name', 'metric'))
    if (!name) { out.skipped++; warn('metric with no name'); continue }
    const key = normaliseMetricName(name)
    const units = str(pick(m, 'units', 'unit'))
    const points = Array.isArray(m.data) ? m.data : []

    for (const p of points) {
      if (!p || typeof p !== 'object') { out.skipped++; continue }
      const pt = p as Record<string, unknown>

      if (key === 'sleep_analysis') {
        const row = parseSleepPoint(pt, units)
        if (row) out.sleep.push(row)
        else { out.skipped++; warn('unparseable sleep point') }
        continue
      }

      const date = toLocalDay(pick(pt, 'date', 'startDate', 'start'))
      if (!date) { out.skipped++; warn(`${key}: point with no readable date`); continue }
      const qty = num(pick(pt, 'qty', 'value', 'quantity'))
      const min = num(pick(pt, 'Min', 'min'))
      const avg = num(pick(pt, 'Avg', 'avg', 'average'))
      const max = num(pick(pt, 'Max', 'max'))
      if (qty == null && min == null && avg == null && max == null) {
        out.skipped++; warn(`${key}: point with no numeric value`); continue
      }
      out.metrics.push({ date, metric: key, qty, min, avg, max, units })
    }
  }

  for (const w of workouts) {
    if (!w || typeof w !== 'object') { out.skipped++; continue }
    const row = parseWorkout(w as Record<string, unknown>)
    if (row) out.workouts.push(row)
    else { out.skipped++; warn('unparseable workout') }
  }

  return out
}

function parseSleepPoint(pt: Record<string, unknown>, units: string | null): SleepRow | null {
  const start = str(pick(pt, 'sleepStart', 'startDate', 'start', 'inBedStart'))
  const end = str(pick(pt, 'sleepEnd', 'endDate', 'end', 'inBedEnd'))
  // The night is filed under the WAKE day — the day Connor experiences it as.
  // Falls back to the point's own date when HAE omits an end timestamp.
  const date = toLocalDay(end) ?? toLocalDay(pick(pt, 'date')) ?? toLocalDay(start)
  if (!date) return null

  const asleep = sleepToMinutes(pick(pt, 'asleep', 'totalSleep', 'asleepUnspecified'), units)
  const core = sleepToMinutes(pick(pt, 'core', 'light'), units)
  const deep = sleepToMinutes(pick(pt, 'deep'), units)
  const rem = sleepToMinutes(pick(pt, 'rem'), units)
  const awake = sleepToMinutes(pick(pt, 'awake'), units)
  const inBed = sleepToMinutes(pick(pt, 'inBed', 'in_bed'), units)

  // Older HAE builds report only inBed + stages and no `asleep` total.
  const stageSum = [core, deep, rem].filter((x): x is number => x != null).reduce((s, x) => s + x, 0)
  const asleepFinal = asleep ?? (stageSum > 0 ? stageSum : null)

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
    raw: JSON.stringify(w),
  }
}

function spanMinutes(start: string | null, end: string | null): number | null {
  if (!start || !end) return null
  const a = Date.parse(start.replace(' ', 'T').replace(/ ([+-]\d{4})$/, '$1'))
  const b = Date.parse(end.replace(' ', 'T').replace(/ ([+-]\d{4})$/, '$1'))
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null
  return (b - a) / 60000
}
