// Empties the three health tables. Run this before the first real backfill —
// preview and prod share one Turso database, so demo rows from
// seed-health-fixtures.mjs would otherwise contaminate the trailing baselines
// that every score is computed against.
//
//   node scripts/wipe-health-fixtures.mjs --yes
//
// Touches ONLY the health tables. Tasks, habits, lifts, notes, projects and
// scores are never referenced here.
import 'dotenv/config'
import { createClient } from '@libsql/client'

const TABLES = ['HealthMetricDaily', 'SleepSession', 'HealthWorkout']

const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN
if (!url || !authToken) { console.error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN'); process.exit(1) }

const client = createClient({ url, authToken })

const counts = {}
for (const t of TABLES) {
  const r = await client.execute(`SELECT COUNT(*) AS n FROM "${t}"`)
  counts[t] = Number(r.rows[0].n)
}
console.log('Current rows:', counts)

if (!process.argv.includes('--yes')) {
  console.log('\nDry run. Re-run with --yes to delete these rows.')
  process.exit(0)
}

for (const t of TABLES) {
  await client.execute(`DELETE FROM "${t}"`)
  console.log(`cleared ${t} (${counts[t]} rows)`)
}
console.log('\nHealth tables are empty. Tables themselves are intact — a full DB rollback is DROP TABLE on these three.')
