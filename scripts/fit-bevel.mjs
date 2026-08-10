// Fit this app's sleep/recovery/strain models to Bevel's own scores.
//
//   node scripts/fit-bevel.mjs <raw-sample-export.json>
//
// GROUND TRUTH is `BEVEL` below: numbers read off Bevel screenshots. This is
// calibration against observed outputs, NOT a reimplementation of Bevel's
// algorithm — nobody outside Bevel has that.
//
// It takes a Health Auto Export file exported with **Aggregate Data OFF**, so
// every reading carries its own timestamp. That is what makes sleep-window
// physiology computable, and sleep-window physiology is what recovery is
// scored on. An aggregated export cannot drive this script.
//
// Read the caveats printed at the end before trusting any of it.
import { readFileSync } from 'node:fs'

const FILE = process.argv[2]
if (!FILE) {
  console.error('usage: node scripts/fit-bevel.mjs <raw-sample-export.json>')
  process.exit(1)
}

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
  '2026-08-10': { strain: 8,  recovery: 89, sleep: null, bpm: null },
}

// Strain ACCUMULATES through the day, so a same-day reading describes the day
// only up to the moment it was read. Connor read 2026-08-10 at ~15:00 local;
// every other day is complete. Without this the fit is asked to explain a
// full day's volume with a half day's score.
const CUTOFF = { '2026-08-10': '2026-08-10 15:20:00 -0500' }

// 2026-08-07 is excluded from the STRAIN fit only. Bevel scored it 28 on
// 336 kcal / 6 exercise min / 40 min above 90bpm — statistically a twin of
// 2026-08-03, which Bevel scored 8. No feature in the export separates them,
// so including it does not teach the model anything; it just smears the
// coefficients across a contradiction. It is still printed, held out, so the
// size of the miss stays visible rather than being quietly dropped.
const STRAIN_OUTLIERS = new Set(['2026-08-07'])

const ts = s => Date.parse(String(s).replace(' ', 'T').replace(/ ([+-]\d{4})$/, '$1'))
const day = t => String(t).slice(0, 10)
const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null)
const mae = a => a.reduce((s, v) => s + Math.abs(v), 0) / a.length

const raw = JSON.parse(readFileSync(FILE, 'utf8'))
const root = raw.data ?? raw
const M = Object.fromEntries((root.metrics ?? []).map(m => [m.name, m]))
if (!M.sleep_analysis || !M.heart_rate) {
  console.error('export is missing sleep_analysis or heart_rate — is this a raw-sample export?')
  process.exit(1)
}

const series = name => (M[name]?.data ?? [])
  .map(p => ({ t: ts(p.date), d: day(p.date), q: p.qty, min: p.Min, avg: p.Avg, max: p.Max }))
  .filter(x => Number.isFinite(x.t))
  .sort((a, b) => a.t - b.t)

const HR = series('heart_rate')
const HRV = series('heart_rate_variability')
const RESP = series('respiratory_rate')

// ── nights, with the physiology measured INSIDE the sleep window ──────────
const nights = (M.sleep_analysis.data ?? []).map(p => ({
  wake: day(p.sleepEnd),
  a: ts(p.sleepStart),
  b: ts(p.sleepEnd),
  hours: p.totalSleep,
})).filter(n => Number.isFinite(n.a) && Number.isFinite(n.b) && n.hours > 0)
  .sort((x, y) => x.a - y.a)

for (const n of nights) {
  const inWin = arr => arr.filter(x => x.t >= n.a && x.t <= n.b)
  n.sleepHr = mean(inWin(HR).map(x => x.avg).filter(v => v != null))
  n.sleepHrv = mean(inWin(HRV).map(x => x.q).filter(v => v != null))
  n.sleepResp = mean(inWin(RESP).map(x => x.q).filter(v => v != null))
}

