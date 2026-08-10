// Health scoring — pure functions, no Prisma, no Next.
//
// These are *approximations* of Bevel's proprietary scores, built from the
// same inputs (sleep duration + stages, HRV and resting HR against a personal
// trailing baseline, energy and exercise load). They will not match Bevel
// digit-for-digit and are not meant to. Every weight and anchor lives in this
// file so tuning them is one edit in one place.
//
// The design rule that matters: a score is null, never zero, when its inputs
// are missing. A missing HRV reading is not a bad recovery day, and the UI
// draws null as a dashed ring rather than a red one.

// ── metric vocabulary ─────────────────────────────────────────────────────
// HAE metric name → the key the UI uses, plus which column carries the value.
// `qty` is for totals (steps, energy); `avg` for sampled vitals (HR, HRV).

export type MetricKey =
  | 'hrv' | 'restingHr' | 'hr' | 'respRate' | 'spo2' | 'vo2Max'
  | 'activeKcal' | 'basalKcal' | 'exerciseMin' | 'standHours' | 'steps'
  | 'walkingHr' | 'wristTemp' | 'elevatedMin'

type MetricDef = {
  key: MetricKey
  /** HAE names, normalised to snake_case. First match wins. */
  aliases: string[]
  field: 'qty' | 'avg'
  label: string
  unit: string
  /** Fewer decimals than this reads as false precision on a dial. */
  decimals: number
}

export const METRIC_DEFS: MetricDef[] = [
  { key: 'hrv',         aliases: ['heart_rate_variability', 'hrv', 'heart_rate_variability_sdnn'], field: 'avg', label: 'HRV',         unit: 'ms',    decimals: 0 },
  { key: 'restingHr',   aliases: ['resting_heart_rate'],                    field: 'avg', label: 'Resting HR',  unit: 'bpm',   decimals: 0 },
  { key: 'hr',          aliases: ['heart_rate'],                            field: 'avg', label: 'Heart rate',  unit: 'bpm',   decimals: 0 },
  { key: 'respRate',    aliases: ['respiratory_rate'],                      field: 'avg', label: 'Respiratory', unit: 'br/min', decimals: 1 },
  { key: 'spo2',        aliases: ['blood_oxygen_saturation', 'oxygen_saturation'], field: 'avg', label: 'Blood O₂', unit: '%',  decimals: 0 },
  { key: 'vo2Max',      aliases: ['vo2_max'],                               field: 'avg', label: 'VO₂ max',     unit: '',      decimals: 1 },
  { key: 'activeKcal',  aliases: ['active_energy', 'active_energy_burned'], field: 'qty', label: 'Active',      unit: 'kcal',  decimals: 0 },
  { key: 'basalKcal',   aliases: ['basal_energy_burned', 'resting_energy'], field: 'qty', label: 'Resting',     unit: 'kcal',  decimals: 0 },
  { key: 'exerciseMin', aliases: ['apple_exercise_time', 'exercise_time'],  field: 'qty', label: 'Exercise',    unit: 'min',   decimals: 0 },
  // NOT apple_stand_time: HAE sends both, and they are different quantities
  // (stand *hours* count vs stand *minutes*). Aliasing both to one key made
  // whichever row happened to be read last silently win.
  { key: 'standHours',  aliases: ['apple_stand_hour', 'stand_hours'],      field: 'qty', label: 'Stand',       unit: 'hr',    decimals: 0 },
  { key: 'steps',       aliases: ['step_count', 'steps'],                   field: 'qty', label: 'Steps',       unit: '',      decimals: 0 },
  { key: 'walkingHr',   aliases: ['walking_heart_rate_average'],            field: 'avg', label: 'Walking HR',  unit: 'bpm',   decimals: 0 },
  { key: 'wristTemp',   aliases: ['apple_sleeping_wrist_temperature', 'wrist_temperature'], field: 'avg', label: 'Wrist temp', unit: '°', decimals: 1 },
  // Derived, not exported by Apple: minutes the heart rate spent at or above
  // STRAIN.HR_ELEVATED_BPM, computed from the raw samples at import time and
  // written back as an ordinary daily row so baselines and Trends get it for
  // free. It is a MetricDef rather than a loose column because it is exactly
  // what a MetricDef is — a per-day number with a unit and a label.
  { key: 'elevatedMin', aliases: ['hr_minutes_above_90'],                 field: 'qty', label: 'Elevated HR',  unit: 'min',   decimals: 0 },
]

