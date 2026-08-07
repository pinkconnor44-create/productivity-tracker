// Seeds ~75 days of plausible demo health data through the real import
// endpoint, so the Bevel tab can be reviewed (including on the phone) before
// Health Auto Export has been bought and configured.
//
//   node scripts/seed-health-fixtures.mjs [baseUrl] [days]
//
// THIS IS NOT REAL DATA. Preview and prod share one Turso database, so run
// scripts/wipe-health-fixtures.mjs before the first real backfill — otherwise
// invented HRV values sit in the same baselines as Connor's actual readings.
//
// Deterministic: a fixed seed means re-running produces identical rows, which
// keeps it idempotent for the same reason the endpoint is.
import 'dotenv/config'

const [base = 'http://localhost:3000', daysArg] = process.argv.slice(2)
const DAYS = Number(daysArg ?? 75)
const key = process.env.HEALTH_IMPORT_KEY
if (!key) { console.error('HEALTH_IMPORT_KEY not set in .env'); process.exit(1) }

// Small deterministic PRNG (mulberry32) — Math.random would make every run
// write different values and defeat the idempotency check.
let seedState = 0x9e3779b9
function rnd() {
  seedState |= 0; seedState = (seedState + 0x6D2B79F5) | 0
  let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const jitter = (centre, spread) => centre + (rnd() - 0.5) * 2 * spread

function localDay(offsetFromToday) {
  const d = new Date()
  d.setDate(d.getDate() + offsetFromToday)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const stamp = (day, hh, mm) => `${day} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00 -0400`

const metricPoints = {
  heart_rate_variability: [], resting_heart_rate: [], heart_rate: [],
  respiratory_rate: [], blood_oxygen_saturation: [], vo2_max: [],
  active_energy: [], basal_energy_burned: [], apple_exercise_time: [],
  apple_stand_hour: [], step_count: [],
}
const sleepPoints = []
const workouts = []

for (let i = DAYS - 1; i >= 0; i--) {
  const day = localDay(-i)
  const prev = localDay(-i - 1)
  const dow = new Date(day + 'T12:00:00').getDay()
  const isRest = dow === 0
  // A slow upward drift so the trend lines have a shape rather than being noise.
  const drift = (DAYS - i) / DAYS

  const hrv = jitter(52 + drift * 8, 9)
  const rhr = jitter(56 - drift * 3, 3.5)
  const asleepHr = isRest ? jitter(8.1, 0.7) : jitter(7.0, 1.1)
  const deepHr = asleepHr * jitter(0.16, 0.04)
  const remHr = asleepHr * jitter(0.21, 0.05)
  const coreHr = Math.max(0.5, asleepHr - deepHr - remHr)
  const exerciseMin = isRest ? Math.round(jitter(12, 10)) : Math.round(jitter(48, 22))
  const activeKcal = isRest ? jitter(320, 90) : jitter(690, 210)

  metricPoints.heart_rate_variability.push({ date: stamp(day, 0, 0), Min: Math.round(hrv * 0.6), Avg: round1(hrv), Max: Math.round(hrv * 1.7) })
  metricPoints.resting_heart_rate.push({ date: stamp(day, 0, 0), Avg: Math.round(rhr) })
  metricPoints.heart_rate.push({ date: stamp(day, 0, 0), Min: Math.round(rhr - 6), Avg: Math.round(jitter(74, 5)), Max: Math.round(jitter(158, 14)) })
  metricPoints.respiratory_rate.push({ date: stamp(day, 0, 0), Avg: round1(jitter(14.6, 1.1)) })
  metricPoints.blood_oxygen_saturation.push({ date: stamp(day, 0, 0), Avg: round1(jitter(97.2, 0.8)) })
  metricPoints.vo2_max.push({ date: stamp(day, 0, 0), Avg: round1(jitter(44 + drift * 1.5, 0.4)) })
  metricPoints.active_energy.push({ date: stamp(day, 0, 0), qty: round1(activeKcal) })
  metricPoints.basal_energy_burned.push({ date: stamp(day, 0, 0), qty: round1(jitter(1720, 60)) })
  metricPoints.apple_exercise_time.push({ date: stamp(day, 0, 0), qty: Math.max(0, exerciseMin) })
  metricPoints.apple_stand_hour.push({ date: stamp(day, 0, 0), qty: Math.round(jitter(11, 2)) })
  metricPoints.step_count.push({ date: stamp(day, 0, 0), qty: Math.round(jitter(9200, 3400)) })

  const bedHour = 22 + Math.floor(rnd() * 2)
  const bedMin = Math.floor(rnd() * 59)
  const wakeTotal = bedHour * 60 + bedMin + Math.round((asleepHr + 0.4) * 60) - 1440
  sleepPoints.push({
    date: stamp(day, 0, 0),
    sleepStart: stamp(prev, bedHour, bedMin),
    sleepEnd: stamp(day, Math.max(0, Math.floor(wakeTotal / 60)), Math.max(0, wakeTotal % 60)),
    inBed: round2(asleepHr + jitter(0.5, 0.2)),
    asleep: round2(asleepHr),
    core: round2(coreHr),
    deep: round2(deepHr),
    rem: round2(remHr),
    awake: round2(jitter(0.3, 0.15)),
  })

  if (!isRest && rnd() > 0.35) {
    const startH = 17 + Math.floor(rnd() * 2)
    const durMin = Math.round(jitter(58, 18))
    const endTotal = startH * 60 + 5 + durMin
    workouts.push({
      id: `SEED-${day}`,
      name: dow % 2 === 0 ? 'Traditional Strength Training' : 'Outdoor Run',
      start: stamp(day, startH, 5),
      end: stamp(day, Math.floor(endTotal / 60), endTotal % 60),
      activeEnergyBurned: { qty: round1(jitter(410, 120)), units: 'kcal' },
      avgHeartRate: Math.round(jitter(131, 12)),
      maxHeartRate: Math.round(jitter(168, 9)),
      ...(dow % 2 === 1 ? { distance: { qty: round2(jitter(5.2, 1.4)), units: 'km' } } : {}),
    })
  }
}

function round1(v) { return Math.round(v * 10) / 10 }
function round2(v) { return Math.round(v * 100) / 100 }

const payload = {
  data: {
    metrics: [
      ...Object.entries(metricPoints).map(([name, data]) => ({ name, units: unitsFor(name), data })),
      { name: 'sleep_analysis', units: 'hr', data: sleepPoints },
    ],
    workouts,
  },
}
function unitsFor(name) {
  if (name.includes('energy')) return 'kcal'
  if (name === 'heart_rate_variability') return 'ms'
  if (name.includes('heart_rate')) return 'count/min'
  if (name === 'apple_exercise_time') return 'min'
  if (name === 'blood_oxygen_saturation') return '%'
  return 'count'
}

const res = await fetch(`${base}/api/health-import`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Api-Key': key },
  body: JSON.stringify(payload),
})
const json = await res.json().catch(() => ({}))
console.log(res.status, json)
console.log(`\nSeeded ${DAYS} days of DEMO data. Remove it with:\n  node scripts/wipe-health-fixtures.mjs`)
