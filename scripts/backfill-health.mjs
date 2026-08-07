// Historical backfill for the health tables.
//
//   node scripts/backfill-health.mjs <export.json> [baseUrl]
//
// Reads a Health Auto Export file (the "Export Now" output, one per month is
// the easiest granularity) and POSTs it to /api/health-import in chunks.
//
// It deliberately uses the same endpoint as the live automation rather than
// writing to the database directly: one parser, one set of assumptions, one
// thing to fix if the timezone handling turns out to be wrong. The endpoint is
// idempotent, so this script is safe to re-run — on a failure, just run it
// again rather than working out where it stopped.
import 'dotenv/config'
import { readFileSync } from 'node:fs'

const [file, base = 'https://productivity-tracker-murex.vercel.app'] = process.argv.slice(2)
if (!file) {
  console.error('usage: node scripts/backfill-health.mjs <export.json> [baseUrl]')
  process.exit(1)
}
const key = process.env.HEALTH_IMPORT_KEY
if (!key) { console.error('HEALTH_IMPORT_KEY not set in .env'); process.exit(1) }

const payload = JSON.parse(readFileSync(file, 'utf8'))
const root = payload.data ?? payload
const metrics = Array.isArray(root.metrics) ? root.metrics : []
const workouts = Array.isArray(root.workouts) ? root.workouts : []

// Chunk by day rather than by byte count: a chunk must never split one day's
// readings across two requests, or a partially-applied batch would leave that
// day looking complete when it isn't.
const days = new Set()
for (const m of metrics) for (const p of m.data ?? []) if (typeof p.date === 'string') days.add(p.date.slice(0, 10))
for (const w of workouts) {
  const d = (w.start ?? w.date ?? '').slice(0, 10)
  if (d) days.add(d)
}
const allDays = [...days].sort()
console.log(`${allDays.length} day(s) in ${file}: ${allDays[0] ?? '—'} → ${allDays[allDays.length - 1] ?? '—'}`)

const DAYS_PER_CHUNK = 7
const chunks = []
for (let i = 0; i < allDays.length; i += DAYS_PER_CHUNK) {
  const window = new Set(allDays.slice(i, i + DAYS_PER_CHUNK))
  chunks.push({
    data: {
      metrics: metrics
        .map(m => ({ ...m, data: (m.data ?? []).filter(p => window.has(String(p.date).slice(0, 10))) }))
        .filter(m => m.data.length > 0),
      workouts: workouts.filter(w => window.has(String(w.start ?? w.date ?? '').slice(0, 10))),
    },
  })
}

let totals = { metrics: 0, sleep: 0, workouts: 0, skipped: 0 }
for (const [i, chunk] of chunks.entries()) {
  const res = await fetch(`${base}/api/health-import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': key },
    body: JSON.stringify(chunk),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error(`chunk ${i + 1}/${chunks.length} failed: ${res.status}`, json)
    console.error('Re-run the script — completed chunks are upserts and will not duplicate.')
    process.exit(1)
  }
  totals = {
    metrics: totals.metrics + (json.metrics ?? 0),
    sleep: totals.sleep + (json.sleep ?? 0),
    workouts: totals.workouts + (json.workouts ?? 0),
    skipped: totals.skipped + (json.skipped ?? 0),
  }
  console.log(`chunk ${i + 1}/${chunks.length} → ${json.metrics} metrics, ${json.sleep} sleep, ${json.workouts} workouts`)
  if (json.warnings?.length) console.log('  warnings:', json.warnings.join('; '))
}

console.log('\nDone:', totals)
if (totals.skipped > 0) {
  console.log(`${totals.skipped} point(s) skipped — usually points with no date or no value.`)
}