const ALIAS_TO_DEF = new Map<string, MetricDef>()
for (const d of METRIC_DEFS) for (const a of d.aliases) ALIAS_TO_DEF.set(a, d)

export function defForMetric(name: string): MetricDef | undefined {
  return ALIAS_TO_DEF.get(name)
}

// ── tuning constants ──────────────────────────────────────────────────────

export const HEALTH_CONSTANTS = {
  /** Trailing window for every personal baseline, in days. */
  BASELINE_DAYS: 30,
  /** Below this many observations a baseline is shown as "Calibrating". */
  BASELINE_MIN_DAYS: 7,

  // Every constant below was CALIBRATED against Bevel's own scores on
  // 2026-08-09, using nine days Connor screenshotted (2026-07-31 .. 08-09).
  // This is a fit to observed output, not a copy of Bevel's algorithm — that
  // is not public, and writing functions that claimed to be theirs would be
  // an invention. `scripts/fit-bevel.mjs` reproduces every number here and
  // reports the residuals; re-run it when more days are available.
  SLEEP: {
    /** Hours ASLEEP → score, linearly interpolated.
     *
     *  Bevel's sleep score turned out to be almost purely a duration curve
     *  with a hard knee below ~6.8h: 3.2h→27, 5.8h→51, 6.8h→94, then a
     *  plateau in the mid-90s no matter how much more is slept. The old model
     *  was `min(1, asleep/8h)` and was far too forgiving of a short night —
     *  it scored a 3.2h night at 58 where Bevel said 27.
     *
     *  Stage mix (deep/REM) is deliberately NOT weighted any more: across the
     *  nine calibration days it had no detectable effect on Bevel's number.
     *  A 6.8h night with 106m deep scored 94; a 7.1h night with 62m deep
     *  scored 99. Keeping a stage term would have been fitting noise. */
    DURATION_ANCHORS: [[0, 0], [3.2, 27], [5.8, 51], [6.8, 96], [7.2, 95], [14, 95]] as [number, number][],
  },

  RECOVERY: {
    // Recovery is scored ENTIRELY on physiology measured inside last night's
    // sleep window. That is both what Bevel does and what makes the score
    // stand still: none of these inputs can change once you are awake, so the
    // number you see at 9am is the number you see at 9pm. The old model read
    // whole-day HRV and the day's lowest heart rate, which kept moving as the
    // day went on — HRV falls after waking, so recovery visibly decayed from
    // morning to night. That was the complaint, and it was a symptom of
    // scoring the wrong window rather than of any weighting.
    W_SLEEP_HR: 0.60,
    W_SLEEP_HRV: 0.35,
    W_SLEEP_RESP: 0.05,
    // Sleep DURATION carries no weight. The fit was free to give it any share
    // and chose zero: 2026-08-10 was 5.7h and Bevel scored recovery 89, while
    // 2026-08-05 was 7.1h and scored 41. Duration drives the SLEEP score, not
    // this one. Kept out rather than kept at zero so nothing reads as a live
    // input that isn't.

    /** Sleeping heart rate as a ratio to its trailing baseline. Inverted —
     *  *below* baseline is the good direction. The strongest single signal:
     *  r = -0.85 against Bevel's recovery across ten nights. */
    HR_ANCHORS: [[0.88, 100], [1.00, 50], [1.30, 0]] as [number, number][],
    /** Sleeping HRV as a ratio to its trailing baseline. Above is good. */
    HRV_ANCHORS: [[0.75, 0], [1.00, 50], [1.20, 100]] as [number, number][],
    /** Sleeping respiratory rate, inverted. A small weight, but a real one:
     *  it is what separates two nights with similar heart rate and HRV, and
     *  adding it took the fit from 5.8 to 3.1 points of error. */
    RESP_ANCHORS: [[0.97, 100], [1.00, 50], [1.10, 0]] as [number, number][],
  },

  STRAIN: {
    /** strain = KCAL_COEF*activeKcal + HR90_COEF*minutesAbove90bpm
     *           + EX_COEF*exerciseMin + INTERCEPT, clamped to 0..100.
     *
     *  Energy and exercise minutes alone could not explain Bevel: 2026-08-03
     *  (359 kcal, 3 min) scored 8 while 2026-08-05 (526 kcal, 13 min) scored
     *  29 — but so did days that separate only on how long the heart rate was
     *  actually elevated. Adding time above 90bpm, measured from the raw
     *  samples, took the error from 2.6 to 1.3 points.
     *
     *  Still an ABSOLUTE load scale, not a percentile against personal
     *  history — Bevel's own copy says "Target Strain of 20-42%".
     *
     *  ⚠️ 2026-08-07 is not explained by this model and is held out of the
     *  fit: Bevel scored it 28 against a fitted 13, on inputs statistically
     *  indistinguishable from 2026-08-03 which Bevel scored 8. */
    KCAL_COEF: 0.018,
    HR90_COEF: 0.10,
    EX_COEF: 0.60,
    INTERCEPT: -0.5,
    /** Heart rate at or above this counts toward the elevated-time term. */
    HR_ELEVATED_BPM: 90,
    /** A gap between consecutive readings longer than this is not credited —
     *  a watch left on the charger must not read as hours of exertion. */
    SAMPLE_GAP_CAP_MIN: 5,
    MAX: 100,
  },
} as const

