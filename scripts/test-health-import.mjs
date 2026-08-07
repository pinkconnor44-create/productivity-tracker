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
// Deliberately NOT asserting "recovery === sleep on day 1". That holds only
// against an empty database; as soon as any prior days exist the day has real
// HRV/RHR baselines and recovery correctly stops being sleep-only. Assert the
// state-independent invariant instead: a day with sleep always scores, and
// always inside the range.
const rec = d5?.scores?.recovery
check('recovery scores whenever sleep exists', typeof rec === 'number' && rec > 0 && rec <= 100, `got ${rec}`)

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
