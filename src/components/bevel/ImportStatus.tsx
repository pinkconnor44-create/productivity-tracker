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

  return (
    <div className="flex items-center gap-2 text-micro">
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          !last.ok ? 'bg-rose-400' : stale ? 'bg-amber-400' : 'bg-emerald-400'
        }`}
        aria-hidden
      />
      <span className="text-on-surface-variant/55">
        {last.ok ? 'Last import' : 'Last import failed'} {when}
        {last.ok && <> · {rows} row{rows === 1 ? '' : 's'}</>}
        {last.span && <> · {last.span}</>}
        {last.skipped > 0 && <> · {last.skipped} skipped</>}
      </span>
    </div>
  )
}