/** The old limit, and how it was closed — kept because the measurement is the
 *  evidence that the input is now right, independently of any weighting.
 *
 *  Recovery used to be scored on daily aggregates, and could not match Bevel
 *  at any weighting because Bevel scores the sleep window. With raw timestamped
 *  samples the sleep window is computable, and the mean heart rate inside it
 *  reproduces Bevel's own published sleeping bpm to **0.10 bpm** across nine
 *  nights (2026-07-31 .. 08-09). That is not a fit — it is the same quantity.
 *
 *  What remains uncertain is the BASELINE, not the input. Bevel compares
 *  against months of history; sleep-window history here starts whenever raw
 *  sample export was switched on. Until ~30 nights accumulate, a rising HRV
 *  trend lifts the trailing baseline fast enough that a genuinely good night
 *  can read as ordinary — which is exactly what 2026-08-10 did, scoring 73
 *  against Bevel's 89 while the other nine nights fitted within 4 points. */
export const RECOVERY_LIMIT = 'baseline history, not the input' as const

// ── baselines ─────────────────────────────────────────────────────────────

export type Baseline = {
  value: number | null
  /** Observations behind `value`. */
  n: number
  calibrating: boolean
}

export function emptyBaseline(): Baseline {
  return { value: null, n: 0, calibrating: true }
}

/** Trailing MEDIAN of the most recent `days` observations, excluding the day
 *  being scored. Nulls are skipped rather than counted as zero — a watch left
 *  on the charger must not drag the baseline down.
 *
 *  Median rather than mean, because these baselines are built on sparse
 *  readings and one artefact distorts a mean for a month. Sleeping HRV is
 *  often a SINGLE reading per night: 2026-08-08 recorded 139.9ms against a
 *  personal norm near 65, which under a mean lifted the comparator enough to
 *  cost 2026-08-10 sixteen points of recovery. A median counts an outlier's
 *  rank and ignores its magnitude, which is the property a baseline wants.
 *  Switching to it took the recovery fit from 4.4 to 3.1 points of error. */
export function baselineOf(values: (number | null | undefined)[], days = HEALTH_CONSTANTS.BASELINE_DAYS): Baseline {
  const present = values.filter((v): v is number => v != null && Number.isFinite(v)).slice(-days)
  if (present.length === 0) return emptyBaseline()
  const sorted = [...present].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  return {
    value: median,
    n: present.length,
    calibrating: present.length < HEALTH_CONSTANTS.BASELINE_MIN_DAYS,
  }
}