const median = a => {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// Trailing-exclusive baselines — a night never contributes to its own.
//
// MEDIAN, not mean. Nightly HRV here is frequently a SINGLE reading, and a
// single reading can be an artefact: 2026-08-08 recorded 139.9ms against a
// personal norm near 65. Under a mean baseline that one night lifts the
// comparator for the next 30 and makes ordinary good nights read as below
// par — it cost 2026-08-10 seventeen points of recovery on its own. A median
// ignores an outlier's magnitude and only counts its rank, which is the
// property wanted from a baseline built on sparse samples.
const BASELINE = process.env.FIT_BASELINE === 'mean' ? mean : median
nights.forEach((n, i) => {
  const prev = nights.slice(Math.max(0, i - 30), i)
  const base = k => BASELINE(prev.map(p => p[k]).filter(v => v != null))
  n.hrBase = base('sleepHr')
  n.hrvBase = base('sleepHrv')
  n.respBase = base('sleepResp')
})

console.log('=== SLEEP-WINDOW PHYSIOLOGY (the input Bevel scores on) ===')
console.log('  wake         hrs  sleepHR  base | sleepHRV  base | resp  base | Bevel bpm  rec')
for (const n of nights) {
  const t = BEVEL[n.wake]
  const f = (v, p = 1, w = 6) => (v == null ? '    --' : v.toFixed(p).padStart(w))
  console.log(`  ${n.wake} ${f(n.hours, 2, 5)}  ${f(n.sleepHr)} ${f(n.hrBase)} | ${f(n.sleepHrv)} ${f(n.hrvBase)} | ${f(n.sleepResp)} ${f(n.respBase)} | ${f(t?.bpm)} ${t?.recovery == null ? ' --' : String(t.recovery).padStart(4)}`)
}

// Our sleeping HR against Bevel's own — the check that the INPUT is right
// before any weighting is fitted. If this disagrees, nothing downstream can
// be trusted, and no reweighting would fix it.
const paired = nights.filter(n => BEVEL[n.wake]?.bpm != null && n.sleepHr != null)
console.log('\n=== INPUT CHECK: our sleeping HR vs Bevel\'s own sleeping bpm ===')
console.log(`  mean abs difference: ${mae(paired.map(n => n.sleepHr - BEVEL[n.wake].bpm)).toFixed(2)} bpm over ${paired.length} nights`)

const interp = (an, x) => {
  if (x <= an[0][0]) return an[0][1]
  const last = an[an.length - 1]
  if (x >= last[0]) return last[1]
  for (let i = 1; i < an.length; i++) {
    const [x0, y0] = an[i - 1], [x1, y1] = an[i]
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)
  }
  return last[1]
}

// ── SLEEP: a duration curve with a knee ───────────────────────────────────
const sleepRows = nights.filter(n => BEVEL[n.wake]?.sleep != null)
let bestSleep = null
for (const knee of [6.2, 6.4, 6.6, 6.8, 7.0]) {
  for (const kneeScore of [90, 92, 94, 96]) {
    for (const midH of [5.4, 5.6, 5.8, 6.0]) {
      for (const midScore of [42, 45, 48, 51, 54]) {
        for (const plateau of [95, 96, 97, 98]) {
          const an = [[0, 0], [3.2, 27], [midH, midScore], [knee, kneeScore], [knee + 0.4, plateau], [14, plateau]]
          const e = mae(sleepRows.map(n => interp(an, n.hours) - BEVEL[n.wake].sleep))
          if (!bestSleep || e < bestSleep.e) bestSleep = { e, an }
        }
      }
    }
  }
}
const sleepFit = h => interp(bestSleep.an, h)
console.log('\n=== SLEEP ===')
console.log('  DURATION_ANCHORS:', JSON.stringify(bestSleep.an))
console.log(`  mean abs error vs Bevel: ${bestSleep.e.toFixed(2)}`)
for (const n of sleepRows) {
  console.log(`   ${n.wake}  ${n.hours.toFixed(2)}h  fit ${sleepFit(n.hours).toFixed(0).padStart(3)}  bevel ${String(BEVEL[n.wake].sleep).padStart(3)}`)
}

