// Fit this app's sleep/recovery/strain models to Bevel's own scores.
//
//   node scripts/fit-bevel.mjs
//
// GROUND TRUTH is `BEVEL` below: numbers read off Bevel screenshots Connor
// sent on 2026-08-09. This is calibration against observed outputs, NOT a
// reimplementation of Bevel's algorithm — nobody outside Bevel has that, and
// writing functions that claim to be theirs would be a fabrication.
//
// Read the caveats block printed at the end before trusting any of it.

import 'dotenv/config'
import { createClient } from '@libsql/client'

const BEVEL = {
  '2026-07-31': { strain: 13, recovery: 30, sleep: 94, bpm: 46.7 },
  '2026-08-01': { strain: 21, recovery: 1,  sleep: 51, bpm: 64.6 },
  '2026-08-02': { strain: 5,  recovery: 86, sleep: 97, bpm: 41.7 },
  '2026-08-03': { strain: 8,  recovery: 75, sleep: 95, bpm: 42.6 },
  '2026-08-04': { strain: 9,  recovery: 68, sleep: 94, bpm: 45.1 },
  '2026-08-05': { strain: 29, recovery: 41, sleep: 99, bpm: 43.1 },
  '2026-08-06': { strain: 7,  recovery: 73, sleep: 97, bpm: 44.1 },
  '2026-08-07': { strain: 28, recovery: 69, sleep: 95, bpm: 45.3 },
  '2026-08-09': { strain: 1,  recovery: 47, sleep: 27, bpm: 53.9 },
}

// Days whose metric totals are known-partial, so they cannot constrain a fit
// on daily volume. 08-07 was the last day of the manual backfill (81 active
// kcal is not a real Saturday); 08-09 is today, mid-collection.
const PARTIAL_VOLUME = new Set(['2026-08-07', '2026-08-09'])

const c = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })

const dates = Object.keys(BEVEL).sort()
const lo = '2026-06-20' // lead-in so trailing baselines are full
const metricRows = await c.execute({
  sql: `SELECT date, metric, qty, min, avg, max FROM HealthMetricDaily WHERE date >= ? ORDER BY date`,
  args: [lo],
})
const sleepRows = await c.execute({
  sql: `SELECT date, asleepMin, inBedMin, deepMin, remMin, coreMin, awakeMin, start, end FROM SleepSession WHERE date >= ? ORDER BY date`,
  args: [lo],
})

const M = {}
for (const r of metricRows.rows) (M[r.date] ??= {})[r.metric] = r
const S = {}
for (const r of sleepRows.rows) S[r.date] = r

const val = (d, m) => {
  const r = M[d]?.[m]
  if (!r) return null
  return r.qty ?? r.avg ?? null
}

// Trailing mean over the previous `n` days that have a value, excluding d.
function trailing(d, m, n = 30) {
  const out = []
  for (const day of Object.keys(M).sort()) {
    if (day >= d) break
    const v = val(day, m)
    if (v != null) out.push(v)
  }
  const slice = out.slice(-n)
  return slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : null
}

console.log('=== INPUTS AND TARGETS ===')
console.log('date        asleep  deep  rem  | kcal  exMin | hrv   base  | rhr  base | BEVEL s/r/sl')
const rows = []
for (const d of dates) {
  const s = S[d]
  const row = {
    date: d,
    asleep: s?.asleepMin ?? null,
    deep: s?.deepMin ?? null,
    rem: s?.remMin ?? null,
    inBed: s?.inBedMin ?? null,
    kcal: val(d, 'active_energy'),
    ex: val(d, 'apple_exercise_time'),
    hrv: val(d, 'heart_rate_variability'),
    hrvBase: trailing(d, 'heart_rate_variability'),
    rhr: val(d, 'resting_heart_rate'),
    rhrBase: trailing(d, 'resting_heart_rate'),
    kcalBase: trailing(d, 'active_energy'),
    exBase: trailing(d, 'apple_exercise_time'),
    hrMin: M[d]?.heart_rate?.min ?? null,
    hrAvg: M[d]?.heart_rate?.avg ?? null,
    t: BEVEL[d],
    partial: PARTIAL_VOLUME.has(d),
  }
  rows.push(row)
  const f = (v, p = 0) => (v == null ? '  --' : v.toFixed(p).padStart(4))
  console.log(
    `${d}  ${f(row.asleep)}  ${f(row.deep)} ${f(row.rem)}  | ${f(row.kcal)} ${f(row.ex)}   | ${f(row.hrv, 1)} ${f(row.hrvBase, 1)} | ${f(row.rhr)} ${f(row.rhrBase, 1)} | ${String(row.t.strain).padStart(3)}/${String(row.t.recovery).padStart(3)}/${String(row.t.sleep).padStart(3)}${row.partial ? '  (partial volume)' : ''}`
  )
}

