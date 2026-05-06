'use client'
import { useState, useEffect, useCallback } from 'react'
import { isHabitActiveOnDate } from '@/lib/recurring'
import { PageHeader } from '@/components/ui'

type DayScore = { completed: number; total: number; pct: number }
type Scores   = Record<string, DayScore>
type Habit    = { id: number; name: string; recurringDays?: string; createdAt: string; completions: { date: string }[] }
type Task     = { id: number; title: string; recurringType?: string; dueDate?: string; completed: boolean; completions: { date: string }[] }

const WEEKDAYS_FULL  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const WEEKDAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function localDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function today() { return localDate(new Date()) }
function addDays(s: string, n: number) {
  const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return localDate(d)
}
function getMondayOfWeek(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return localDate(d)
}
function weekLabel(monday: string) {
  const sun = addDays(monday, 6)
  const m = new Date(monday + 'T12:00:00'), s = new Date(sun + 'T12:00:00')
  return `${MONTHS[m.getMonth()]} ${m.getDate()} – ${MONTHS[s.getMonth()]} ${s.getDate()}, ${s.getFullYear()}`
}

// Big circular score wheel
function BigWheel({ pct }: { pct: number | null }) {
  const r = 52, circ = 2 * Math.PI * r
  const fill = pct !== null ? (pct / 100) * circ : 0
  const color = pct === null ? '#94a3b8' : pct >= 80 ? '#10b981' : pct >= 50 ? '#7c3aed' : '#f43f5e'
  const label = pct === null ? '—' : `${pct}%`
  return (
    <div className="relative w-32 h-32">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" className="stroke-outline-variant/40" strokeWidth="9" />
        {pct !== null && (
          <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="9"
            strokeDasharray={`${fill} ${circ}`} strokeLinecap="round" />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold leading-none" style={{ color }}>{label}</span>
        <span className="text-[11px] text-on-surface-variant mt-1">this week</span>
      </div>
    </div>
  )
}

function ScoreBar({ pct, label, isToday }: { pct: number | null; label: string; isToday: boolean }) {
  const color = pct === null ? 'bg-surface-container-low'
    : pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-violet-500' : 'bg-rose-400'
  return (
    <div className={`flex items-center gap-2.5 ${isToday ? 'opacity-100' : ''}`}>
      <span className={`text-xs w-7 shrink-0 font-medium ${isToday ? 'text-violet-400' : 'text-on-surface-variant'}`}>{label}</span>
      <div className="flex-1 h-2.5 bg-surface-container-low rounded-full overflow-hidden">
        {pct !== null && <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />}
      </div>
      <span className={`text-xs tabular-nums shrink-0 w-8 text-right font-semibold ${
        pct === null ? 'text-on-surface-variant/30' : pct >= 80 ? 'text-emerald-500' : pct >= 50 ? 'text-violet-500' : 'text-rose-400'
      }`}>{pct !== null ? `${pct}%` : '—'}</span>
    </div>
  )
}

function generateInsights(
  weekPct: number | null,
  prevWeekPct: number | null,
  dayScores: { date: string; pct: number }[],
  habitStats: { name: string; pct: number; done: number; active: number }[],
  tasksCompleted: number,
  pastDaysCount: number,
): string[] {
  const insights: string[] = []
  if (dayScores.length === 0) return ['No data yet for this week — check back after logging some tasks or habits.']

  // Week vs last week
  if (weekPct !== null && prevWeekPct !== null) {
    const delta = weekPct - prevWeekPct
    if (delta > 0) insights.push(`Up ${delta}% from last week (${prevWeekPct}% → ${weekPct}%). Keep the momentum.`)
    else if (delta < 0) insights.push(`Down ${Math.abs(delta)}% from last week (${prevWeekPct}% → ${weekPct}%).`)
    else insights.push(`Exactly on par with last week at ${weekPct}%.`)
  }

  // Best and worst days
  if (dayScores.length >= 2) {
    const best  = dayScores.reduce((a, b) => a.pct >= b.pct ? a : b)
    const worst = dayScores.reduce((a, b) => a.pct <= b.pct ? a : b)
    const bestDay  = WEEKDAYS_FULL[new Date(best.date  + 'T12:00:00').getDay()]
    const worstDay = WEEKDAYS_FULL[new Date(worst.date + 'T12:00:00').getDay()]
    if (best.pct === worst.pct) {
      insights.push(`Consistent across all days — every day scored ${best.pct}%.`)
    } else {
      insights.push(`Best day: ${bestDay} at ${best.pct}%. Weakest: ${worstDay} at ${worst.pct}%.`)
    }
  }

  // Perfect days
  const perfectDays = dayScores.filter(d => d.pct === 100).length
  if (perfectDays > 0) {
    insights.push(`${perfectDays} perfect day${perfectDays > 1 ? 's' : ''} this week — every task and habit completed.`)
  }

  // Habits
  if (habitStats.length > 0) {
    const perfect = habitStats.filter(h => h.pct === 100)
    const missed  = habitStats.filter(h => h.pct === 0)
    const best    = habitStats.reduce((a, b) => a.pct >= b.pct ? a : b)
    if (perfect.length === habitStats.length) {
      insights.push(`Perfect habit week — all ${habitStats.length} habit${habitStats.length > 1 ? 's' : ''} completed every scheduled day.`)
    } else {
      if (best.pct > 0) insights.push(`Most consistent habit: "${best.name}" at ${best.pct}% (${best.done}/${best.active} days).`)
      if (missed.length > 0) insights.push(`Habit${missed.length > 1 ? 's' : ''} not started: ${missed.map(h => `"${h.name}"`).join(', ')}.`)
    }
  }

  // Tasks
  if (tasksCompleted > 0) {
    insights.push(`${tasksCompleted} task${tasksCompleted > 1 ? 's' : ''} completed across ${pastDaysCount} day${pastDaysCount > 1 ? 's' : ''}.`)
  }

  return insights.slice(0, 5)
}

export default function WeeklyReview() {
  const [weekStart, setWeekStart] = useState(() => getMondayOfWeek(today()))
  const [scores,    setScores]    = useState<Scores>({})
  const [prevScores, setPrevScores] = useState<Scores>({})
  const [habits,    setHabits]    = useState<Habit[]>([])
  const [tasks,     setTasks]     = useState<Task[]>([])
  const [loading,   setLoading]   = useState(true)

  const weekEnd    = addDays(weekStart, 6)
  const prevStart  = addDays(weekStart, -7)
  const prevEnd    = addDays(weekStart, -1)
  const isCurrentWeek = weekStart === getMondayOfWeek(today())

  const loadWeek = useCallback(async (ws: string) => {
    setLoading(true)
    const we = addDays(ws, 6)
    const ps = addDays(ws, -7)
    const pe = addDays(ws, -1)
    const [scoresRes, prevRes, habitsRes, tasksRes] = await Promise.all([
      fetch(`/api/scores?startDate=${ws}&endDate=${we}`),
      fetch(`/api/scores?startDate=${ps}&endDate=${pe}`),
      fetch('/api/habits'),
      fetch('/api/tasks'),
    ])
    if (scoresRes.ok) setScores(await scoresRes.json())
    if (prevRes.ok) setPrevScores(await prevRes.json())
    if (habitsRes.ok) setHabits(await habitsRes.json())
    if (tasksRes.ok) setTasks(await tasksRes.json())
    setLoading(false)
  }, [])

  useEffect(() => { loadWeek(weekStart) }, [weekStart, loadWeek])

  const todayStr   = today()
  const weekDays   = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const pastDays   = weekDays.filter(d => d <= todayStr)

  // Aggregate scores
  let totalC = 0, totalP = 0
  for (const d of pastDays) { const s = scores[d]; if (s) { totalC += s.completed; totalP += s.total } }
  const weekPct = totalP > 0 ? Math.round((totalC / totalP) * 100) : null

  let prevC = 0, prevP = 0
  for (let i = 0; i < 7; i++) {
    const d = addDays(prevStart, i); const s = prevScores[d]
    if (s) { prevC += s.completed; prevP += s.total }
  }
  const prevWeekPct = prevP > 0 ? Math.round((prevC / prevP) * 100) : null

  const delta = weekPct !== null && prevWeekPct !== null ? weekPct - prevWeekPct : null

  // Day scores for chart
  const dayScores = weekDays.map(d => ({
    date: d,
    pct: scores[d]?.pct ?? null,
    short: WEEKDAYS_SHORT[new Date(d + 'T12:00:00').getDay()],
  }))

  // Habit stats
  const habitStats = habits.map(habit => {
    const habitStart = habit.createdAt.slice(0, 10)
    const activeDays = pastDays.filter(d => d >= habitStart && isHabitActiveOnDate(habit, d))
    const doneDays   = activeDays.filter(d => habit.completions.some(c => c.date === d))
    const pct = activeDays.length > 0 ? Math.round((doneDays.length / activeDays.length) * 100) : 0
    return { id: habit.id, name: habit.name, pct, done: doneDays.length, active: activeDays.length }
  }).filter(h => h.active > 0).sort((a, b) => b.pct - a.pct)

  // Tasks completed this week
  const tasksCompleted = tasks.reduce((acc, task) => {
    if (task.recurringType) {
      return acc + task.completions.filter(c => c.date >= weekStart && c.date <= weekEnd).length
    }
    if (task.completed && task.dueDate && task.dueDate >= weekStart && task.dueDate <= weekEnd) return acc + 1
    return acc
  }, 0)

  const insights = generateInsights(
    weekPct, prevWeekPct,
    pastDays.map(d => ({ date: d, pct: scores[d]?.pct ?? 0 })).filter(d => scores[d.date]),
    habitStats,
    tasksCompleted,
    pastDays.length,
  )

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Weekly Review"
        title={weekLabel(weekStart)}
        sub="Reflect on the week — wins, lessons, and what's worth carrying forward."
        right={
          <div className="flex items-center gap-1.5">
            <button onClick={() => setWeekStart(w => addDays(w, -7))}
              aria-label="Previous week"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low border border-outline-variant/40 transition-colors">←</button>
            {!isCurrentWeek && (
              <button onClick={() => setWeekStart(getMondayOfWeek(today()))}
                className="px-3 h-8 text-[12px] font-semibold text-violet-300 bg-violet-500/15 border border-violet-400/30 rounded-lg hover:bg-violet-500/20 transition-colors">
                This week
              </button>
            )}
            <button onClick={() => setWeekStart(w => addDays(w, 7))}
              aria-label="Next week"
              disabled={isCurrentWeek}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low border border-outline-variant/40 transition-colors disabled:opacity-30">→</button>
          </div>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Overall score + vs last week */}
          <div className="glass rounded-2xl border p-5 flex items-center gap-6">
            <BigWheel pct={weekPct} />
            <div className="flex-1 space-y-2.5">
              <div>
                <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">vs last week</p>
                {delta === null ? (
                  <p className="text-sm text-on-surface-variant">No comparison data</p>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl font-bold ${delta > 0 ? 'text-emerald-500' : delta < 0 ? 'text-rose-400' : 'text-on-surface-variant/60'}`}>
                      {delta > 0 ? '+' : ''}{delta}%
                    </span>
                    <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${
                      delta > 0 ? 'bg-emerald-500/15 text-emerald-400'
                      : delta < 0 ? 'bg-rose-500/15 text-rose-500'
                      : 'bg-surface-container-low text-on-surface-variant/70'
                    }`}>
                      {delta > 0 ? '↑ Improving' : delta < 0 ? '↓ Dropped' : '→ Same'}
                    </span>
                  </div>
                )}
                {prevWeekPct !== null && (
                  <p className="text-xs text-on-surface-variant mt-0.5">Last week: {prevWeekPct}%</p>
                )}
              </div>
              <div className="flex items-center gap-4 pt-1">
                <div className="text-center">
                  <p className="text-lg font-bold text-on-surface">{tasksCompleted}</p>
                  <p className="text-[10px] text-on-surface-variant">tasks done</p>
                </div>
                <div className="w-px h-8 bg-surface-container-low" />
                <div className="text-center">
                  <p className="text-lg font-bold text-on-surface">{habitStats.filter(h => h.pct === 100).length}/{habitStats.length}</p>
                  <p className="text-[10px] text-on-surface-variant">habits perfect</p>
                </div>
                <div className="w-px h-8 bg-surface-container-low" />
                <div className="text-center">
                  <p className="text-lg font-bold text-on-surface">{pastDays.filter(d => (scores[d]?.pct ?? 0) === 100).length}</p>
                  <p className="text-[10px] text-on-surface-variant">perfect days</p>
                </div>
              </div>
            </div>
          </div>

          {/* Daily breakdown */}
          <div className="glass rounded-2xl border overflow-hidden">
            <div className="px-4 py-3 border-b border-outline-variant/40 flex items-center gap-2">
              <span className="text-sm">📅</span>
              <h3 className="text-sm font-semibold text-on-surface">Daily Breakdown</h3>
            </div>
            <div className="px-4 py-3 space-y-2.5">
              {dayScores.map(({ date, pct, short }) => (
                <ScoreBar key={date} pct={pct} label={short} isToday={date === todayStr} />
              ))}
            </div>
          </div>

          {/* Habits leaderboard */}
          {habitStats.length === 0 ? (
            <div className="glass rounded-2xl border overflow-hidden">
              <div className="px-4 py-3 border-b border-outline-variant/40 flex items-center gap-2">
                <span className="text-sm">🔄</span>
                <h3 className="text-sm font-semibold text-on-surface">Habit Performance</h3>
              </div>
              <p className="px-4 py-6 text-sm text-on-surface-variant text-center">No habits were scheduled this week.<br/><span className="text-xs">Add habits in the Habits tab to track them here.</span></p>
            </div>
          ) : (
            <div className="glass rounded-2xl border overflow-hidden">
              <div className="px-4 py-3 border-b border-outline-variant/40 flex items-center gap-2">
                <span className="text-sm">🔄</span>
                <h3 className="text-sm font-semibold text-on-surface">Habit Performance</h3>
              </div>
              <div className="divide-y divide-outline-variant/40">
                {habitStats.map(h => (
                  <div key={h.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${h.pct === 100 ? 'bg-emerald-500' : h.pct >= 50 ? 'bg-violet-400' : 'bg-rose-400'}`} />
                    <span className="text-sm text-on-surface flex-1 truncate">{h.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-20 h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${h.pct === 100 ? 'bg-emerald-500' : h.pct >= 50 ? 'bg-violet-500' : 'bg-rose-400'}`}
                          style={{ width: `${h.pct}%` }} />
                      </div>
                      <span className="text-xs text-on-surface-variant tabular-nums text-right">{h.done}/{h.active}d</span>
                      <span className={`text-xs font-bold tabular-nums w-8 text-right ${h.pct === 100 ? 'text-emerald-500' : h.pct >= 50 ? 'text-violet-500' : 'text-rose-400'}`}>{h.pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Insights */}
          {insights.length > 0 && (
            <div className="glass rounded-2xl border overflow-hidden">
              <div className="px-4 py-3 border-b border-outline-variant/40 flex items-center gap-2">
                <span className="text-sm">💡</span>
                <h3 className="text-sm font-semibold text-on-surface">Insights</h3>
              </div>
              <ul className="px-4 py-3 space-y-2.5">
                {insights.map((insight, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-on-surface-variant leading-snug">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