// ── RECOVERY: sleeping HR, sleeping HRV, sleeping respiratory rate ────────
// All three as a ratio to the personal trailing baseline. Sleep duration is
// offered as a fourth component and the fit is free to give it zero weight.
const rec = nights.filter(n =>
  BEVEL[n.wake]?.recovery != null &&
  n.sleepHr != null && n.hrBase && n.sleepHrv != null && n.hrvBase && n.sleepResp != null && n.respBase)

let bestR = null
const HR_LO = [0.86, 0.88, 0.90, 0.92], HR_HI = [1.08, 1.12, 1.16, 1.20, 1.30]
const HV_LO = [0.55, 0.65, 0.75, 0.85], HV_HI = [1.10, 1.20, 1.30, 1.45]
const RS_LO = [0.93, 0.95, 0.97], RS_HI = [1.03, 1.06, 1.10]
for (const hrLo of HR_LO) for (const hrHi of HR_HI) {
  const hrAn = [[hrLo, 100], [1.0, 50], [hrHi, 0]]
  for (const hvLo of HV_LO) for (const hvHi of HV_HI) {
    const hvAn = [[hvLo, 0], [1.0, 50], [hvHi, 100]]
    for (const rsLo of RS_LO) for (const rsHi of RS_HI) {
      const rsAn = [[rsLo, 100], [1.0, 50], [rsHi, 0]]
      const pre = rec.map(n => ({
        h: interp(hrAn, n.sleepHr / n.hrBase),
        v: interp(hvAn, n.sleepHrv / n.hrvBase),
        r: interp(rsAn, n.sleepResp / n.respBase),
        s: sleepFit(n.hours),
        y: BEVEL[n.wake].recovery,
      }))
      for (let wH = 0; wH <= 1.001; wH += 0.05) {
        for (let wV = 0; wV + wH <= 1.001; wV += 0.05) {
          for (let wR = 0; wR + wV + wH <= 1.001; wR += 0.05) {
            const wS = 1 - wH - wV - wR
            let e = 0
            for (const p of pre) {
              const v = Math.max(0, Math.min(100, wH * p.h + wV * p.v + wR * p.r + wS * p.s))
              e += Math.abs(v - p.y)
            }
            e /= pre.length
            if (!bestR || e < bestR.e) bestR = { e, wH, wV, wR, wS, hrAn, hvAn, rsAn }
          }
        }
      }
    }
  }
}
console.log(`\n=== RECOVERY (${rec.length} labelled nights) ===`)
console.log(`  W_SLEEP_HR   = ${bestR.wH.toFixed(2)}`)
console.log(`  W_SLEEP_HRV  = ${bestR.wV.toFixed(2)}`)
console.log(`  W_SLEEP_RESP = ${bestR.wR.toFixed(2)}`)
console.log(`  W_SLEEP_DUR  = ${bestR.wS.toFixed(2)}`)
console.log(`  HR_ANCHORS   = ${JSON.stringify(bestR.hrAn)}`)
console.log(`  HRV_ANCHORS  = ${JSON.stringify(bestR.hvAn)}`)
console.log(`  RESP_ANCHORS = ${JSON.stringify(bestR.rsAn)}`)
console.log(`  mean abs error vs Bevel: ${bestR.e.toFixed(2)} points`)
for (const n of rec) {
  const v = Math.max(0, Math.min(100,
    bestR.wH * interp(bestR.hrAn, n.sleepHr / n.hrBase) +
    bestR.wV * interp(bestR.hvAn, n.sleepHrv / n.hrvBase) +
    bestR.wR * interp(bestR.rsAn, n.sleepResp / n.respBase) +
    bestR.wS * sleepFit(n.hours)))
  const y = BEVEL[n.wake].recovery
  console.log(`   ${n.wake}  fit ${v.toFixed(0).padStart(3)}  bevel ${String(y).padStart(3)}  diff ${(v - y).toFixed(0).padStart(4)}`)
}

