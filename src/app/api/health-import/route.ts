import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { parseHealthPayload } from '@/lib/health-import'
import { HEALTH_CONSTANTS } from '@/lib/health'

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
  // Both sides are trimmed. A secret set through a shell pipe, pasted into the
  // Vercel dashboard, or typed into a phone keyboard picks up trailing
  // whitespace or a newline with depressing regularity — and the failure mode
  // is a 401 that looks exactly like a wrong key, on a background automation
  // nobody is watching. Surrounding whitespace is never meaningful in an API
  // key, so refusing to tolerate it buys no security and costs real debugging.
  const a = Buffer.from(provided.trim())
  const b = Buffer.from(expected.trim())
  // timingSafeEqual throws on length mismatch, which would itself leak length.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** What the request looked like, with nothing secret in it.
 *
 *  The key itself is never logged — only whether a header arrived and how long
 *  it was after trimming, which is what actually separates "nothing was sent",
 *  "the wrong key was sent" and "the right key arrived with a stray newline".
 *  The user agent is the most useful field of all: it settles whether the
 *  request came from Health Auto Export or from something else entirely. */
function describe(req: NextRequest): string {
  const key = (req.headers.get('x-api-key') ?? '').trim()
  const ua = (req.headers.get('user-agent') ?? 'none').slice(0, 120)
  return `key ${key ? `${key.length} chars` : 'absent'}; ua ${ua}`
}

/** Who sent this request, in one word.
 *
 *  Health Auto Export identifies itself as "Auto Export/<build>"; the backfill
 *  script runs under node. Recorded on every row, success included, because
 *  "did the automation fire on its own, or was that me pressing Export?" is
 *  otherwise unanswerable — both write a successful row and the rows are
 *  identical. Knowing the automation ran unattended is the only way to tell a
 *  working schedule from a habit of triggering it by hand. */
function sourceOf(req: NextRequest): string {
  const ua = (req.headers.get('user-agent') ?? '').toLowerCase()
  if (ua.includes('auto%20export') || ua.includes('auto export') || ua.includes('autoexport')) return 'phone'
  if (ua.includes('node') || ua.includes('undici')) return 'backfill'
  return 'other'
}