/** Piecewise-linear interpolation across [input, score] anchors, clamped. */
export function interpolate(anchors: [number, number][], x: number): number {
  if (x <= anchors[0][0]) return anchors[0][1]
  const last = anchors[anchors.length - 1]
  if (x >= last[0]) return last[1]
  for (let i = 1; i < anchors.length; i++) {
    const [x0, y0] = anchors[i - 1]
    const [x1, y1] = anchors[i]
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)
  }
  return last[1]
}

// ── scores ────────────────────────────────────────────────────────────────

export type SleepInput = {
  asleepMin?: number | null
  deepMin?: number | null
  remMin?: number | null
} | null | undefined

/** 0–100, or null with no sleep duration at all. Stage components only apply
 *  when the stages were actually recorded; without them the duration
 *  component is renormalised to carry the whole score rather than the night
 *  being penalised for the watch not tracking stages. */
export function sleepScore(s: SleepInput): number | null {
  if (!s || s.asleepMin == null || !Number.isFinite(s.asleepMin) || s.asleepMin <= 0) return null
  // Duration only — see SLEEP.DURATION_ANCHORS for why the stage terms went.
  return interpolate(HEALTH_CONSTANTS.SLEEP.DURATION_ANCHORS, s.asleepMin / 60)
}

/** Everything here is measured INSIDE the sleep window that ended on the day
 *  being scored — see SleepWindow in the API contract below. Nothing on this
 *  type can change after waking, which is what makes the score stable. */
export type RecoveryInput = {
  /** Mean heart rate across the sleep window. This is the same quantity Bevel
   *  reports as your sleeping bpm, matched to 0.10 bpm over nine nights. */
  sleepHr?: number | null
  sleepHrBaseline?: number | null
  sleepHrv?: number | null
  sleepHrvBaseline?: number | null
  sleepResp?: number | null
  sleepRespBaseline?: number | null
}

/** 0–100, or null if nothing usable is present. Each component needs both a
 *  reading and a baseline; whichever survive are renormalised to sum to 1.
 *
 *  Deliberately takes no "as of" time and no daytime reading: given the same
 *  night, this returns the same number forever. */
export function recoveryScore(i: RecoveryInput): number | null {
  const C = HEALTH_CONSTANTS.RECOVERY
  const parts: { w: number; v: number }[] = []

  if (i.sleepHr != null && i.sleepHrBaseline != null && i.sleepHrBaseline > 0) {
    parts.push({ w: C.W_SLEEP_HR, v: interpolate(C.HR_ANCHORS, i.sleepHr / i.sleepHrBaseline) })
  }
  if (i.sleepHrv != null && i.sleepHrvBaseline != null && i.sleepHrvBaseline > 0) {
    parts.push({ w: C.W_SLEEP_HRV, v: interpolate(C.HRV_ANCHORS, i.sleepHrv / i.sleepHrvBaseline) })
  }
  if (i.sleepResp != null && i.sleepRespBaseline != null && i.sleepRespBaseline > 0) {
    parts.push({ w: C.W_SLEEP_RESP, v: interpolate(C.RESP_ANCHORS, i.sleepResp / i.sleepRespBaseline) })
  }
  return renormalise(parts)
}

export type StrainInput = {
  activeKcal?: number | null
  exerciseMin?: number | null
  /** Minutes with heart rate at or above STRAIN.HR_ELEVATED_BPM. */
  elevatedMin?: number | null
}

/** 0–100, or null when the day has no load information at all.
 *
 *  Absolute load, not load-relative-to-your-own-baseline: Bevel's strain is
 *  measured against a fixed target band, so a day at your personal average is
 *  a LOW strain day rather than a middling one. */
