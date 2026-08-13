'use client'
import { useEffect, useState } from 'react'
import { Card, Section, InsightCard } from '@/components/ui'

// First-run onboarding. Bevel's own weakness is that an empty install explains
// nothing, so this states exactly what to do, in order, with the values the
// phone actually needs.
//
// The API key is deliberately NOT shown. It is a server secret; rendering it
// here would ship it to the browser and put it in any screenshot of this page.

const STEPS = [
  {
    title: 'Install Health Auto Export — JSON+CSV',
    body: 'App Store, iOS. The REST API automation needs the Premium tier (~$24.99 lifetime, or $5.99/yr; there is a 7-day trial).',
  },
  {
    title: 'Create a REST API automation',
    body: 'Automations → new → REST API. Method POST, format JSON, Aggregate Data OFF, Export Period “Today”, finest time grouping. Aggregated exports carry no timestamps — one destroyed three days of totals with no way back — so the server derives the daily rows itself from raw readings.',
  },
  {
    title: 'Point it at this endpoint',
    body: 'URL below. Add one header: X-Api-Key, set to the HEALTH_IMPORT_KEY value from the project .env (never paste it into a screenshot).',
  },
  {
    title: 'Choose metrics and enable workouts',
    body: 'Heart rate, resting heart rate, HRV, respiratory rate, active + basal energy, exercise minutes, stand hours, steps, VO₂ max, blood oxygen, and sleep analysis. Turn workouts on.',
  },
  {
    title: 'Run it hourly, then backfill',
    body: 'Set the schedule to hourly with Export Period “Today” — never “Since Last Sync”, which labels an hour’s readings as the whole day. For history, send raw-sample exports one month at a time; the importer never shrinks an existing total, so re-sending is safe.',
  },
]

export function HealthEmptyState() {
  const [origin, setOrigin] = useState('')
  // Read at runtime rather than hardcoding prod: this page renders on
  // localhost, on preview deploys, and on prod, and the URL must be right in
  // whichever one Connor is holding when he configures the phone.
  useEffect(() => setOrigin(window.location.origin), [])

  const [copied, setCopied] = useState(false)
  const url = `${origin}/api/health-import`

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard blocked — the URL is visible and selectable anyway */ }
  }

  return (
    <div className="space-y-5">
      <InsightCard icon="⌚" title="No health data yet">
        This tab fills in once Health Auto Export starts posting from your Apple Watch.
        Nothing else in the app depends on it.
      </InsightCard>

      <Section label="Setup · five steps">
        <Card padding={20}>
          <ol className="space-y-4 list-none m-0 p-0">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3.5">
                <span className="w-6 h-6 rounded-full shrink-0 inline-flex items-center justify-center bg-primary-500/16 border border-primary-400/30 text-primary-300 text-micro font-bold tabular-nums">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-caption font-semibold text-on-surface">{s.title}</div>
                  <div className="text-tiny text-on-surface-variant/60 leading-relaxed mt-1">{s.body}</div>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-5 pt-4 border-t border-outline-variant/30">
            <div className="text-micro font-bold uppercase tracking-[0.14em] text-on-surface-variant/50 mb-2">
              Endpoint
            </div>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 text-tiny text-on-surface bg-white/[0.04] border border-outline-variant/40 rounded-lg px-3 py-2 overflow-x-auto no-scrollbar whitespace-nowrap">
                {url || '…'}
              </code>
              {/* Always visible, not hover-revealed: this is the one control on
                  the page and it has to work on the phone being set up. */}
              <button
                type="button"
                onClick={copy}
                className="shrink-0 px-3 py-2 rounded-lg text-tiny font-semibold border border-outline-variant/40 text-on-surface-variant/80 active:bg-surface-container-high md:hover:text-on-surface md:hover:bg-surface-container-low transition-colors"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="text-micro text-on-surface-variant/45 mt-2">
              Header: <span className="font-semibold text-on-surface-variant/70">X-Api-Key</span> — value is <span className="font-semibold text-on-surface-variant/70">HEALTH_IMPORT_KEY</span> from .env.
            </div>
          </div>
        </Card>
      </Section>
    </div>
  )
}
