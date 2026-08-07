'use client'
import { useState } from 'react'
import { PageHeader, SegmentedControl } from '@/components/ui'
import LiftTracker from '@/components/LiftTracker'
import { useHealthData, LoadingBlock } from './bevel/shared'
import { BevelDashboard } from './bevel/BevelDashboard'
import { BevelSleep } from './bevel/BevelSleep'
import { BevelRecovery } from './bevel/BevelRecovery'
import { BevelStrain } from './bevel/BevelStrain'
import { BevelTrends } from './bevel/BevelTrends'
import { HealthEmptyState } from './bevel/HealthEmptyState'

// Bevel — Apple Watch health, plus the lift tracker that used to have its own
// tab. One fetch at this level feeds every sub-tab; Lifts is untouched and
// keeps its own APIs and state.

export type BevelTab = 'dashboard' | 'sleep' | 'recovery' | 'strain' | 'lifts' | 'trends'

const TABS: { value: BevelTab; label: string }[] = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'sleep', label: 'Sleep' },
  { value: 'recovery', label: 'Recovery' },
  { value: 'strain', label: 'Strain' },
  { value: 'lifts', label: 'Lifts' },
  { value: 'trends', label: 'Trends' },
]

type Range = '30' | '90' | '365'

export default function BevelView() {
  const [tab, setTab] = useState<BevelTab>('dashboard')
  const [range, setRange] = useState<Range>('30')
  const { data, loading, error } = useHealthData(Number(range))

  // Lifts is mounted from the first render, not on first visit: LiftTracker
  // owns the stopwatch UI and in-progress set drafts, and mounting it lazily
  // would mean the floating timer only exists once the sub-tab has been
  // opened — a regression against the old standalone Lifts tab.
  const [visited, setVisited] = useState<Set<BevelTab>>(() => new Set<BevelTab>(['dashboard', 'lifts']))
  function open(t: BevelTab) {
    setTab(t)
    setVisited(prev => prev.has(t) ? prev : new Set(prev).add(t))
  }

  const healthEmpty = !loading && !error && (data?.empty ?? true)

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Bevel"
        title="Health"
        sub="Apple Watch recovery, sleep and strain — plus your lifts."
        right={
          tab !== 'lifts' ? (
            <SegmentedControl
              ariaLabel="Time range"
              options={(['30', '90', '365'] as Range[]).map(r => ({ value: r, label: `${r}d` }))}
              value={range}
              onChange={setRange}
            />
          ) : undefined
        }
      />

      {/* Sub-tab bar. Scrollable rather than wrapping — six segments do not
          fit a 375px viewport and a wrapped second row reads as two bars. */}
      <SegmentedControl
        ariaLabel="Bevel section"
        scrollable
        options={TABS.map(t => ({ value: t.value, label: t.label }))}
        value={tab}
        onChange={open}
      />

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
                : healthEmpty || !data
                  ? <HealthEmptyState />
                  : t === 'dashboard' ? <BevelDashboard data={data} onOpen={open} />
                  : t === 'sleep' ? <BevelSleep data={data} />
                  : t === 'recovery' ? <BevelRecovery data={data} />
                  : t === 'strain' ? <BevelStrain data={data} />
                  : <BevelTrends data={data} />}
        </div>
      ))}
    </div>
  )
}