export function strainScore(i: StrainInput): number | null {
  const C = HEALTH_CONSTANTS.STRAIN
  if (i.activeKcal == null && i.exerciseMin == null && i.elevatedMin == null) return null
  const raw = C.KCAL_COEF * (i.activeKcal ?? 0)
    + C.HR90_COEF * (i.elevatedMin ?? 0)
    + C.EX_COEF * (i.exerciseMin ?? 0)
    + C.INTERCEPT
  return Math.max(0, Math.min(C.MAX, Math.round(raw * 10) / 10))
}

/** Weighted mean over whichever components are present. Returns null for an
 *  empty set — the "we have nothing to say about this day" signal. */
function renormalise(parts: { w: number; v: number }[]): number | null {
  if (parts.length === 0) return null
  const wSum = parts.reduce((s, p) => s + p.w, 0)
  if (wSum <= 0) return null
  const v = parts.reduce((s, p) => s + p.w * p.v, 0) / wSum
  return Math.max(0, Math.round(v * 10) / 10)
}

// ── API contract ──────────────────────────────────────────────────────────
// Shared by /api/health and BevelView so the two cannot drift.

export type HealthSleep = {
  date: string
  start: string | null
  end: string | null
  inBedMin: number | null
  asleepMin: number | null
  coreMin: number | null
  deepMin: number | null
  remMin: number | null
  awakeMin: number | null
}

/** Physiology measured inside one night's sleep window, with the trailing
 *  baselines it was compared against. Recovery is computed from exactly this
 *  and nothing else, so shipping it to the client lets the Recovery tab show
 *  the real derivation rather than a plausible-looking reconstruction. */
export type SleepWindow = {
  /** Readings behind the means. Zero means the window held no readings — the
   *  watch was off — which is different from a bad night. */
  hrN: number
  hrvN: number
  respN: number
  hr: number | null
  hrv: number | null
  resp: number | null
  hrBaseline: number | null
  hrvBaseline: number | null
  respBaseline: number | null
}

export type HealthWorkoutLite = {
  id: number
  date: string
  type: string
  start: string | null
  end: string | null
  durationMin: number | null
  activeKcal: number | null
  avgHr: number | null
  maxHr: number | null
  distanceKm: number | null
}

export type HealthDay = {
  date: string
  metrics: Partial<Record<MetricKey, number | null>>
  /** Metrics HAE sent that we have no MetricDef for. Surfaced in Trends so
   *  new Apple metrics appear without a code change. */
  extra: Record<string, number | null>
  sleep: HealthSleep | null
  /** What recovery was scored on. Null when no sleep window covers this day. */
  sleepWindow: SleepWindow | null
  /** Minutes at or above STRAIN.HR_ELEVATED_BPM, from the raw samples. */
  elevatedMin: number | null
  workouts: HealthWorkoutLite[]
  scores: {
    sleep: number | null
    recovery: number | null
    strain: number | null
  }
  /** The trailing baselines actually used to score this day. */
  baselines: Partial<Record<MetricKey, number | null>>
}

/** Last authenticated import. Surfaced on an unauthenticated route on
 *  purpose: it is metadata about Connor's own data, which that route already
 *  returns in full, so it discloses nothing new — and putting it behind the
 *  API key would mean the browser could not show it without holding the key. */
export type LastImport = {
  at: string
  ok: boolean
  metrics: number
  sleep: number
  workouts: number
  skipped: number
  span: string | null
  note: string | null
  /** "phone" | "backfill" | "other" — who sent it. Null on rows written
   *  before the column existed. */
  source: string | null
} | null

export type HealthResponse = {
  start: string
  end: string
  days: HealthDay[]
  lastImport: LastImport
  /** Baselines as of the most recent day in range — what the UI compares
   *  today's readings against. */
  baselines: Partial<Record<MetricKey, Baseline>>
  /** True when there is no health data at all — drives the onboarding card. */
  empty: boolean
}

// ── formatting helpers shared by the views ────────────────────────────────

export function formatMinutes(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(min)) return '—'
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

/** "+12%" style delta against a baseline. null when either side is missing. */
export function deltaPct(value: number | null | undefined, baseline: number | null | undefined): number | null {
  if (value == null || baseline == null || baseline === 0) return null
  return Math.round(((value - baseline) / baseline) * 100)
}
