'use client'
import { useEffect, useState } from 'react'
import { SegmentedControl } from '@/components/ui'
import LiftTracker from '@/components/LiftTracker'
import { useStopwatch } from '@/lib/stopwatch'
import { useHealthData, LoadingBlock, latestDayWith, today } from './bevel/shared'
import { DayScroller } from './bevel/DayScroller'
import { ImportStatus } from './bevel/ImportStatus'
import { BevelDashboard } from './bevel/BevelDashboard'
import { BevelSleep } from './bevel/BevelSleep'
import { BevelRecovery } from './bevel/BevelRecovery'
import { BevelStrain } from './bevel/BevelStrain'
import { BevelTrends } from './bevel/BevelTrends'
import { HealthEmptyState } from './bevel/HealthEmptyState'

// Bevel — Apple Watch health, plus the lift tracker that used to have its own
// tab. One fetch at this level feeds every sub-tab; Lifts is untouched and
// keeps its own APIs and state.
//
// The page header and the 30/90/365 range control were removed 2026-08-09.
// Every sub-tab except Trends renders exactly ONE day, so the control that
// belongs at the top is a day picker, not a window length. The window is now
// an implementation detail that starts at 90 days and grows only when the user
// scrolls past it.

export type BevelTab = 'dashboard' | 'sleep' | 'recovery' | 'strain' | 'lifts' | 'trends'

const TABS: { value: BevelTab; label: string }[] = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'sleep', label: 'Sleep' },
  { value: 'recovery', label: 'Recovery' },
  { value: 'strain', label: 'Strain' },
  { value: 'lifts', label: 'Lifts' },
  { value: 'trends', label: 'Trends' },
]

/** Days fetched on open. Wide enough that scrolling back a couple of months
 *  needs no extra request, narrow enough that opening Bevel is not a
 *  four-figure row read. */
const INITIAL_WINDOW = 90
const WINDOW_STEPS = [90, 180, 365, 730]

export default function BevelView() {
  const [tab, setTab] = useState<BevelTab>('dashboard')
  const [windowDays, setWindowDays] = useState(INITIAL_WINDOW)
  const { data, loading, error, anchor } = useHealthData(windowDays)
  const { setLiftsActive } = useStopwatch()

  // The day every sub-tab renders. Null until the first response, then the
  // most recent day carrying anything — which in the morning is yesterday,
  // because HAE has not run yet.
  const [selected, setSelected] = useState<string | null>(null)
  useEffect(() => {
    if (!data || selected !== null) return
    const latest = latestDayWith(data.days, d =>
      d.sleep != null || d.workouts.length > 0 || Object.values(d.metrics).some(v => v != null)
    )
    setSelected(latest?.date ?? data.end ?? today())
  }, [data, selected])

  // Lifts is mounted from the first render, not on first visit: it owns
  // in-progress set drafts, and a lazy mount would drop a set the moment the
  // user looked at another sub-tab.
  const [visited, setVisited] = useState<Set<BevelTab>>(() => new Set<BevelTab>(['dashboard', 'lifts']))
  function open(t: BevelTab) {
    setTab(t)
    setVisited(prev => prev.has(t) ? prev : new Set(prev).add(t))
  }

  // The rest timer belongs to Lifts and nothing else. Shell renders it (it must
  // sit outside the transformed tab-fade subtree, or `position: fixed` would be
  // trapped) but only Bevel knows which sub-tab is open, so the flag is shared
  // through the stopwatch context rather than drilled through Shell's props.
  useEffect(() => {
    setLiftsActive(tab === 'lifts')
    return () => setLiftsActive(false)
  }, [tab, setLiftsActive])

  const healthEmpty = !loading && !error && (data?.empty ?? true)
  const canLoadEarlier = WINDOW_STEPS.some(s => s > windowDays)
  function loadEarlier() {
    const next = WINDOW_STEPS.find(s => s > windowDays)
    if (next) setWindowDays(next)
  }

  return (
    <div className="space-y-4">
      {/* Visibility probe for useHealthData — zero-size, purely structural. */}
      <span ref={anchor} aria-hidden className="sr-only" />

      {/* Sub-tab bar. Scrollable rather than wrapping — six segments do not
          fit a 375px viewport and a wrapped second row reads as two bars. */}
      <SegmentedControl
        ariaLabel="Bevel section"
        scrollable
        options={TABS.map(t => ({ value: t.value, label: t.label }))}
        value={tab}
        onChange={open}
      />

      {/* Day picker. Hidden on Lifts (no day dimension) and on Trends (a range
          view by definition — a single-day selection would mean nothing). */}
      {tab !== 'lifts' && tab !== 'trends' && data && selected && !healthEmpty && (
        <DayScroller
          days={data.days}
          selected={selected}
          onSelect={setSelected}
          onLoadEarlier={canLoadEarlier ? loadEarlier : null}
          loadingEarlier={loading}
        />
      )}

      {/* Import freshness. Shown on every sub-tab except Lifts, which has
          nothing to do with the health pipeline. */}
      {tab !== 'lifts' && data && <ImportStatus last={data.lastImport} />}

      {/* Keep-mounted panels, same hidden-div pattern as Shell: switching to
          Lifts and back must not reset a set in progress. */}
      {[...visited].map(t => (
        <div key={t} className={t === tab ? '' : 'hidden'}>
          {t === 'lifts'
            ? <LiftTracker />
            : loading && !data
              ? <LoadingBlock height="h-56" />
              : error
                ? <div className="glass rounded-2xl px-5 py-8 text-center">
                    <div className="text-body font-semibold text-on-surface">Could not load health data</div>
                    <div className="text-caption text-on-surface-variant/55 mt-1.5">
                      The request failed. Switching tabs retries it.
                    </div>
                  </div>
                : healthEmpty || !data || !selected
                  ? <HealthEmptyState />
                  : t === 'dashboard' ? <BevelDashboard data={data} selected={selected} onOpen={open} />
                  : t === 'sleep' ? <BevelSleep data={data} selected={selected} />
                  : t === 'recovery' ? <BevelRecovery data={data} selected={selected} />
                  : t === 'strain' ? <BevelStrain data={data} selected={selected} />
                  : <BevelTrends data={data} />}
        </div>
      ))}
    </div>
  )
}
