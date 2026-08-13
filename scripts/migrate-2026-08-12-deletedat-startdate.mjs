// Hand-written migration, run 2026-08-12 (work orders 08 + 24).
// `db:push` only emits CREATE TABLE (its diff is --from-empty), so new
// COLUMNS are added here explicitly. Approved by Connor to run against the
// live shared Turso DB, including the deletedAt backfill.
//
//   node scripts/migrate-2026-08-12-deletedat-startdate.mjs [--apply]
//
// Without --apply: dry run — prints what would change.
//
// Backfill rule for already-deleted habits (their true deletion date was
// never recorded): deletedAt = the day AFTER their last completion, so their
// history counts through their last active day; a deleted habit with no
// completions falls back to its startDate (or createdAt's day — an ISO TEXT
// string in this DB, so substr(...,1,10), NOT unixepoch maths), i.e. it
// contributes nothing. RUN 2026-08-12: columns added, 12 habits backfilled.
import 'dotenv/config'
import { createClient } from '@libsql/client'

const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN
if (!url || !authToken) { console.error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN'); process.exit(1) }
const db = createClient({ url, authToken })
const apply = process.argv.includes('--apply')

async function hasColumn(table, col) {
  const r = await db.execute(`PRAGMA table_info("${table}")`)
  return r.rows.some(row => row.name === col)
}

// 1 — columns
for (const [table, col] of [['Habit', 'deletedAt'], ['Task', 'startDate']]) {
  if (await hasColumn(table, col)) {
    console.log(`${table}.${col}: already exists — skipped`)
  } else if (apply) {
    await db.execute(`ALTER TABLE "${table}" ADD COLUMN "${col}" TEXT`)
    console.log(`${table}.${col}: ADDED`)
  } else {
    console.log(`${table}.${col}: would ADD (TEXT, nullable)`)
  }
}

// 2 — backfill deletedAt for already-soft-deleted habits
const preview = await db.execute(`
  SELECT h.id, h.name, h.active,
         (SELECT COUNT(*) FROM "HabitCompletion" c WHERE c."habitId" = h.id) AS completions,
         (SELECT date(MAX(c.date), '+1 day') FROM "HabitCompletion" c WHERE c."habitId" = h.id) AS lastPlus1,
         h."startDate" AS startDate
  FROM "Habit" h WHERE h.active = 0
`)
console.log(`\nSoft-deleted habits: ${preview.rows.length}`)
for (const r of preview.rows) {
  console.log(`  #${r.id} "${r.name}" — ${r.completions} completions → deletedAt ${r.lastPlus1 ?? r.startDate ?? '(createdAt day)'}`)
}

if (apply) {
  const res = await db.execute(`
    UPDATE "Habit" SET "deletedAt" = COALESCE(
      (SELECT date(MAX(c.date), '+1 day') FROM "HabitCompletion" c WHERE c."habitId" = "Habit".id),
      "startDate",
      substr("createdAt", 1, 10)
    )
    WHERE active = 0 AND "deletedAt" IS NULL
  `)
  console.log(`\nBackfilled deletedAt on ${res.rowsAffected} habits`)
  const check = await db.execute(`SELECT id, name, "deletedAt" FROM "Habit" WHERE active = 0`)
  for (const r of check.rows) console.log(`  #${r.id} "${r.name}" deletedAt=${r.deletedAt}`)
} else {
  console.log('\nDry run — re-run with --apply to execute.')
}
