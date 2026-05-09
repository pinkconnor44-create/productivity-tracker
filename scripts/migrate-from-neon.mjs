// One-shot migration: read all rows from Neon (Postgres) and write them to
// Turso (libSQL/SQLite) preserving primary keys.
//
// Run once after the schema has been pushed to Turso. Idempotent on re-run if
// the Turso DB is empty between runs (deleteMany at start clears it).
import 'dotenv/config'
import pg from 'pg'
import { createClient } from '@libsql/client'

// ── env ──────────────────────────────────────────────────────────────────
const NEON = process.env.NEON_DIRECT_URL || process.env.NEON_DATABASE_URL
const TURSO_URL = process.env.TURSO_DATABASE_URL
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN
if (!NEON) { console.error('NEON_DIRECT_URL or NEON_DATABASE_URL not set'); process.exit(1) }
if (!TURSO_URL || !TURSO_TOKEN) { console.error('TURSO_* not set'); process.exit(1) }

// ── clients ──────────────────────────────────────────────────────────────
const pool = new pg.Pool({ connectionString: NEON, ssl: { rejectUnauthorized: false } })
const turso = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN })

// ── helpers ──────────────────────────────────────────────────────────────
async function pgRows(table) {
  const res = await pool.query(`SELECT * FROM "${table}"`)
  return res.rows
}

function toLibsqlValue(v) {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'object') return JSON.stringify(v)
  return v
}

async function copyTable(table, columns) {
  console.log(`\n=== ${table} ===`)
  await turso.execute(`DELETE FROM "${table}"`)

  const rows = await pgRows(table)
  console.log(`  rows: ${rows.length}`)
  if (rows.length === 0) return

  const placeholders = columns.map(() => '?').join(', ')
  const colList = columns.map(c => `"${c}"`).join(', ')
  const sql = `INSERT INTO "${table}" (${colList}) VALUES (${placeholders})`

  let inserted = 0
  for (const row of rows) {
    const args = columns.map(c => toLibsqlValue(row[c]))
    try {
      await turso.execute({ sql, args })
      inserted++
    } catch (err) {
      console.error(`  failed row ${row.id}:`, err.message)
      throw err
    }
  }
  console.log(`  inserted: ${inserted}`)
}

// Order matters: parents before children (foreign-key constraints)
const PLAN = [
  ['Task',             ['id','title','description','dueDate','time','endTime','completed','completedAt','recurringType','recurringDays','recurringEnd','weight','kind','active','deletedAt','createdAt']],
  ['TaskCompletion',   ['id','taskId','date']],
  ['TaskSkip',         ['id','taskId','date']],
  ['Habit',            ['id','name','description','active','recurringDays','weight','startDate','createdAt']],
  ['HabitCompletion',  ['id','habitId','date']],
  ['HabitSkip',        ['id','habitId','date']],
  ['Scratchpad',       ['id','notes','checklist','updatedAt']],
  ['DayNote',          ['id','date','content','updatedAt']],
  ['LiftEntry',        ['id','date','name','weight','sets','totalReps','createdAt']],
  ['LiftGroup',        ['id','name','exercises','order','createdAt']],
  ['Project',          ['id','title','notes','checklist','order','createdAt','updatedAt']],
  ['WeeklyReview',     ['id','weekStart','wins','lessons','focus','updatedAt']],
]

async function main() {
  // Sanity: ping both
  const pgVer = await pool.query('SELECT current_database()')
  console.log(`Neon DB:   ${pgVer.rows[0].current_database}`)
  const tursoCount = await turso.execute('SELECT COUNT(*) AS n FROM Task')
  console.log(`Turso reachable. Pre-existing tasks: ${tursoCount.rows[0].n}`)

  for (const [table, columns] of PLAN) {
    await copyTable(table, columns)
  }

  // Reseed sqlite_sequence so future inserts continue past max id
  for (const [table] of PLAN) {
    const r = await turso.execute(`SELECT MAX(id) AS m FROM "${table}"`)
    const max = r.rows[0]?.m ?? 0
    if (max && max > 0) {
      // sqlite_sequence may not have a row yet; INSERT OR REPLACE
      await turso.execute({
        sql: `INSERT OR REPLACE INTO sqlite_sequence(name, seq) VALUES (?, ?)`,
        args: [table, max],
      })
    }
  }

  console.log('\nMigration complete.')
  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })
