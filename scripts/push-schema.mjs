// Pushes prisma/schema.sql to Turso. Idempotent-ish: assumes the target DB
// is empty or that the schema hasn't changed. For schema changes after the
// initial setup, generate a diff with `prisma migrate diff --from-... --to-...`
// and execute that instead.
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { createClient } from '@libsql/client'

const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN
if (!url || !authToken) {
  console.error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN')
  process.exit(1)
}

const sql = readFileSync('prisma/schema.sql', 'utf8')
// Strip leading comment-only lines from each statement, then split.
// Each Prisma-generated chunk is preceded by a `-- CreateTable`/`-- CreateIndex` line
// which libSQL's `execute` doesn't accept alongside DDL.
function stripLeadingComments(s) {
  return s.replace(/^(\s*--[^\n]*\n)+/g, '').trim()
}
const stmts = sql
  .split(/;\s*\n/)
  .map(stripLeadingComments)
  .filter(s => s.length > 0)
  .map(s => s + ';')

const client = createClient({ url, authToken })
let applied = 0, skipped = 0
for (const stmt of stmts) {
  try {
    await client.execute(stmt)
    applied++
  } catch (err) {
    const msg = err?.message || String(err)
    if (msg.includes('already exists')) {
      skipped++
    } else {
      console.error('Failed:', stmt.slice(0, 80))
      console.error('Error:', msg)
      process.exit(1)
    }
  }
}
console.log(`Applied ${applied}, skipped ${skipped} (already existed)`)
