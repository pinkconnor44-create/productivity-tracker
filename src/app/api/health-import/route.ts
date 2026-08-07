import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { parseHealthPayload } from '@/lib/health-import'

// POST /api/health-import — the only authenticated endpoint in the app.
//
// Health Auto Export on Connor's phone POSTs here on a schedule, and the same
// endpoint takes the historical backfill (scripts/backfill-health.mjs), so
// there is exactly one code path to trust. HAE re-sends overlapping windows by
// design, so every write is an upsert and re-POSTing a payload is a no-op.
//
// No middleware: this app has none, and a self-contained check keeps the auth
// visible at the thing it protects.

export const maxDuration = 60

// Writes are chunked so one oversized backfill month can't blow the statement
// limit or the function timeout.
const CHUNK = 50

function keyMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  // timingSafeEqual throws on length mismatch, which would itself leak length.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  const expected = process.env.HEALTH_IMPORT_KEY
  // Fail closed. An unset key must not mean "open endpoint" — that is how a
  // misconfigured preview deploy turns into a public write endpoint.
  if (!expected) {
    console.error('[/api/health-import] HEALTH_IMPORT_KEY is not set')
    return NextResponse.json({ error: 'import not configured' }, { status: 500 })
  }
  const provided = req.headers.get('x-api-key') ?? ''
  if (!keyMatches(provided, expected)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const parsed = parseHealthPayload(body)

  try {
    let metrics = 0, sleep = 0, workouts = 0

    // Same-payload duplicates (HAE can repeat a day inside one export) would
    // collide inside a transaction; last write wins, so de-dupe up front.
    const byKey = new Map<string, (typeof parsed.metrics)[number]>()
    for (const m of parsed.metrics) byKey.set(`${m.date}|${m.metric}`, m)
    const uniqueMetrics = [...byKey.values()]

    for (let i = 0; i < uniqueMetrics.length; i += CHUNK) {
      const slice = uniqueMetrics.slice(i, i + CHUNK)
      await prisma.$transaction(
        slice.map(m => prisma.healthMetricDaily.upsert({
          where: { date_metric: { date: m.date, metric: m.metric } },
          create: m,
          update: { qty: m.qty, min: m.min, avg: m.avg, max: m.max, units: m.units },
        }))
      )
      metrics += slice.length
    }

    const bySleepDay = new Map<string, (typeof parsed.sleep)[number]>()
    for (const s of parsed.sleep) bySleepDay.set(s.date, s)
    const uniqueSleep = [...bySleepDay.values()]

    for (let i = 0; i < uniqueSleep.length; i += CHUNK) {
      const slice = uniqueSleep.slice(i, i + CHUNK)
      await prisma.$transaction(
        slice.map(s => prisma.sleepSession.upsert({
          where: { date: s.date },
          create: s,
          update: s,
        }))
      )
      sleep += slice.length
    }

    const byWorkoutId = new Map<string, (typeof parsed.workouts)[number]>()
    for (const w of parsed.workouts) byWorkoutId.set(w.externalId, w)
    const uniqueWorkouts = [...byWorkoutId.values()]

    for (let i = 0; i < uniqueWorkouts.length; i += CHUNK) {
      const slice = uniqueWorkouts.slice(i, i + CHUNK)
      await prisma.$transaction(
        slice.map(w => prisma.healthWorkout.upsert({
          where: { externalId: w.externalId },
          create: w,
          update: w,
        }))
      )
      workouts += slice.length
    }

    return NextResponse.json({
      ok: true,
      metrics,
      sleep,
      workouts,
      skipped: parsed.skipped,
      warnings: parsed.warnings,
    })
  } catch (e) {
    console.error('[/api/health-import]', e)
    return NextResponse.json({ error: 'import failed' }, { status: 500 })
  }
}

// A GET is handy for confirming from the phone that the URL and key are right
// before the first real export runs. Returns counts only — never data.
export async function GET(req: NextRequest) {
  const expected = process.env.HEALTH_IMPORT_KEY
  if (!expected) return NextResponse.json({ error: 'import not configured' }, { status: 500 })
  if (!keyMatches(req.headers.get('x-api-key') ?? '', expected)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const [metrics, sleep, workouts] = await Promise.all([
      prisma.healthMetricDaily.count(),
      prisma.sleepSession.count(),
      prisma.healthWorkout.count(),
    ])
    return NextResponse.json({ ok: true, rows: { metrics, sleep, workouts } })
  } catch (e) {
    console.error('[/api/health-import GET]', e)
    return NextResponse.json({ error: 'count failed' }, { status: 500 })
  }
}
