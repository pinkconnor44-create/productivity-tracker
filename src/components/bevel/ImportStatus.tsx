'use client'
import { useEffect, useState } from 'react'
import type { LastImport } from '@/lib/health'

// "Last import 14 minutes ago · 47 rows". Exists because the question "did the
// automation actually run?" was otherwise unanswerable from the app — a
// successful import carrying unchanged data writes identical values, so the
// data itself is not evidence. Only the request is.

function ago(iso: string, now: number): string {
  const secs = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))
  if (secs < 60) return 'just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.round(hrs / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export function ImportStatus({ last }: { last: LastImport }) {
  // Ticks so "14 min ago" does not freeze on a tab left open all day.
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  if (!last) {
    return (
      <div className="text-micro text-on-surface-variant/45">
        No imports received yet — the phone automation has never reached the server.
      </div>
    )
  }

  // `now` stays null until after hydration: calling Date.now() during render
  // would differ between server and client and trip a hydration mismatch.
  const when = now == null ? '' : ago(last.at, now)
  const rows = last.metrics + last.sleep + last.workouts
  const stale = now != null && now - Date.parse(last.at) > 6 * 60 * 60 * 1000

  // A request turned away at the door is recorded with a `rejected: ` note.
  // It is a different failure from an import that arrived and then broke, and
  // it has a different fix, so it gets different wording.
  const rejected = !last.ok && (last.note ?? '').startsWith('rejected: ')
  const reason = rejected ? (last.note ?? '').slice('rejected: '.length) : last.note

  return (
    <div className="flex flex-col gap-0.5 text-micro">
      <div className="flex items-center gap-2">
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            !last.ok ? 'bg-rose-400' : stale ? 'bg-amber-400' : 'bg-emerald-400'
          }`}
          aria-hidden
        />
        <span className="text-on-surface-variant/55">
          {last.ok ? 'Last import' : rejected ? 'Last request rejected' : 'Last import failed'} {when}
          {/* Who sent it. The whole reason this line exists in this form: a
              successful import from the phone and one from a hand-run backfill
              write identical rows, so "is the automation actually running on
              its own?" could not be answered from the app — only guessed at by
              whether you remembered pressing Export. */}
          {last.source === 'phone' && <> · from phone</>}
          {last.source === 'backfill' && <> · manual backfill</>}
          {/* Anything else — "other", or a value this build doesn't know —
              still gets a label. A silent fall-through here left the line
              unable to answer the one question it exists for: an unattended
              curl probe rendered identically to a phone push (item 12). */}
          {last.source != null && last.source !== 'phone' && last.source !== 'backfill' && <> · sender unknown</>}
          {last.ok && (rows > 0
            ? <> · {rows} row{rows === 1 ? '' : 's'}</>
            : <> · no rows written</>)}
          {last.span && <> · {last.span}</>}
          {last.skipped > 0 && <> · {last.skipped} skipped</>}
        </span>
      </div>
      {/* The reason, only on failure. This is the line that makes "the
          automation says it ran but nothing arrived" diagnosable from the
          phone rather than from Vercel's runtime logs. */}
      {!last.ok && reason && (
        <div className="text-on-surface-variant/40 pl-3.5 break-words">{reason}</div>
      )}
    </div>
  )
}
