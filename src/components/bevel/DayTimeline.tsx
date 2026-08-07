'use client'
import { METRIC_COLORS } from '@/components/ui'
import { formatMinutes, type HealthDay } from '@/lib/health'
import { clockTime } from './shared'

type Event = {
  key: string
  /** Minutes past midnight — the sort key. Nights that start before midnight
   *  sort to the top with a negative value rather than wrapping to the end. */
  at: number
  time: string
  title: string
  detail: string
  color: string
  icon: string
}

function minutesOf(ts: string | null | undefined, dayDate: string): number {
  if (!ts) return 0
  const m = ts.match(/[T ](\d{2}):(\d{2})/)
  if (!m) return 0
  const mins = Number(m[1]) * 60 + Number(m[2])
  // A sleep start on the previous calendar day belongs before 00:00.
  const dayPart = ts.slice(0, 10)
  return dayPart < dayDate ? mins - 1440 : mins
}

// Chronological "what happened on this day": the night that ended it, then
// each workout in order. Deliberately sparse — it answers "what was this day
// like" in one screen, and anything richer belongs on the detail tabs.
export function DayTimeline({ day }: { day: HealthDay }) {
  const events: Event[] = []

  if (day.sleep?.asleepMin != null) {
    events.push({
      key: 'sleep',
      at: minutesOf(day.sleep.start, day.date),
      time: `${clockTime(day.sleep.start)} → ${clockTime(day.sleep.end)}`,
      title: 'Sleep',
      detail: `${formatMinutes(day.sleep.asleepMin)} asleep${day.sleep.deepMin != null ? ` · ${formatMinutes(day.sleep.deepMin)} deep` : ''}`,
      color: METRIC_COLORS.sleep.base,
      icon: '🛏',
    })
  }

  for (const w of day.workouts) {
    events.push({
      key: `w${w.id}`,
      at: minutesOf(w.start, day.date),
      time: clockTime(w.start),
      title: w.type,
      detail: [
        formatMinutes(w.durationMin),
        w.activeKcal != null ? `${Math.round(w.activeKcal)} kcal` : null,
        w.distanceKm != null ? `${w.distanceKm.toFixed(2)} km` : null,
        w.avgHr != null ? `avg ${Math.round(w.avgHr)} bpm` : null,
      ].filter(Boolean).join(' · '),
      color: METRIC_COLORS.strain.base,
      icon: '⚡',
    })
  }

  events.sort((a, b) => a.at - b.at)

  if (events.length === 0) {
    return (
      <div className="text-caption text-on-surface-variant/45 py-3">
        Nothing recorded on this day.
      </div>
    )
  }

  return (
    <div className="relative pl-6">
      {/* Spine. Inset so the dots sit centred on it. */}
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-outline-variant/40" aria-hidden />
      <div className="space-y-4">
        {events.map(e => (
          <div key={e.key} className="relative">
            <span
              className="absolute -left-[22px] top-1 w-3.5 h-3.5 rounded-full border-2 border-surface"
              style={{ background: e.color }}
              aria-hidden
            />
            <div className="text-micro font-bold uppercase tracking-[0.12em] text-on-surface-variant/45">
              {e.time}
            </div>
            <div className="text-caption font-semibold text-on-surface mt-0.5">
              <span className="mr-1.5" aria-hidden>{e.icon}</span>{e.title}
            </div>
            <div className="text-micro text-on-surface-variant/55 mt-0.5">{e.detail}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
