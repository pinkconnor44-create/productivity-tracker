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
  | 'walkingHr' | 'wristTemp'

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
    DURATION_ANCHORS: [[0, 0], [3.2, 27], [5.8, 51], [6.8, 94], [7.4, 96], [14, 96]] as [number, number][],
  },

  RECOVERY: {
    // The fit recovered these three weights independently and landed exactly
    // on the values already here, which is the useful finding: the weighting
    // was never wrong. The INPUT is. See RECOVERY_LIMIT below.
    W_HRV: 0.50,
    W_RHR: 0.30,
    W_SLEEP: 0.20,
    /** ratio (value / baseline) → score, linearly interpolated and clamped.
     *  HRV above baseline is good. Refit against Bevel: the old curves sat a
     *  flat ~20 points high (every one of the nine days scored over, mean
     *  +14) and were too shallow, so an ordinary day and a genuinely good one
     *  landed within a few points of each other. */
    HRV_ANCHORS: [[0.60, 0], [0.75, 0], [0.90, 31], [1.00, 50], [1.15, 73], [1.35, 89]] as [number, number][],
    /** Heart rate is inverted — *below* baseline is the good direction. This
     *  now scores the daily MINIMUM heart rate, which swings considerably
     *  more than Apple's smoothed resting HR, hence the steeper curve. */
    RHR_ANCHORS: [[0.88, 89], [0.95, 73], [1.00, 50], [1.05, 21], [1.12, 0], [1.20, 0]] as [number, number][],
  },

  STRAIN: {
    /** strain = KCAL_COEF*activeKcal + EX_COEF*exerciseMin + INTERCEPT,
     *  clamped to 0..100. Least-squares fit against Bevel over the seven
     *  calibration days with complete daily volume; mean absolute error 1.0.
     *
     *  This replaced a baseline-relative model that ran roughly 3x hot — it
     *  scored a 526kcal/13min day at 78 where Bevel said 29. Bevel's strain
     *  is an absolute load scale against a target band (its own copy says
     *  "Target Strain of 20-42%"), not a percentile against your own history,
     *  so a baseline-relative model could not have matched it at any
     *  weighting. */
    KCAL_COEF: 0.028,
    EX_COEF: 1.35,
    INTERCEPT: -3.0,
    MAX: 100,
  },
} as const

/** Why recovery still does not match Bevel, stated where the constants are.
 *
 *  Bevel scores recovery on SLEEP-WINDOW physiology. This app only has daily
 *  aggregates. Measured over the nine calibration days:
 *
 *    Bevel recovery vs Bevel's own sleeping HR : r = -0.81
 *    Bevel recovery vs our daily minimum HR    : r = -0.41
 *    Bevel recovery vs Apple's resting HR      : r = +0.39   (wrong sign)
 *
 *  Switching the input from Apple's resting HR to the daily minimum halves
 *  the error (about 20 points of mean absolute error down to about 9), which
 *  is why this file now scores on the minimum. Closing the rest needs actual
 *  sleep-window readings — 2026-08-01 is the proof: Bevel saw a sleeping HR
 *  of 64.6 against a normal ~44 and scored recovery 1, while every daily
 *  aggregate we hold looked unremarkable and no weighting could have found
 *  it. */
export const RECOVERY_LIMIT = 'daily aggregates, not sleep-window readings' as const

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

/** Trailing mean of the most recent `days` observations, excluding the day
 *  being scored. Nulls are skipped rather than counted as zero — a watch left
 *  on the charger must not drag the baseline down. */
export function baselineOf(values: (number | null | undefined)[], days = HEALTH_CONSTANTS.BASELINE_DAYS): Baseline {
  const present = values.filter((v): v is number => v != null && Number.isFinite(v)).slice(-days)
  if (present.length === 0) return emptyBaseline()
  const mean = present.reduce((s, v) => s + v, 0) / present.length
  return {
    value: mean,
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

export type RecoveryInput = {
  hrv?: number | null
  hrvBaseline?: number | null
  /** The day's MINIMUM heart rate, not Apple's resting HR — the closest
   *  proxy available to the sleeping heart rate Bevel scores on. Named
   *  `restingHr` no longer, because it is a different quantity and the whole
   *  bug was two different quantities sharing one name. */
  lowHr?: number | null
  lowHrBaseline?: number | null
  sleepScore?: number | null
}

/** 0–100, or null if nothing usable is present. Each component needs both a
 *  reading and a baseline; whichever survive are renormalised to sum to 1. */
export function recoveryScore(i: RecoveryInput): number | null {
  const C = HEALTH_CONSTANTS.RECOVERY
  const parts: { w: number; v: number }[] = []

  if (i.hrv != null && i.hrvBaseline != null && i.hrvBaseline > 0) {
    parts.push({ w: C.W_HRV, v: interpolate(C.HRV_ANCHORS, i.hrv / i.hrvBaseline) })
  }
  if (i.lowHr != null && i.lowHrBaseline != null && i.lowHrBaseline > 0) {
    parts.push({ w: C.W_RHR, v: interpolate(C.RHR_ANCHORS, i.lowHr / i.lowHrBaseline) })
  }
  if (i.sleepScore != null) {
    parts.push({ w: C.W_SLEEP, v: i.sleepScore })
  }
  return renormalise(parts)
}

export type StrainInput = {
  activeKcal?: number | null
  kcalBaseline?: number | null
  exerciseMin?: number | null
  exerciseBaseline?: number | null
}

/** 0–100, or null without a baseline to compare against. A day at exactly
 *  baseline load lands on STRAIN.BASELINE_SCORE. */
export function strainScore(i: StrainInput): number | null {
  const C = HEALTH_CONSTANTS.STRAIN
  // Absolute load, not load-relative-to-your-own-baseline. The baselines are
  // still accepted on the input type so callers do not all have to change,
  // and are deliberately unused: Bevel's strain is measured against a fixed
  // target band, so a day at your personal average is a LOW strain day, not
  // a middling one. The old baseline-relative model could not express that.
  if (i.activeKcal == null && i.exerciseMin == null) return null
  const raw = C.KCAL_COEF * (i.activeKcal ?? 0) + C.EX_COEF * (i.exerciseMin ?? 0) + C.INTERCEPT
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