export async function POST(req: NextRequest) {
  const expected = process.env.HEALTH_IMPORT_KEY
  // Fail closed. An unset key must not mean "open endpoint" — that is how a
  // misconfigured preview deploy turns into a public write endpoint.
  if (!expected) {
    console.error('[/api/health-import] HEALTH_IMPORT_KEY is not set')
    await recordRejection(`not configured — HEALTH_IMPORT_KEY unset; ${describe(req)}`, sourceOf(req))
    return NextResponse.json({ error: 'import not configured' }, { status: 500 })
  }
  const provided = req.headers.get('x-api-key') ?? ''
  if (!keyMatches(provided, expected)) {
    // Logged, not silent. An empty import log used to mean BOTH "no request
    // ever arrived" and "requests arrived and were turned away at the door" —
    // opposite diagnoses with opposite fixes, and the second was invisible in
    // the app, so every investigation had to go to Vercel's runtime logs. The
    // Bevel status line now answers it directly.
    await recordRejection(`unauthorized — ${describe(req)}`, sourceOf(req))
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    await recordRejection(`invalid JSON — ${describe(req)}`, sourceOf(req))
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const parsed = parseHealthPayload(body)
  // Repairs need to be able to move a value DOWN; the hourly automation must
  // not. See mergeDaily for why the automation is otherwise clamped upward.
  const replace = (req.headers.get('x-import-mode') ?? '').trim().toLowerCase() === 'replace'

  try {
    let metrics = 0, sleep = 0, workouts = 0, samples = 0

    // Same-payload duplicates (HAE can repeat a day inside one export) would
    // collide inside a transaction; last write wins, so de-dupe up front.
    const byKey = new Map<string, (typeof parsed.metrics)[number]>()
    for (const m of parsed.metrics) byKey.set(`${m.date}|${m.metric}`, m)
    const uniqueMetrics = [...byKey.values()]

    // Existing rows for exactly the days being written, so the guard below
    // compares against what is already stored rather than assuming.
    const existing = new Map<string, { qty: number | null }>()
    if (uniqueMetrics.length > 0 && !replace) {
      const days = [...new Set(uniqueMetrics.map(m => m.date))]
      const rows = await prisma.healthMetricDaily.findMany({
        where: { date: { in: days } },
        select: { date: true, metric: true, qty: true },
      })
      for (const r of rows) existing.set(`${r.date}|${r.metric}`, { qty: r.qty })
    }

    for (let i = 0; i < uniqueMetrics.length; i += CHUNK) {
      const slice = uniqueMetrics.slice(i, i + CHUNK)
      await prisma.$transaction(
        slice.map(m => {
          const prev = existing.get(`${m.date}|${m.metric}`)
          return prisma.healthMetricDaily.upsert({
            where: { date_metric: { date: m.date, metric: m.metric } },
            create: m,
            update: { ...mergeDaily(prev, m, replace), units: m.units },
          })
        })
      )
      metrics += slice.length
    }

    // Samples are immutable readings keyed on (metric, start, source), so a
    // re-send is a no-op rather than an update. HAE re-sends the whole day
    // every hour, so the overwhelmingly common case is "all of these already
    // exist" — hence: read the keys we already hold for these days, drop the
    // ones already stored, and bulk-insert only what is new.
    //
    // Not createMany({skipDuplicates}) — SQLite does not support it, and not
    // one upsert per reading either: a day carries several hundred heart-rate
    // readings and an hourly automation would re-upsert all of them forever.
    const bySample = new Map<string, (typeof parsed.samples)[number]>()
    for (const s of parsed.samples) bySample.set(`${s.metric}|${s.start}|${s.source}`, s)
    const uniqueSamples = [...bySample.values()]
    if (uniqueSamples.length > 0) {
      const sampleDays = [...new Set(uniqueSamples.map(s => s.date))]
      const held = await prisma.healthSample.findMany({
        where: { date: { in: sampleDays } },
        select: { metric: true, start: true, source: true },
      })
      const seen = new Set(held.map(h => `${h.metric}|${h.start}|${h.source}`))
      const fresh = uniqueSamples.filter(s => !seen.has(`${s.metric}|${s.start}|${s.source}`))
      const SAMPLE_CHUNK = 500
      for (let i = 0; i < fresh.length; i += SAMPLE_CHUNK) {
        const r = await prisma.healthSample.createMany({ data: fresh.slice(i, i + SAMPLE_CHUNK) })
        samples += r.count
      }
    }

    const bySleepDay = new Map<string, (typeof parsed.sleep)[number]>()
    for (const s of parsed.sleep) bySleepDay.set(s.date, s)
    const uniqueSleep = [...bySleepDay.values()]

    const priorSleep = new Map<string, { asleepMin: number | null }>()
    if (uniqueSleep.length > 0 && !replace) {
      const rows = await prisma.sleepSession.findMany({
        where: { date: { in: uniqueSleep.map(s => s.date) } },
        select: { date: true, asleepMin: true },
      })
      for (const r of rows) priorSleep.set(r.date, { asleepMin: r.asleepMin })
    }

    for (let i = 0; i < uniqueSleep.length; i += CHUNK) {
      const slice = uniqueSleep.slice(i, i + CHUNK)
      const writes = slice.filter(s => keepsNight(priorSleep.get(s.date), s, replace))
      if (writes.length > 0) {
        await prisma.$transaction(
          writes.map(s => prisma.sleepSession.upsert({
            where: { date: s.date },
            create: s,
            update: s,
          }))
        )
      }
      sleep += writes.length
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

    // Everything below is DERIVED from the samples just written. It runs
    // after the writes, over the days the payload touched, so a partial
    // payload still recomputes a whole day rather than a sliver of one.
    const touched = new Set<string>([
      ...uniqueMetrics.map(m => m.date),
      ...uniqueSamples.map(s => s.date),
      ...uniqueSleep.map(s => s.date),
    ])
    const derived = await recomputeDerived([...touched])

    await recordImport({
      ok: true, metrics, sleep, workouts,
      skipped: parsed.skipped,
      span: spanOf(parsed),
      note: parsed.warnings.length ? parsed.warnings.join('; ').slice(0, 500) : null,
      source: sourceOf(req),
    })

    return NextResponse.json({
      ok: true,
      metrics,
      sleep,
      workouts,
      samples,
      derived,
      skipped: parsed.skipped,
      warnings: parsed.warnings,
    })
  } catch (e) {
    console.error('[/api/health-import]', e)
    // Log the failure too — a run that arrived and broke must be
    // distinguishable from one that never arrived, which is the entire point
    // of this table.
    await recordImport({
      ok: false, metrics: 0, sleep: 0, workouts: 0, skipped: parsed.skipped,
      span: spanOf(parsed),
      note: (e instanceof Error ? e.message : String(e)).slice(0, 500),
      source: sourceOf(req),
    })
    return NextResponse.json({ error: 'import failed' }, { status: 500 })
  }
}

/** HAE timestamps ("2026-08-10 02:10:39 -0500") to epoch ms. */
function at(s: string | null | undefined): number | null {
  if (!s) return null
  const t = Date.parse(s.replace(' ', 'T').replace(/ ([+-]\d{4})$/, '$1'))
  return Number.isFinite(t) ? t : null
}

function previousDay(d: string): string {
  const x = new Date(d + 'T12:00:00')
  x.setDate(x.getDate() - 1)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

/** Recompute everything that is a function of the raw samples, for the given
 *  days: each night's sleep-window physiology, and each day's elevated-heart-
 *  rate minutes.
 *
 *  Derived at write time rather than read time. The alternative — deriving in
 *  /api/health — means every page load re-reads a few hundred readings per
 *  night across the whole visible range, tens of thousands of rows, to draw
 *  three rings. This runs once per import instead, on the handful of days an
 *  import actually touched. */
async function recomputeDerived(days: string[]): Promise<{ nights: number; days: number }> {
  if (days.length === 0) return { nights: 0, days: 0 }
  const C = HEALTH_CONSTANTS.STRAIN

  // A night starts on the previous calendar day, so its readings live under
  // both dates. Widen the query rather than miss the first half of every
  // window — that would bias sleeping HR toward the morning, when it is
  // highest, and quietly depress every recovery score.
  const span = [...new Set(days.flatMap(d => [previousDay(d), d]))]
  const samples = await prisma.healthSample.findMany({
    where: { date: { in: span } },
    select: { metric: true, start: true, date: true, qty: true, min: true, avg: true, max: true },
  })

  const byMetric = new Map<string, { t: number; date: string; qty: number | null; min: number | null; avg: number | null }[]>()
  for (const s of samples) {
    const t = at(s.start)
    if (t == null) continue
    const list = byMetric.get(s.metric) ?? []
    list.push({ t, date: s.date, qty: s.qty, min: s.min, avg: s.avg })
    byMetric.set(s.metric, list)
  }
  for (const list of byMetric.values()) list.sort((a, b) => a.t - b.t)

  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

  // ── each night's sleep-window physiology ────────────────────────────────
  const nights = await prisma.sleepSession.findMany({ where: { date: { in: days } } })
  let nightsWritten = 0
  for (const n of nights) {
    const a = at(n.start), b = at(n.end)
    if (a == null || b == null || b <= a) continue
    const pick = (metric: string) => (byMetric.get(metric) ?? [])
      .filter(s => s.t >= a && s.t <= b)
      .map(s => s.avg ?? s.qty)
      .filter((v): v is number => v != null)
    const hr = pick('heart_rate'), hrv = pick('heart_rate_variability'), resp = pick('respiratory_rate')
    await prisma.sleepSession.update({
      where: { date: n.date },
      data: {
        sleepHr: mean(hr), sleepHrv: mean(hrv), sleepResp: mean(resp),
        hrN: hr.length, hrvN: hrv.length, respN: resp.length,
      },
    })
    nightsWritten++
  }

  // ── each day's elevated-heart-rate minutes ──────────────────────────────
  // Every reading is credited the gap to the next one, capped: a watch on the
  // charger must not read as hours of exertion.
  const hrAll = byMetric.get('heart_rate') ?? []
  const elevated = new Map<string, number>()
  for (let i = 0; i < hrAll.length; i++) {
    const x = hrAll[i], next = hrAll[i + 1]
    const v = x.avg ?? x.qty
    if (v == null || v < C.HR_ELEVATED_BPM) continue
    const dt = next && next.date === x.date
      ? Math.min(C.SAMPLE_GAP_CAP_MIN, (next.t - x.t) / 60000)
      : 1
    elevated.set(x.date, (elevated.get(x.date) ?? 0) + dt)
  }
  let daysWritten = 0
  for (const d of days) {
    // Only for days we actually hold readings for. Writing 0 for a day with no
    // samples would assert "no elevated heart rate" where the truth is "no
    // watch data", and that zero would then anchor a baseline.
    if (!hrAll.some(s => s.date === d)) continue
    const qty = Math.round((elevated.get(d) ?? 0) * 10) / 10
    await prisma.healthMetricDaily.upsert({
      where: { date_metric: { date: d, metric: 'hr_minutes_above_90' } },
      create: { date: d, metric: 'hr_minutes_above_90', qty, min: null, avg: null, max: null, units: 'min' },
      update: { qty, units: 'min' },
    })
    daysWritten++
  }

  return { nights: nightsWritten, days: daysWritten }
}

/** What to write over an existing daily row.
 *
 *  `qty` is clamped upward for the automation. The bug this exists to prevent:
 *  HAE's "Since Last Sync" export period sends only the readings taken since
 *  the previous run but still labels them with the DAY, so an hourly automation
 *  posts "15 steps, 2026-08-10" at 3pm and a plain overwrite replaces the real
 *  4,391 with it. Every day between 2026-08-08 and 2026-08-10 was flattened
 *  that way. A cumulative daily total only ever grows, so refusing to shrink it
 *  makes the whole class of partial-window export harmless.
 *
 *  Repairs still need to move a value down, so `replace` (set by the backfill
 *  script, never by the phone) bypasses the clamp entirely. min/avg/max are not
 *  clamped: they are distribution statistics, not running totals, and a fresh
 *  aggregate is simply better than a stale one. */
function mergeDaily(
  prev: { qty: number | null } | undefined,
  next: { qty: number | null; min: number | null; avg: number | null; max: number | null },
  replace: boolean,
) {
  const qty = replace || prev?.qty == null || next.qty == null
    ? next.qty
    : Math.max(prev.qty, next.qty)
  return { qty, min: next.min, avg: next.avg, max: next.max }
}

/** Whether an incoming night should overwrite the one already stored.
 *
 *  Same failure as above, in the shape that actually cost a night: a partial
 *  export window caught only the 06:47–08:02 tail of 2026-08-10 and wrote it
 *  over the full record, leaving 1.2h of sleep where the night had been. HAE
 *  re-sends the same night every run, so the longer record is the more complete
 *  one and a shorter one is a fragment. Naps land on the same wake day and are
 *  also shorter, so this keeps the night — which is the record recovery is
 *  scored on. */
function keepsNight(
  prev: { asleepMin: number | null } | undefined,
  next: { asleepMin: number | null },
  replace: boolean,
): boolean {
  if (replace || !prev || prev.asleepMin == null) return true
  if (next.asleepMin == null) return false
  return next.asleepMin >= prev.asleepMin
}

function spanOf(parsed: { metrics: { date: string }[]; sleep: { date: string }[]; workouts: { date: string }[] }): string | null {
  const days = [
    ...parsed.metrics.map(m => m.date),
    ...parsed.sleep.map(s => s.date),
    ...parsed.workouts.map(w => w.date),
  ].sort()
  if (days.length === 0) return null
  const lo = days[0], hi = days[days.length - 1]
  return lo === hi ? lo : `${lo} → ${hi}`
}

/** Never allowed to break an import. A logging failure that rejected a
 *  successful batch would be strictly worse than having no log at all. */
async function recordImport(row: {
  ok: boolean; metrics: number; sleep: number; workouts: number
  skipped: number; span: string | null; note: string | null; source: string
}) {
  try {
    await prisma.healthImportLog.create({ data: row })
    // Keep the table bounded. Hourly imports are ~8,800 rows a year and the
    // question this answers is always "recently?", never "last spring?".
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    await prisma.healthImportLog.deleteMany({ where: { at: { lt: cutoff } } })
  } catch (e) {
    console.error('[/api/health-import] failed to record import log', e)
  }
}

/** Prefix that marks a row written by a request that never got past the door.
 *  Used to find the previous rejection for rate limiting. */
const REJECTED = 'rejected: '

/** Log a request that was turned away, at most once every few minutes.
 *
 *  Rate limited on purpose: this path is reachable WITHOUT the API key, so an
 *  unlimited version would let anyone on the internet write rows into Connor's
 *  database and push real imports out of the log — turning a diagnostic into a
 *  vandalism surface. One row per window is plenty: the automation runs hourly,
 *  so every genuine failed run still gets recorded. */
async function recordRejection(note: string, source = 'other') {
  const WINDOW_MS = 5 * 60 * 1000
  try {
    const previous = await prisma.healthImportLog.findFirst({
      where: { ok: false, note: { startsWith: REJECTED } },
      orderBy: { at: 'desc' },
    })
    if (previous && Date.now() - previous.at.getTime() < WINDOW_MS) return
  } catch {
    // If the lookup fails, fall through and write: losing the rate limit is
    // better than losing the diagnostic that this whole change exists for.
  }
  await recordImport({
    ok: false, metrics: 0, sleep: 0, workouts: 0, skipped: 0, span: null,
    note: (REJECTED + note).slice(0, 500),
    source,
  })
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
    const [metrics, sleep, workouts, recent] = await Promise.all([
      prisma.healthMetricDaily.count(),
      prisma.sleepSession.count(),
      prisma.healthWorkout.count(),
      prisma.healthImportLog.findMany({ orderBy: { at: 'desc' }, take: 10 }),
    ])
    return NextResponse.json({ ok: true, rows: { metrics, sleep, workouts }, recent })
  } catch (e) {
    console.error('[/api/health-import GET]', e)
    return NextResponse.json({ error: 'count failed' }, { status: 500 })
  }
}
