'use client'
import { useStopwatch } from '@/lib/stopwatch'

// Narrow vertical strip on the right edge. Rendered globally by Shell so the
// timer stays visible when the user switches away from the Lifts tab. Tapping
// the expand button returns to the floating widget inside LiftTracker.
export default function DockedStopwatch() {
  const { ms, running, mode, start, stop, reset, setMode } = useStopwatch()
  if (mode !== 'dock') return null

  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  const mStr = String(m).padStart(2, '0')
  const sStr = String(s).padStart(2, '0')

  const timeColor = running ? 'text-violet-300' : ms > 0 ? 'text-on-surface' : 'text-on-surface-variant/60'

  return (
    <div
      data-no-swipe
      className="fixed z-[55] right-1.5 top-1/2 -translate-y-1/2 flex flex-col items-stretch gap-1.5 px-1.5 py-2 rounded-2xl bg-surface-container-high/95 border border-violet-400/40 shadow-2xl backdrop-blur-md select-none"
    >
      <button
        onClick={() => setMode('float')}
        className="w-7 h-6 flex items-center justify-center rounded-md text-on-surface-variant/60 hover:text-on-surface hover:bg-surface-container transition-colors text-[11px]"
        aria-label="Expand timer"
        title="Expand"
      >
        ⤢
      </button>
      <div className="flex flex-col items-center leading-none py-0.5">
        <span className={`font-mono font-bold tabular-nums text-[13px] ${timeColor}`}>{mStr}</span>
        <span className="text-[8px] text-on-surface-variant/40 -my-0.5">:</span>
        <span className={`font-mono font-bold tabular-nums text-[13px] ${timeColor}`}>{sStr}</span>
        {running && <span className="mt-1 w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />}
      </div>
      {!running ? (
        <button onClick={start} className="w-7 h-7 flex items-center justify-center rounded-md bg-violet-600 text-white hover:bg-violet-700 text-[10px]" aria-label="Start">
          ▶
        </button>
      ) : (
        <button onClick={stop} className="w-7 h-7 flex items-center justify-center rounded-md bg-amber-500 text-white hover:bg-amber-600 text-[10px]" aria-label="Stop">
          ■
        </button>
      )}
      {ms > 0 && (
        <button
          onClick={reset}
          className="w-7 h-7 flex items-center justify-center rounded-md border border-outline-variant/60 text-on-surface-variant/60 hover:text-rose-400 hover:border-rose-500/40 transition-colors text-[10px]"
          aria-label="Reset"
          title="Reset"
        >
          ⟲
        </button>
      )}
    </div>
  )
}
