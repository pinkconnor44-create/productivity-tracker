// Verification harness for Phases 2–3: exercises POST /api/health-import and
// GET /api/health against a running server, and asserts the properties the
// plan calls for — auth, idempotency, skip-don't-fail, and scores that come
// back in range.
//
//   node scripts/test-health-import.mjs [baseUrl]
//
// Defaults to http://localhost:3000. Reads HEALTH_IMPORT_KEY from .env.
// Writes fixture rows for 2019-03-05/06; scripts/wipe-health-fixtures.mjs
// removes everything again.
import 'dotenv/config'
import { readFileSync } from 'node:fs'

const base = process.argv[2] ?? 'http://localhost:3000'
const key = process.env.HEALTH_IMPORT_KEY
if (!key) { console.error('HEALTH_IMPORT_KEY not set in .env'); process.exit(1) }

const payload = JSON.parse(readFileSync('scripts/health-fixtures/hae-sample.json', 'utf8'))

let failures = 0
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

async function post(body, apiKey = key) {
  const res = await fetch(`${base}/api/health-import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  let json = null
  try { json = await res.json() } catch {}
  return { status: res.status, json }
}

// 1 — wrong key is rejected before anything is parsed
const bad = await post(payload, 'definitely-not-the-key')
check('wrong key → 401', bad.status === 401, `got ${bad.status}`)

// 2 — valid import returns counts and skips the two malformed points
const first = await post(payload)
check('valid import → 200', first.status === 200, `got ${first.status}`)
check('metrics written', first.json?.metrics === 13, `got ${first.json?.metrics}`)
check('sleep nights written', first.json?.sleep === 2, `got ${first.json?.sleep}`)
check('workouts written', first.json?.workouts === 2, `got ${first.json?.workouts}`)
check('malformed points skipped, not fatal', first.json?.skipped === 2, `got ${first.json?.skipped}`)

// 3 — re-POST is a no-op: same counts, and the row totals must not grow
const before = await fetch(`${base}/api/health-import`, { headers: { 'X-Api-Key': key } }).then(r => r.json())
const second = await post(payload)
const after = await fetch(`${base}/api/health-import`, { headers: { 'X-Api-Key': key } }).then(r => r.json())
check('re-POST → 200', second.status === 200, `got ${second.status}`)
check(
  'idempotent: row counts unchanged',
  JSON.stringify(before.rows) === JSON.stringify(after.rows),
  `${JSON.stringify(before.rows)} → ${JSON.stringify(after.rows)}`
)

// 4 — garbage must not 500
const garbage = await post({ hello: 'world' })
check('garbage payload → 200, nothing written', garbage.status === 200 && garbage.json?.metrics === 0, `got ${garbage.status}`)
const notJson = await post('{ this is not json')
check('malformed JSON → 400', notJson.status === 400, `got ${notJson.status}`)

// 5 — read API returns the days with scores in range
const read = await fetch(`${base}/api/health?start=2019-03-01&end=2019-03-07`).then(r => r.json())
check('read API returns days', Array.isArray(read.days) && read.days.length === 7, `got ${read.days?.length}`)
const d6 = read.days?.find(d => d.date === '2019-03-06')
check('2019-03-06 has sleep', d6?.sleep?.asleepMin != null, `asleepMin=${d6?.sleep?.asleepMin}`)
// The real-export shape: asleep===0 with totalSleep carrying the value. A
// first-non-null pick returns the 0 and the night reads as zero hours slept.
check('2019-03-06 sleep minutes converted from hours', Math.round(d6?.sleep?.asleepMin) === 353, `got ${d6?.sleep?.asleepMin}`)
check('asleep:0 does not beat totalSleep', d6?.sleep?.asleepMin > 0, `got ${d6?.sleep?.asleepMin}`)
check('inBed:0 stored as null, not zero', d6?.sleep?.inBedMin === null, `got ${d6?.sleep?.inBedMin}`)
// apple_stand_hour and apple_stand_time must not collide on one UI key.
check('stand hours reads the hour count, not the minutes', d6?.metrics?.standHours === 11, `got ${d6?.metrics?.standHours}`)
check('stand minutes kept separately in extra', d6?.extra?.apple_stand_time === 64, `got ${d6?.extra?.apple_stand_time}`)
check('sleep score in range', d6?.scores?.sleep > 0 && d6?.scores?.sleep <= 100, `got ${d6?.scores?.sleep}`)
check('hrv mapped', d6?.metrics?.hrv === 64.1, `got ${d6?.metrics?.hrv}`)
check('steps mapped', d6?.metrics?.steps === 11402, `got ${d6?.metrics?.steps}`)
check('unknown metric kept in extra', d6?.extra?.environmental_audio_exposure === 62.5, `got ${d6?.extra?.environmental_audio_exposure}`)
check('workouts attached to the day', d6?.workouts?.length === 1, `got ${d6?.workouts?.length}`)
check('workout duration from timestamps (min)', Math.round(d6?.workouts?.[0]?.durationMin) === 67, `got ${d6?.workouts?.[0]?.durationMin}`)
const d5 = read.days?.find(d => d.date === '2019-03-05')
check('miles converted to km', Math.abs(d5?.workouts?.[0]?.distanceKm - 3.862) < 0.01, `got ${d5?.workouts?.[0]?.distanceKm}`)
// Recovery is scored on physiology measured INSIDE the sleep window, so a
// night with no heart-rate readings in it cannot be scored and must come back
// null. This fixture has sleep but no sub-daily readings, which is exactly
// that case.
//
// The previous assertion here was "a day with sleep always scores", and it was
// asserting the bug: recovery used to fold in whole-day HRV and the day's
// lowest heart rate, both of which keep moving after you wake up, which is why
// the score sank through every afternoon. Null is the correct answer for a
// night we have no sleep-window readings for — the same rule as everywhere
// else in this file, that a missing input is null and never zero.
const rec = d5?.scores?.recovery
check('recovery is null without sleep-window readings', rec === null, `got ${rec}`)
check('sleep still scores without sleep-window readings', typeof d5?.scores?.sleep === 'number', `got ${d5?.scores?.sleep}`)
check('no sleep window reported when nothing was recorded in it', d5?.sleepWindow === null, `got ${JSON.stringify(d5?.sleepWindow)}`)

// ── the partial-window regressions ────────────────────────────────────────
// These two are the whole reason this session existed. HAE's "Since Last Sync"
// export period sends only what was recorded since the last run but still
// labels it with the DAY, so an hourly automation posted an hour of steps as
// if it were the day's total, and a sleep fragment as if it were the night.
const DAY = '2019-03-06'
const partial = {
  data: {
    metrics: [
      { name: 'step_count', units: 'count', data: [{ date: `${DAY} 00:00:00 -0500`, qty: 15 }] },
      { name: 'sleep_analysis', units: 'hr', data: [{
        sleepStart: `${DAY} 06:47:04 -0500`, sleepEnd: `${DAY} 08:02:33 -0500`,
        totalSleep: 1.2, core: 1.0, deep: 0, rem: 0.2, awake: 0.1, asleep: 0,
      }] },
    ],
  },
}
await post(partial)
const afterPartial = await (await fetch(`${base}/api/health?start=2019-03-01&end=2019-03-10`)).json()
const d6b = afterPartial.days?.find(d => d.date === DAY)
check('a partial window cannot shrink a day\'s step total',
  d6b?.metrics?.steps === 11402, `got ${d6b?.metrics?.steps}`)
check('a sleep fragment cannot replace a longer night',
  d6b?.sleep?.asleepMin > 100, `got ${d6b?.sleep?.asleepMin}`)

// ── sub-daily readings roll up into the day ───────────────────────────────
// A raw-sample export sends many readings per day instead of one total. They
// must sum, not overwrite each other — the old parser kept whichever point
// happened to be read last.
const ROLL = '2019-03-08'
await post({
  data: {
    metrics: [
      { name: 'step_count', units: 'count', data: [
        { date: `${ROLL} 08:15:00 -0500`, qty: 100 },
        { date: `${ROLL} 09:15:00 -0500`, qty: 250 },
        { date: `${ROLL} 10:15:00 -0500`, qty: 60 },
      ] },
      { name: 'heart_rate', units: 'count/min', data: [
        { date: `${ROLL} 08:15:00 -0500`, Min: 50, Avg: 55, Max: 60, source: 'Watch' },
        { date: `${ROLL} 09:15:00 -0500`, Min: 70, Avg: 95, Max: 130, source: 'Watch' },
      ] },
    ],
  },
})
const rolled = await (await fetch(`${base}/api/health?start=2019-03-01&end=2019-03-10`)).json()
const dr = rolled.days?.find(d => d.date === ROLL)
check('sub-daily totals SUM into the day', dr?.metrics?.steps === 410, `got ${dr?.metrics?.steps}`)
check('sub-daily vitals AVERAGE into the day', dr?.metrics?.hr === 75, `got ${dr?.metrics?.hr}`)
check('elevated-HR minutes derived from samples', typeof dr?.elevatedMin === 'number', `got ${dr?.elevatedMin}`)

// ── hour-grouped exports keep their midnight bucket ───────────────────────
// HAE's "time grouping: hour" stamps the 00:00–01:00 bucket with exactly the
// same `00:00:00` a whole-day aggregate carries. Classifying on midnight
// alone read that hour as the entire day and dropped it from the roll-up —
// losing the midnight hour every single day, silently. A point is a day total
// only if it is midnight-stamped AND the only point for that metric that day.
const HOUR = '2019-03-09'
await post({
  data: {
    metrics: [
      { name: 'step_count', units: 'count', data: [
        { date: `${HOUR} 00:00:00 -0500`, qty: 7 },
        { date: `${HOUR} 01:00:00 -0500`, qty: 11 },
        { date: `${HOUR} 02:00:00 -0500`, qty: 22 },
      ] },
    ],
  },
})
const hourly = await (await fetch(`${base}/api/health?start=2019-03-01&end=2019-03-10`)).json()
const dh = hourly.days?.find(d => d.date === HOUR)
check('hour-grouped: midnight bucket counted, not mistaken for the day',
  dh?.metrics?.steps === 40, `got ${dh?.metrics?.steps}`)

// The complementary case must still work: a genuine aggregated export sends
// exactly one midnight-stamped point per day, and that IS the day's total.
const AGG = '2019-03-10'
await post({ data: { metrics: [
  { name: 'step_count', units: 'count', data: [{ date: `${AGG} 00:00:00 -0500`, qty: 8123 }] },
] } })
const agg = await (await fetch(`${base}/api/health?start=2019-03-01&end=2019-03-10`)).json()
check('aggregated export: lone midnight point is the day total',
  agg.days?.find(d => d.date === AGG)?.metrics?.steps === 8123,
  `got ${agg.days?.find(d => d.date === AGG)?.metrics?.steps}`)

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