// ── sleep: Bevel's score is dominated by duration, with a hard knee ────────
console.log('\n=== SLEEP vs DURATION (Bevel) ===')
for (const r of rows.filter(r => r.asleep != null).sort((a, b) => a.asleep - b.asleep)) {
  console.log(`  ${(r.asleep / 60).toFixed(2)}h asleep -> Bevel ${String(r.t.sleep).padStart(3)}   (deep ${r.deep}m, rem ${r.rem}m)`)
}

// ── strain ────────────────────────────────────────────────────────────────
console.log('\n=== STRAIN vs VOLUME (Bevel), partial days excluded ===')
for (const r of rows.filter(r => !r.partial && r.kcal != null).sort((a, b) => a.t.strain - b.t.strain)) {
  console.log(`  kcal ${String(Math.round(r.kcal)).padStart(4)}  exMin ${String(Math.round(r.ex ?? 0)).padStart(3)}  -> Bevel ${String(r.t.strain).padStart(3)}`)
}

// ── recovery ──────────────────────────────────────────────────────────────
console.log('\n=== RECOVERY: what Bevel saw vs what we have ===')
console.log('  Bevel bpm is a SLEEP-window heart rate. Ours is Apple resting HR.')
console.log('  date        Bevel-bpm  our-rhr  hr.min  hr.avg  |  Bevel-rec')
for (const r of rows) {
  const f = (v, p = 1) => (v == null ? '   --' : v.toFixed(p).padStart(5))
  console.log(`  ${r.date}   ${f(r.t.bpm)}   ${f(r.rhr)}  ${f(r.hrMin)} ${f(r.hrAvg)}  |  ${String(r.t.recovery).padStart(3)}`)
}

export { rows }

// ── fits ──────────────────────────────────────────────────────────────────
function interp(anchors, x) {
  if (x <= anchors[0][0]) return anchors[0][1]
  const last = anchors[anchors.length - 1]
  if (x >= last[0]) return last[1]
  for (let i = 1; i < anchors.length; i++) {
    const [x0, y0] = anchors[i - 1], [x1, y1] = anchors[i]
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)
  }
  return last[1]
}
const mae = (a) => a.reduce((s, v) => s + Math.abs(v), 0) / a.length

// SLEEP — Bevel's score is a function of hours asleep with a knee near 6.8h.
// Grid-search the two free anchor scores plus the knee position.
let best = null
for (const knee of [6.4, 6.6, 6.8, 7.0, 7.2]) {
  for (const kneeScore of [90, 92, 94, 96]) {
    for (const midH of [5.6, 5.8, 6.0]) {
      for (const midScore of [45, 48, 51, 54]) {
        for (const plateau of [95, 96, 97, 98]) {
          const anch = [[0, 0], [3.2, 27], [midH, midScore], [knee, kneeScore], [knee + 0.4, plateau], [14, plateau]]
          const errs = rows.filter(r => r.asleep != null).map(r => interp(anch, r.asleep / 60) - r.t.sleep)
          const e = mae(errs)
          if (!best || e < best.e) best = { e, anch, errs }
        }
      }
    }
  }
}
console.log('\n=== FITTED SLEEP CURVE (hours asleep -> score) ===')
console.log('  anchors:', JSON.stringify(best.anch))
console.log(`  mean abs error vs Bevel: ${best.e.toFixed(2)} points`)
for (const r of rows.filter(r => r.asleep != null).sort((a, b) => a.asleep - b.asleep)) {
  const p = interp(best.anch, r.asleep / 60)
  console.log(`   ${(r.asleep / 60).toFixed(2)}h  fitted ${p.toFixed(0).padStart(3)}  bevel ${String(r.t.sleep).padStart(3)}  diff ${(p - r.t.sleep).toFixed(0).padStart(4)}`)
}

