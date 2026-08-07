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
  { key: 'standHours',  aliases: ['apple_stand_hour', 'stand_hours', 'apple_stand_time'], field: 'qty', label: 'Stand', unit: 'hr', decimals: 0 },
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

  SLEEP: {
    /** Duration target. 8h of *asleep* time scores the full duration component. */
    TARGET_MIN: 8 * 60,
    /** Stage targets as a share of asleep time. */
    TARGET_DEEP_PCT: 0.15,
    TARGET_REM_PCT: 0.20,
    W_DURATION: 0.70,
    W_DEEP: 0.15,
    W_REM: 0.15,
  },

  RECOVERY: {
    W_HRV: 0.50,
    W_RHR: 0.30,
    W_SLEEP: 0.20,
    /** ratio (value / baseline) → score. Linearly interpolated between
     *  anchors, clamped at the ends. HRV above baseline is good. */
    HRV_ANCHORS: [[0.60, 10], [0.75, 30], [0.90, 55], [1.00, 70], [1.15, 88], [1.35, 100]] as [number, number][],
    /** Resting HR is inverted — *below* baseline is the good direction. */
    RHR_ANCHORS: [[0.88, 100], [0.95, 88], [1.00, 70], [1.05, 48], [1.12, 25], [1.20, 8]] as [number, number][],
  },

  STRAIN: {
    W_KCAL: 0.60,
    W_EXERCISE: 0.40,
    /** A day exactly at baseline load scores this. Leaves headroom above for
     *  genuinely hard days instead of pinning a normal Tuesday at 100. */
    BASELINE_SCORE: 67,
    MAX: 100,
  },
} as const

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
  const C = HEALTH_CONSTANTS.SLEEP
  const asleep = s.asleepMin

  const parts: { w: number; v: number }[] = [
    { w: C.W_DURATION, v: Math.min(1, asleep / C.TARGET_MIN) * 100 },
  ]
  if (s.deepMin != null && Number.isFinite(s.deepMin)) {
    parts.push({ w: C.W_DEEP, v: Math.min(1, (s.deepMin / asleep) / C.TARGET_DEEP_PCT) * 100 })
  }
  if (s.remMin != null && Number.isFinite(s.remMin)) {
    parts.push({ w: C.W_REM, v: Math.min(1, (s.remMin / asleep) / C.TARGET_REM_PCT) * 100 })
  }
  return renormalise(parts)
}

export type RecoveryInput = {
  hrv?: number | null
  hrvBaseline?: number | null
  restingHr?: number | null
  rhrBaseline?: number | null
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
  if (i.restingHr != null && i.rhrBaseline != null && i.rhrBaseline > 0) {
    parts.push({ w: C.W_RHR, v: interpolate(C.RHR_ANCHORS, i.restingHr / i.rhrBaseline) })
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
  const parts: { w: number; v: number }[] = []

  if (i.kcalBaseline != null && i.kcalBaseline > 0) {
    parts.push({ w: C.W_KCAL, v: ((i.activeKcal ?? 0) / i.kcalBaseline) * C.BASELINE_SCORE })
  }
  if (i.exerciseBaseline != null && i.exerciseBaseline > 0) {
    parts.push({ w: C.W_EXERCISE, v: ((i.exerciseMin ?? 0) / i.exerciseBaseline) * C.BASELINE_SCORE })
  }
  const raw = renormalise(parts)
  return raw == null ? null : Math.min(C.MAX, raw)
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

export type HealthResponse = {
  start: string
  end: string
  days: HealthDay[]
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