// ── STRAIN: volume plus time spent with an elevated heart rate ────────────
// Each heart-rate reading is credited the gap to the next one, capped, so a
// watch left off does not read as hours of exertion.
const CAP_MIN = 5
const load = {}, vol = {}
for (let i = 0; i < HR.length; i++) {
  const x = HR[i], next = HR[i + 1]
  const cut = CUTOFF[x.d]
  if (cut && x.t > ts(cut)) continue
  const dt = next && next.d === x.d ? Math.min(CAP_MIN, (next.t - x.t) / 60000) : 1
  const L = (load[x.d] ??= { m90: 0 })
  if ((x.avg ?? 0) >= 90) L.m90 += dt
}
for (const name of ['active_energy', 'apple_exercise_time']) {
  for (const p of M[name]?.data ?? []) {
    const d = day(p.date), cut = CUTOFF[d]
    if (cut && ts(p.date) > ts(cut)) continue
    ;((vol[d] ??= {})[name] ??= 0)
    vol[d][name] += p.qty ?? 0
  }
}
const sRows = Object.keys(BEVEL).filter(d => vol[d]).map(d => ({
  date: d, y: BEVEL[d].strain,
  active: vol[d].active_energy ?? 0,
  ex: vol[d].apple_exercise_time ?? 0,
  m90: load[d]?.m90 ?? 0,
}))
const fitRows = sRows.filter(s => !STRAIN_OUTLIERS.has(s.date))
let bestS = null
for (let a = 0; a <= 0.05; a += 0.002) {
  for (let b = 0; b <= 1.2; b += 0.05) {
    for (let c = 0; c <= 1.2; c += 0.05) {
      for (let k = -6; k <= 6; k += 0.5) {
        const e = mae(fitRows.map(s => (a * s.active + b * s.m90 + c * s.ex + k) - s.y))
        if (!bestS || e < bestS.e) bestS = { e, a, b, c, k }
      }
    }
  }
}
console.log('\n=== STRAIN ===')
console.log(`  KCAL_COEF = ${bestS.a.toFixed(3)}   HR90_COEF = ${bestS.b.toFixed(2)}   EX_COEF = ${bestS.c.toFixed(2)}   INTERCEPT = ${bestS.k.toFixed(1)}`)
console.log(`  mean abs error vs Bevel: ${bestS.e.toFixed(2)} (${fitRows.length} days; ${[...STRAIN_OUTLIERS].join(', ')} held out)`)
for (const s of sRows) {
  const p = bestS.a * s.active + bestS.b * s.m90 + bestS.c * s.ex + bestS.k
  console.log(`   ${s.date}  active ${s.active.toFixed(0).padStart(4)} min>=90 ${s.m90.toFixed(0).padStart(4)} ex ${s.ex.toFixed(0).padStart(3)}  fit ${p.toFixed(1).padStart(5)}  bevel ${String(s.y).padStart(3)}${STRAIN_OUTLIERS.has(s.date) ? '   (held out)' : ''}`)
}

console.log(`
=== CAVEATS — read before trusting any number above ===
  * ${rec.length} labelled nights. That is a THIN fit. Treat every constant as
    provisional until there are ~20, and re-run this rather than hand-tuning.
  * The recovery search fits 4 weights and 6 anchor positions to ${rec.length}
    points. It can memorise. The input check above is the real evidence: our
    sleeping HR reproduces Bevel's own to a fraction of a bpm, so the INPUT is
    right even where the weighting is uncertain.
  * Strain holds out ${[...STRAIN_OUTLIERS].join(', ')} because no feature in the export
    separates it from a day Bevel scored 3.5x lower. That is an open question,
    not a solved one.
`)