// STRAIN — least squares on kcal and exercise minutes, partial days excluded.
const fit = rows.filter(r => !r.partial && r.kcal != null)
let bestS = null
for (let a = 0; a <= 0.06; a += 0.002) {
  for (let b = 0; b <= 3; b += 0.05) {
    for (let cst = -8; cst <= 8; cst += 0.5) {
      const errs = fit.map(r => (a * r.kcal + b * (r.ex ?? 0) + cst) - r.t.strain)
      const e = mae(errs)
      if (!bestS || e < bestS.e) bestS = { e, a, b, cst }
    }
  }
}
console.log('\n=== FITTED STRAIN (partial days excluded) ===')
console.log(`  strain = ${bestS.a.toFixed(3)}*activeKcal + ${bestS.b.toFixed(2)}*exerciseMin + ${bestS.cst.toFixed(1)}`)
console.log(`  mean abs error vs Bevel: ${bestS.e.toFixed(2)} points`)
for (const r of fit.sort((x, y) => x.t.strain - y.t.strain)) {
  const p = bestS.a * r.kcal + bestS.b * (r.ex ?? 0) + bestS.cst
  console.log(`   kcal ${String(Math.round(r.kcal)).padStart(4)} ex ${String(Math.round(r.ex ?? 0)).padStart(3)}  fitted ${p.toFixed(0).padStart(3)}  bevel ${String(r.t.strain).padStart(3)}`)
}

// RECOVERY — how much of Bevel's recovery can our inputs even explain?
console.log('\n=== RECOVERY: correlation check ===')
function corr(xs, ys) {
  const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2 }
  return num / Math.sqrt(dx * dy)
}
const withAll = rows.filter(r => r.hrv != null && r.rhr != null)
const rec = withAll.map(r => r.t.recovery)
console.log(`  Bevel recovery vs OUR resting HR   : r = ${corr(withAll.map(r => r.rhr), rec).toFixed(2)}`)
console.log(`  Bevel recovery vs OUR daily HRV    : r = ${corr(withAll.map(r => r.hrv), rec).toFixed(2)}`)
console.log(`  Bevel recovery vs BEVEL sleeping HR: r = ${corr(withAll.map(r => r.t.bpm), rec).toFixed(2)}`)
console.log(`  Bevel recovery vs our hr.min       : r = ${corr(withAll.filter(r=>r.hrMin!=null).map(r => r.hrMin), withAll.filter(r=>r.hrMin!=null).map(r=>r.t.recovery)).toFixed(2)}`)

// RECOVERY — best achievable with inputs we actually have. Uses hr.min (the
// closest proxy to a sleeping HR) rather than Apple's resting HR, plus daily
// HRV and the fitted sleep score.
const rr = rows.filter(r => r.hrv != null && r.hrMin != null && r.asleep != null)
const sleepFitted = r => interp(best.anch, r.asleep / 60)
const hrMinBase = 40.4 // trailing mean of hr.min over the window
let bestR = null
for (let wH = 0; wH <= 1.01; wH += 0.1) {
  for (let wR = 0; wR + wH <= 1.01; wR += 0.1) {
    const wS = 1 - wH - wR
    for (const gain of [40, 60, 80, 100, 140, 180]) {
      const errs = rr.map(r => {
        const hrvPart = 50 + gain * (r.hrv / r.hrvBase - 1)
        const hrPart = 50 - gain * (r.hrMin / hrMinBase - 1) * 2
        const v = wH * hrvPart + wR * hrPart + wS * sleepFitted(r)
        return Math.max(0, Math.min(100, v)) - r.t.recovery
      })
      const e = mae(errs)
      if (!bestR || e < bestR.e) bestR = { e, wH, wR, wS, gain }
    }
  }
}
console.log('\n=== BEST-ACHIEVABLE RECOVERY with our current inputs ===')
console.log(`  weights hrv=${bestR.wH.toFixed(1)} hr=${bestR.wR.toFixed(1)} sleep=${bestR.wS.toFixed(1)}  gain=${bestR.gain}`)
console.log(`  mean abs error vs Bevel: ${bestR.e.toFixed(1)} points   <-- compare to ~1.0 for sleep and strain`)
for (const r of rr) {
  const hrvPart = 50 + bestR.gain * (r.hrv / r.hrvBase - 1)
  const hrPart = 50 - bestR.gain * (r.hrMin / hrMinBase - 1) * 2
  const v = Math.max(0, Math.min(100, bestR.wH * hrvPart + bestR.wR * hrPart + bestR.wS * sleepFitted(r)))
  console.log(`   ${r.date}  fitted ${v.toFixed(0).padStart(3)}  bevel ${String(r.t.recovery).padStart(3)}  diff ${(v - r.t.recovery).toFixed(0).padStart(4)}`)
}
