'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { isTaskActiveOnDate, isHabitActiveOnDate, recurringLabel } from '@/lib/recurring'
import { toast } from '@/lib/toast'
import { PageHeader, StatCard, Card, Section, KindChip, KindPicker, kindStyle, scoreColor } from '@/components/ui'
import type { Kind } from '@/components/ui'

type TaskCompletion = { id: number; taskId: number; date: string }
type Task = {
  id: number; title: string; description?: string; dueDate?: string; time?: string; endTime?: string
  completed: boolean; completedAt?: string; recurringType?: string
  recurringDays?: string; recurringEnd?: string; completions: TaskCompletion[]
  skips: { date: string }[]
  kind?: string | null
  weight?: number
}
type Habit = {
  id: number; name: string; description?: string; recurringDays?: string
  createdAt: string; completions: { id: number; habitId: number; date: string }[]
  skips: { date: string }[]
}
type DayScore = { completed: number; total: number; pct: number }
type Scores = Record<string, DayScore>
type View = 'month' | 'week' | 'day'

function localDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function today() { return localDate(new Date()) }
function addDays(s: string, n: number) {
  const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return localDate(d)
}
function startOfWeek(s: string) {
  const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() - d.getDay()); return localDate(d)
}
function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`
}
// Tight time for narrow cells: "9a", "9:30a", "12p", "2:30p" — 2-6 chars max.
function shortTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const hh = h % 12 || 12
  const ap = h >= 12 ? 'p' : 'a'
  return m === 0 ? `${hh}${ap}` : `${hh}:${String(m).padStart(2,'0')}${ap}`
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month+1, 0).getDate()
  const prevMonthDays = new Date(year, month, 0).getDate()
  const days: { date: string; isCurrentMonth: boolean }[] = []
  for (let i = firstDay-1; i >= 0; i--)
    days.push({ date: localDate(new Date(year, month-1, prevMonthDays-i)), isCurrentMonth: false })
  for (let i = 1; i <= daysInMonth; i++)
    days.push({ date: localDate(new Date(year, month, i)), isCurrentMonth: true })
  while (days.length < 42) {
    const idx = days.length - firstDay - daysInMonth + 1
    days.push({ date: localDate(new Date(year, month+1, idx)), isCurrentMonth: false })
  }
  return days
}

const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

// Circular mini-wheel for calendar cells and headers
function wheelGrad(pct: number) { return pct >= 75 ? 'url(#wGreen)' : pct >= 50 ? 'url(#wYellow)' : 'url(#wRed)' }
function wheelColor(pct: number) { return pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#f43f5e' }

// Animates both the arc value (for CSS transition) and a display number (via rAF)
function useWheelAnim(target: number, duration = 900) {
  const [arc, setArc] = useState(0)
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const tArc = setTimeout(() => setArc(target), 60)
    if (target === 0) { setDisplay(0); return () => clearTimeout(tArc) }
    let rafId: number
    const tNum = setTimeout(() => {
      const t0 = performance.now()
      const tick = (now: number) => {
        const p = Math.min((now - t0) / duration, 1)
        setDisplay(Math.round((1 - Math.pow(1 - p, 3)) * target))
        if (p < 1) rafId = requestAnimationFrame(tick)
      }
      rafId = requestAnimationFrame(tick)
    }, 60)
    return () => { clearTimeout(tArc); clearTimeout(tNum); cancelAnimationFrame(rafId) }
  }, [target, duration])
  return { arc, display }
}

function MiniWheel({ pct, size = 28 }: { pct: number; size?: number }) {
  const { arc, display } = useWheelAnim(pct, 900)
  const r = 10, circ = 2 * Math.PI * r
  const fill = (arc / 100) * circ
  const color = wheelColor(pct)
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size} viewBox="0 0 24 24">
        <circle cx="12" cy="12" r={r} fill="none" className="stroke-outline-variant/40" strokeWidth="2.5" />
        <circle cx="12" cy="12" r={r} fill="none" stroke={wheelGrad(pct)} strokeWidth="2.5"
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[7px] font-bold leading-none" style={{ color }}>{display}%</span>
      </div>
    </div>
  )
}

function SummaryWheel({ label, pct, compact = false }: { label: string; pct: number | null; compact?: boolean }) {
  const { arc, display } = useWheelAnim(pct ?? 0, 1000)
  const dim = compact ? 70 : 80
  const r = compact ? 28 : 34
  const sw = compact ? 5 : 6
  const circ = 2 * Math.PI * r
  const fill = (arc / 100) * circ
  const color = pct === null ? '#94a3b8' : wheelColor(pct)
  const cx = compact ? 35 : 40
  const vb = compact ? '0 0 70 70' : '0 0 80 80'
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg className="w-full h-full -rotate-90" viewBox={vb}>
          <circle cx={cx} cy={cx} r={r} fill="none" className="stroke-outline-variant/40" strokeWidth={sw} />
          {pct !== null && (
            <circle cx={cx} cy={cx} r={r} fill="none" stroke={wheelGrad(pct)} strokeWidth={sw}
              strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)' }} />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className={`font-bold leading-none ${compact ? 'text-[12px]' : 'text-[13px]'}`} style={{ color }}>
            {pct === null ? '—' : `${display}%`}
          </span>
        </div>
      </div>
      <span className={`font-semibold text-on-surface-variant uppercase tracking-wider ${compact ? 'text-[9px]' : 'text-[10px]'}`}>{label}</span>
    </div>
  )
}

function startOfWeekStr(s: string) {
  const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() - d.getDay()); return localDate(d)
}
function aggregatePct(scores: Scores, start: string, end: string): number | null {
  let completed = 0, total = 0
  for (const [date, s] of Object.entries(scores)) {
    if (date >= start && date <= end) { completed += s.completed; total += s.total }
  }
  return total === 0 ? null : Math.round((completed / total) * 100)
}

export default function CalendarView() {
  const [view, setView] = useState<View>('month')
  const [currentDate, setCurrentDate] = useState(today())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [navKey, setNavKey] = useState(0)
  const [navDir, setNavDir] = useState<'right' | 'left'>('right')
  const [tasks, setTasks] = useState<Task[]>([])
  const [habits, setHabits] = useState<Habit[]>([])
  const [scores, setScores] = useState<Scores>({})
  const [summaryScores, setSummaryScores] = useState<Scores>({})
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())

  const t = today()
  const ws = startOfWeekStr(t)
  const monthStart = t.slice(0, 8) + '01'
  const yearStart  = t.slice(0, 4) + '-01-01'
  const dayPct   = summaryScores[t]?.pct ?? null
  const weekPct  = aggregatePct(summaryScores, ws, addDays(ws, 6))
  const monthPct = aggregatePct(summaryScores, monthStart, t)
  const yearPct  = aggregatePct(summaryScores, yearStart, t)

  const fetchData = useCallback(async () => {
    const [tr, hr] = await Promise.all([fetch('/api/tasks'), fetch('/api/habits')])
    const [t, h] = await Promise.all([
      tr.ok ? tr.json() : [],
      hr.ok ? hr.json() : [],
    ])
    setTasks(t); setHabits(h)
  }, [])

  const fetchSummary = useCallback(async () => {
    const t = today()
    const res = await fetch(`/api/scores?startDate=${t.slice(0, 4)}-01-01&endDate=${t}`)
    if (res.ok) setSummaryScores(await res.json())
  }, [])

  const fetchScores = useCallback(async () => {
    const d = new Date(currentDate + 'T12:00:00')
    let start: string, end: string
    if (view === 'month') {
      start = localDate(new Date(d.getFullYear(), d.getMonth(), 1))
      end = localDate(new Date(d.getFullYear(), d.getMonth()+1, 0))
    } else if (view === 'week') {
      start = startOfWeek(currentDate); end = addDays(start, 6)
    } else { start = end = currentDate }
    const [scoresRes, notesRes] = await Promise.all([
      fetch(`/api/scores?startDate=${start}&endDate=${end}`),
      fetch(`/api/notes?startDate=${start}&endDate=${end}`, { cache: 'no-store' })
    ])
    if (scoresRes.ok) setScores(await scoresRes.json())
    if (notesRes.ok) setNotes(await notesRes.json())
  }, [currentDate, view])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchData(), fetchScores(), fetchSummary()]).finally(() => setLoading(false))
  }, [fetchData, fetchScores, fetchSummary])

  const tasksForDate   = (date: string) => tasks.filter(t => isTaskActiveOnDate(t, date))
  const habitsForDate  = (date: string) => habits.filter(h => isHabitActiveOnDate(h, date))
  const isTaskDone     = (task: Task, date: string) =>
    task.recurringType ? task.completions.some(c => c.date === date) : task.completed

  function navigate(dir: -1|1) {
    setNavDir(dir === 1 ? 'right' : 'left')
    setNavKey(k => k + 1)
    const d = new Date(currentDate + 'T12:00:00')
    if (view === 'month') { d.setMonth(d.getMonth()+dir); d.setDate(1) }
    else if (view === 'week') d.setDate(d.getDate() + dir*7)
    else d.setDate(d.getDate() + dir)
    setCurrentDate(localDate(d))
  }

  function periodLabel() {
    const d = new Date(currentDate + 'T12:00:00')
    if (view === 'month') return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
    if (view === 'week') {
      const ws = startOfWeek(currentDate), we = addDays(ws, 6)
      const s = new Date(ws+'T12:00:00'), e = new Date(we+'T12:00:00')
      return `${MONTHS[s.getMonth()].slice(0,3)} ${s.getDate()} – ${MONTHS[e.getMonth()].slice(0,3)} ${e.getDate()}, ${e.getFullYear()}`
    }
    return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
  }

  async function toggleTask(task: Task, date: string) {
    const key = `task-${task.id}-${date}`
    if (togglingIds.has(key)) return
    setTogglingIds(prev => new Set(Array.from(prev).concat(key)))
    const completing = task.recurringType ? !task.completions.some(c => c.date === date) : !task.completed
    try {
      let res: Response
      if (task.recurringType) {
        res = await fetch('/api/task-completions', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ taskId: task.id, date }) })
      } else {
        res = await fetch(`/api/tasks/${task.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ completed: !task.completed }) })
      }
      if (!res.ok) throw new Error()
      if (completing) toast('Task complete ✓')
      fetchData(); fetchScores(); fetchSummary()
    } catch { toast('Failed to update task', 'warning') }
    setTogglingIds(prev => { const n = new Set(prev); n.delete(key); return n })
  }

  async function toggleHabit(habitId: number, date: string) {
    const key = `habit-${habitId}-${date}`
    if (togglingIds.has(key)) return
    setTogglingIds(prev => new Set(Array.from(prev).concat(key)))
    const habit = habits.find(h => h.id === habitId)
    const completing = habit ? !habit.completions.some(c => c.date === date) : false
    try {
      const res = await fetch('/api/habit-completions', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ habitId, date }) })
      if (!res.ok) throw new Error()
      if (completing) toast('Habit complete ✓')
      fetchData(); fetchScores(); fetchSummary()
    } catch { toast('Failed to update habit', 'warning') }
    setTogglingIds(prev => { const n = new Set(prev); n.delete(key); return n })
  }

  async function saveNote(date: string, content: string) {
    await fetch('/api/notes', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ date, content }) })
    setNotes(prev => content.trim()
      ? { ...prev, [date]: content }
      : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== date))
    )
  }

  async function addTask(title: string, date: string, time?: string, endTime?: string) {
    await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, dueDate: date, time: time || null, endTime: endTime || null }) })
    toast('Task added', 'info')
    await fetchData(); fetchScores(); fetchSummary()
  }

  async function skipTask(taskId: number, date: string) {
    await fetch('/api/task-skips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId, date }) })
    toast('Skipped for today', 'warning')
    fetchData(); fetchScores(); fetchSummary()
  }

  async function deleteTask(id: number) {
    await fetch(`/api/tasks/${id}?date=${today()}`, { method: 'DELETE' })
    toast('Task deleted', 'warning')
    fetchData(); fetchScores(); fetchSummary()
  }

  async function skipHabit(habitId: number, date: string) {
    await fetch('/api/habit-skips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ habitId, date }) })
    toast('Skipped for today', 'warning')
    fetchData(); fetchScores(); fetchSummary()
  }

  async function updateTask(id: number, data: Record<string, unknown>) {
    await fetch(`/api/tasks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    fetchData(); fetchScores(); fetchSummary()
  }

  async function replaceRecurringDay(task: Task, date: string, data: Record<string, unknown>) {
    await fetch('/api/task-skips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: task.id, date }) })
    await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, dueDate: date }) })
    fetchData(); fetchScores(); fetchSummary()
  }

  async function updateHabit(id: number, data: Record<string, unknown>) {
    await fetch(`/api/habits/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    fetchData(); fetchScores(); fetchSummary()
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-on-surface-variant/60">Loading...</div>

  const todayStrVal = today()

  return (
    <div>
      <PageHeader
        eyebrow="Calendar"
        title={periodLabel()}
        right={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex bg-surface-container-low border border-outline-variant/40 rounded-lg p-0.5 gap-0.5">
              {(['month','week','day'] as View[]).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 rounded-md text-[12px] font-semibold capitalize transition-colors ${
                    view === v ? 'bg-violet-500/16 text-violet-300 border border-violet-400/30' : 'text-on-surface-variant/70 hover:text-on-surface'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate(-1)} aria-label="Previous" className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface border border-outline-variant/40 transition-colors">←</button>
              <button onClick={() => setCurrentDate(today())} className="px-3 h-8 text-[12px] font-semibold bg-surface-container-low border border-outline-variant/40 rounded-lg text-on-surface-variant hover:text-violet-300 transition-colors">Today</button>
              <button onClick={() => navigate(1)} aria-label="Next" className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface border border-outline-variant/40 transition-colors">→</button>
            </div>
          </div>
        }
      />

      {/* Stat strip (Variation A) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-5">
        <StatCard label="Day"   value={dayPct ?? '—'}   suffix={dayPct != null ? '%' : undefined}   sub="today's score"   color={dayPct != null ? scoreColor(dayPct) : undefined}     barPct={dayPct ?? undefined}   />
        <StatCard label="Week"  value={weekPct ?? '—'}  suffix={weekPct != null ? '%' : undefined}  sub="rolling 7d avg"  color={weekPct != null ? scoreColor(weekPct) : undefined}   barPct={weekPct ?? undefined}  />
        <StatCard label="Month" value={monthPct ?? '—'} suffix={monthPct != null ? '%' : undefined} sub="month-to-date"   color={monthPct != null ? scoreColor(monthPct) : undefined} barPct={monthPct ?? undefined} />
        <StatCard label="Year"  value={yearPct ?? '—'}  suffix={yearPct != null ? '%' : undefined}  sub="year-to-date"    color={yearPct != null ? scoreColor(yearPct) : undefined}   barPct={yearPct ?? undefined}  />
      </div>

      {/* Year spine (xl:+) + calendar */}
      <div className="flex gap-4 items-start">
        <div className="hidden xl:block shrink-0">
          <YearSpine scores={scores} today={todayStrVal} onSelectDay={setSelectedDate} />
        </div>
        <div className="flex-1 min-w-0">
          <div key={navKey} className={navDir === 'right' ? 'cal-slide-right' : 'cal-slide-left'}>
            {view === 'month' && <MonthView currentDate={currentDate} scores={scores} tasksForDate={tasksForDate} habitsForDate={habitsForDate} isTaskDone={isTaskDone} onSelectDay={setSelectedDate} notes={notes} isModalOpen={!!selectedDate} />}
            {view === 'week'  && <WeekView  currentDate={currentDate} scores={scores} tasksForDate={tasksForDate} isTaskDone={isTaskDone} onSelectDay={setSelectedDate} onToggleTask={toggleTask} />}
            {view === 'day'   && <DayDetail date={currentDate} score={scores[currentDate]} tasks={tasksForDate(currentDate)} habits={habitsForDate(currentDate)} isTaskDone={isTaskDone} onToggleTask={toggleTask} onToggleHabit={toggleHabit} note={notes[currentDate]} onSaveNote={saveNote} onAddTask={addTask} onSkipTask={skipTask} onDeleteTask={deleteTask} onSkipHabit={skipHabit} onUpdateTask={updateTask} onReplaceRecurringDay={replaceRecurringDay} onUpdateHabit={updateHabit} />}
          </div>

          {selectedDate && (
            <DayModal date={selectedDate} score={scores[selectedDate]} tasks={tasksForDate(selectedDate)} habits={habitsForDate(selectedDate)} isTaskDone={isTaskDone} onClose={() => setSelectedDate(null)} onToggleTask={toggleTask} onToggleHabit={toggleHabit} note={notes[selectedDate]} onSaveNote={saveNote} onAddTask={addTask} onSkipTask={skipTask} onDeleteTask={deleteTask} onSkipHabit={skipHabit} onUpdateTask={updateTask} onReplaceRecurringDay={replaceRecurringDay} onUpdateHabit={updateHabit} />
          )}
        </div>
      </div>
    </div>
  )
}

// Year spine — Variation B's "year so far" heatmap rail.
// Vertical column of small squares, one per day from Jan 1 → today.
// Opacity = score / 100; missing days render very faint.
function YearSpine({ scores, today: todayStrVal, onSelectDay }: {
  scores: Scores
  today: string
  onSelectDay: (d: string) => void
}) {
  const year = todayStrVal.slice(0, 4)
  const start = `${year}-01-01`
  const days: string[] = []
  let cursor = start
  while (cursor <= todayStrVal) {
    days.push(cursor)
    cursor = addDays(cursor, 1)
  }
  const cell = 8
  const gap = 2
  const cols = Math.ceil(days.length / 30)
  return (
    <div className="flex flex-col gap-2 px-2 py-3 bg-surface-container-low border border-outline-variant/40 rounded-2xl">
      <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/50 px-1">{year}</div>
      <div
        className="grid"
        style={{
          gridAutoFlow: 'column',
          gridTemplateRows: `repeat(30, ${cell}px)`,
          gridAutoColumns: `${cell}px`,
          gap,
        }}
      >
        {days.map(d => {
          const s = scores[d]
          const isToday = d === todayStrVal
          const c = s ? scoreColor(s.pct) : '#cbc3d720'
          const opacity = s ? 0.25 + (s.pct / 100) * 0.75 : 0.15
          return (
            <button
              key={d}
              onClick={() => onSelectDay(d)}
              title={`${d}${s ? ` · ${s.pct}%` : ''}`}
              className={`rounded-[2px] transition-transform ${isToday ? 'ring-1 ring-white/60' : ''}`}
              style={{ width: cell, height: cell, background: c, opacity }}
            />
          )
        })}
      </div>
      <div className="text-[9px] font-medium text-on-surface-variant/40 px-1">{days.length}d</div>
    </div>
  )
}

function MonthView({ currentDate, scores, tasksForDate, habitsForDate, isTaskDone, onSelectDay, notes, isModalOpen }: {
  currentDate: string; scores: Scores
  tasksForDate: (d: string) => Task[]
  habitsForDate: (d: string) => Habit[]
  isTaskDone: (t: Task, date: string) => boolean; onSelectDay: (d: string) => void
  notes: Record<string, string>
  isModalOpen: boolean
}) {
  const d = new Date(currentDate + 'T12:00:00')
  const days = getMonthDays(d.getFullYear(), d.getMonth())
  const todayStr = today()
  const [hover, setHover] = useState<{ date: string; rect: DOMRect; col: number; row: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  return (
    <div className="bg-surface-container rounded-2xl border border-outline-variant/40 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-outline-variant/40">
        {WEEKDAYS.map(wd => (
          <div key={wd} className="py-2.5 text-center text-[10px] font-bold text-on-surface-variant/55 uppercase tracking-[0.12em]">{wd}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map(({ date, isCurrentMonth }, i) => {
          const score = scores[date]
          const dayTasks = tasksForDate(date)
          const dayHabits = habitsForDate(date)
          const dayHabitsDone = dayHabits.filter(h => h.completions.some(c => c.date === date)).length
          const isToday = date === todayStr
          const isFuture = date > todayStr
          const dayNum = new Date(date + 'T12:00:00').getDate()
          const col = i % 7
          const row = Math.floor(i / 7)

          // Quieter cell: dot ribbon (kind-colored), first event title (italic),
          // hairline score at bottom, amber dot for notes.
          const sortedTasks = [...dayTasks].sort((a, b) => {
            if (a.time && b.time) return a.time < b.time ? -1 : 1
            if (a.time) return -1; if (b.time) return 1; return 0
          })
          const sc = score && !isFuture ? scoreColor(score.pct) : null

          return (
            <div key={i} className="relative"
              onMouseEnter={(e) => isCurrentMonth && setHover({ date, rect: (e.currentTarget as HTMLDivElement).getBoundingClientRect(), col, row })}
              onMouseLeave={() => setHover(null)}
            >
              <button onClick={() => onSelectDay(date)}
                className={`group w-full h-[132px] sm:h-[124px] overflow-hidden px-2 pt-2 pb-2 border-b border-r border-outline-variant/30 text-left transition-colors flex flex-col gap-1
                  ${!isCurrentMonth ? 'opacity-30' : ''}
                  hover:bg-violet-500/5`}
              >
                {/* Date row */}
                <div className={`flex items-center justify-between w-full shrink-0 transition-opacity duration-200 ${isModalOpen ? 'opacity-20' : ''}`}>
                  <span className={`tabular-nums leading-none ${
                    isToday
                      ? 'font-display text-[20px] font-bold text-violet-300 drop-shadow-[0_0_10px_rgba(167,139,250,0.55)]'
                      : 'text-[16px] font-medium text-on-surface'
                  }`}>{dayNum}</span>
                  <div className="flex items-center gap-1.5">
                    {notes[date] && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Has note" />}
                    {dayHabits.length > 0 && isCurrentMonth && (
                      <span className={`hidden sm:inline text-[9px] font-semibold tabular-nums leading-none ${
                        dayHabitsDone === dayHabits.length ? 'text-emerald-400' : 'text-on-surface-variant/50'
                      }`}>{dayHabitsDone}/{dayHabits.length}</span>
                    )}
                  </div>
                </div>

                {/* Task pills — kind-colored bordered chips.
                    Mobile (<sm): up to 3 pills, start time only (content-width). Untimed tasks show a tiny kind dot.
                    Tablet+ (sm:): up to 3 pills, time prefix + truncated title (full column width). */}
                {isCurrentMonth && sortedTasks.length > 0 && (
                  <div className={`flex flex-col items-start gap-0.5 min-w-0 max-w-full transition-opacity duration-200 ${isModalOpen ? 'opacity-20' : ''}`}>
                    {sortedTasks.slice(0, 3).map(t => {
                      const k = kindStyle(t.kind)
                      const done = isTaskDone(t, date)
                      const dot = k?.dot ?? '#cbc3d780'
                      return (
                        <div
                          key={t.id}
                          title={`${t.time ? formatTime(t.time) + ' · ' : ''}${t.title}`}
                          className={`flex items-center gap-0.5 max-w-full sm:w-full px-0.5 sm:px-1 py-px rounded-full border text-[7px] sm:text-[10px] leading-tight overflow-hidden ${
                            done ? 'opacity-40 line-through' : ''
                          }`}
                          style={{
                            borderColor: `${dot}55`,
                            background: `${dot}1a`,
                            color: done ? undefined : dot,
                          }}
                        >
                          {t.time ? (
                            <span className="tabular-nums font-bold shrink-0">{shortTime(t.time)}</span>
                          ) : (
                            <span className="sm:hidden w-1 h-1 rounded-full shrink-0" style={{ background: dot }} />
                          )}
                          <span className="hidden sm:block truncate font-medium min-w-0 flex-1">{t.title}</span>
                        </div>
                      )
                    })}
                    {sortedTasks.length > 3 && (
                      <span className="text-[8px] font-semibold text-on-surface-variant/55 leading-none px-0.5">
                        +{sortedTasks.length - 3} more
                      </span>
                    )}
                  </div>
                )}

                {/* Score hairline pinned to bottom */}
                {sc && (
                  <div className={`flex items-center gap-1.5 mt-auto shrink-0 transition-opacity duration-200 ${isModalOpen ? 'opacity-20' : ''}`}>
                    <div className="flex-1 h-[1.5px] rounded-full" style={{ background: sc, opacity: 0.55 }} />
                    <span className="text-[9px] font-bold tabular-nums leading-none whitespace-nowrap" style={{ color: sc }}>{score!.pct}%</span>
                  </div>
                )}
              </button>

            </div>
          )
        })}
      </div>
      {mounted && hover && (() => {
        const popTasks = tasksForDate(hover.date)
        const hasNote = !!notes[hover.date]
        if (popTasks.length === 0 && !hasNote) return null
        const POP_W = 208
        const estH = 60 + popTasks.length * 32 + (hasNote ? 40 : 0)
        const above = hover.row >= 4
        const top = above ? Math.max(8, hover.rect.top - estH - 4) : hover.rect.bottom + 4
        const left = hover.col >= 4
          ? Math.max(8, hover.rect.right - POP_W)
          : Math.min(window.innerWidth - POP_W - 8, hover.rect.left)
        return createPortal(
          <div
            className="glass fixed z-[9999] w-52 rounded-xl p-3 pointer-events-none"
            style={{ top, left }}
          >
            <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">
              {new Date(hover.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
            <div className="space-y-1.5">
              {popTasks.map(task => {
                const done = isTaskDone(task, hover.date)
                const skipped = task.skips?.some(s => s.date === hover.date)
                return (
                  <div key={task.id} className="flex items-start gap-2">
                    <span className={`text-xs mt-0.5 shrink-0 ${skipped ? 'text-amber-400' : done ? 'text-emerald-500' : 'text-on-surface-variant/30'}`}>
                      {skipped ? '⏸' : done ? '✓' : '○'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className={`text-xs font-medium truncate ${done ? 'line-through text-on-surface-variant/40' : 'text-on-surface'}`}>
                        {task.title}
                      </div>
                      {task.time && (
                        <div className="text-[10px] text-violet-400">{formatTime(task.time)}{task.endTime ? ` – ${formatTime(task.endTime)}` : ''}</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            {hasNote && (
              <div className="text-[10px] text-amber-400 mt-2 pt-2 border-t border-outline-variant">
                📝 {notes[hover.date].length > 60 ? notes[hover.date].slice(0, 60) + '…' : notes[hover.date]}
              </div>
            )}
          </div>,
          document.body
        )
      })()}
    </div>
  )
}

function getNowHHMM() {
  const n = new Date()
  return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`
}

function WeekView({ currentDate, scores, tasksForDate, isTaskDone, onSelectDay, onToggleTask }: {
  currentDate: string; scores: Scores
  tasksForDate: (d: string) => Task[]
  isTaskDone: (t: Task, date: string) => boolean; onSelectDay: (d: string) => void
  onToggleTask: (t: Task, date: string) => void
}) {
  const ws = startOfWeek(currentDate)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(ws, i))
  const todayStr = today()
  const [nowTime, setNowTime] = useState(getNowHHMM)

  useEffect(() => {
    const timer = setInterval(() => setNowTime(getNowHHMM()), 60000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="grid grid-cols-7 gap-2">
      {weekDays.map(date => {
        const d = new Date(date + 'T12:00:00')
        const dayTasks = tasksForDate(date)
        const score = scores[date]
        const isToday = date === todayStr
        const isFuture = date > todayStr

        const sorted = [...dayTasks].sort((a, b) => {
          if (a.time && b.time) return a.time < b.time ? -1 : 1
          if (a.time) return -1; if (b.time) return 1; return 0
        })

        // Build task list with "now" line injected for today
        let nowInserted = false
        const items: React.ReactNode[] = []
        for (const task of sorted) {
          if (isToday && !nowInserted && (!task.time || task.time > nowTime)) {
            items.push(
              <div key="now-line" className="flex items-center gap-1 py-0.5 my-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary neon-pulse shrink-0" />
                <div className="flex-1 h-px bg-violet-400/50" />
                <span className="text-[9px] font-bold text-violet-400 shrink-0 tabular-nums">{formatTime(nowTime)}</span>
              </div>
            )
            nowInserted = true
          }
          const done = isTaskDone(task, date)
          const k = kindStyle(task.kind)
          const kdot = k?.dot ?? '#cbc3d780'
          items.push(
            <button key={task.id} onClick={() => onToggleTask(task, date)}
              title={`${task.time ? formatTime(task.time) + ' · ' : ''}${task.title}`}
              className={`w-full text-left text-[7px] sm:text-[10px] px-0.5 sm:px-1 py-1 rounded-md flex flex-col gap-0.5 border overflow-hidden transition-colors ${
                done ? 'opacity-40 line-through' : ''
              }`}
              style={{
                borderColor: `${kdot}55`,
                background: `${kdot}1a`,
                color: done ? undefined : kdot,
              }}
            >
              {task.time ? (
                <span className="tabular-nums font-bold leading-tight shrink-0">{shortTime(task.time)}</span>
              ) : (
                <span className="sm:hidden w-1 h-1 rounded-full shrink-0" style={{ background: kdot }} />
              )}
              <span className="hidden sm:block leading-tight font-medium truncate min-w-0">{task.title}</span>
            </button>
          )
        }
        if (isToday && !nowInserted) {
          items.push(
            <div key="now-line" className="flex items-center gap-1 py-0.5 my-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary neon-pulse shrink-0" />
              <div className="flex-1 h-px bg-violet-400/50" />
              <span className="text-[9px] font-bold text-violet-400 shrink-0 tabular-nums">{formatTime(nowTime)}</span>
            </div>
          )
        }

        return (
          <div key={date} className={`glass rounded-xl border overflow-hidden transition-shadow ${
            isToday ? 'ring-2 ring-violet-400/60 shadow-lg shadow-violet-500/15' : ''
          }`}>
            <button onClick={() => onSelectDay(date)} className={`w-full p-2 text-center border-b flex flex-col items-center ${
              isToday
                ? 'bg-gradient-to-b from-violet-500 to-violet-700 text-white border-violet-600'
                : 'bg-surface-container-high border-outline-variant/40 text-on-surface'
            }`}>
              <div className="text-[10px] font-semibold uppercase tracking-wide opacity-75">{WEEKDAYS[d.getDay()]}</div>
              <div className="text-lg font-bold leading-tight">{d.getDate()}</div>
              {score && !isFuture && (
                <div className={`text-[10px] font-bold mt-0.5 ${isToday ? 'text-violet-200' : 'text-violet-400'}`}>{score.pct}%</div>
              )}
            </button>
            <div className="p-1.5 space-y-0.5">
              {items.length === 0 && <p className="text-[10px] text-on-surface-variant/30 text-center py-2">—</p>}
              {items}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DayDetail({ date, score, tasks, habits, isTaskDone, onToggleTask, onToggleHabit, note, onSaveNote, onAddTask, onSkipTask, onDeleteTask, onSkipHabit, onUpdateTask, onReplaceRecurringDay, onUpdateHabit }: {
  date: string; score?: DayScore; tasks: Task[]; habits: Habit[]
  isTaskDone: (t: Task, date: string) => boolean
  onToggleTask: (t: Task, date: string) => void; onToggleHabit: (id: number, date: string) => void
  note?: string; onSaveNote: (date: string, content: string) => void
  onAddTask: (title: string, date: string, time?: string, endTime?: string) => void
  onSkipTask: (id: number, date: string) => void
  onDeleteTask: (id: number) => void
  onSkipHabit: (id: number, date: string) => void
  onUpdateTask: (id: number, data: Record<string, unknown>) => void
  onReplaceRecurringDay: (task: Task, date: string, data: Record<string, unknown>) => void
  onUpdateHabit: (id: number, data: Record<string, unknown>) => void
}) {
  const d = new Date(date + 'T12:00:00')
  const isToday = date === today()
  const isFuture = date > today()

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl border p-5 flex items-center justify-between">
        <div>
          <div className="text-sm text-on-surface-variant font-medium">{WEEKDAYS[d.getDay()]}</div>
          <div className="text-2xl font-bold text-on-surface">
            {MONTHS[d.getMonth()]} {d.getDate()}, {d.getFullYear()}
            {isToday && <span className="ml-2 text-sm font-semibold text-violet-600 bg-violet-500/20 px-2 py-0.5 rounded-full">Today</span>}
          </div>
        </div>
        {score && !isFuture ? (
          <DayScoreWheel score={score} />
        ) : (
          <div className="text-on-surface-variant/30 text-sm">{isFuture ? 'Future' : 'Nothing scheduled'}</div>
        )}
      </div>
      <QuickAddTask date={date} onAdd={onAddTask} />
      <DayContent date={date} tasks={tasks} habits={habits} isTaskDone={isTaskDone} onToggleTask={onToggleTask} onToggleHabit={onToggleHabit} onSkipTask={onSkipTask} onDeleteTask={onDeleteTask} onSkipHabit={onSkipHabit} onUpdateTask={onUpdateTask} onReplaceRecurringDay={onReplaceRecurringDay} onUpdateHabit={onUpdateHabit} />
      <NoteEditor date={date} note={note || ''} onSave={onSaveNote} />
    </div>
  )
}

// Medium-sized wheel for day detail / modal headers
function DayScoreWheel({ score }: { score: DayScore }) {
  const { arc, display } = useWheelAnim(score.pct, 900)
  const r = 15.9, circ = 2 * Math.PI * r
  const fill = (arc / 100) * circ
  const color = wheelColor(score.pct)
  const animCompleted = score.pct > 0 ? Math.round((display / score.pct) * score.completed) : 0
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-16 h-16">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r={r} fill="none" className="stroke-outline-variant/40" strokeWidth="3" />
          <circle cx="18" cy="18" r={r} fill="none" stroke={wheelGrad(score.pct)} strokeWidth="3"
            strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-bold leading-none" style={{ color }}>{display}%</span>
          <span className="text-[9px] text-on-surface-variant mt-0.5">{animCompleted}/{score.total}</span>
        </div>
      </div>
    </div>
  )
}

function DayTaskEditForm({ task, onSave, onCancel }: { task: Task; onSave: (data: Record<string, unknown>) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [startTime, setStartTime] = useState(task.time ?? '')
  const [endTime, setEndTime] = useState(task.endTime ?? '')
  const [kind, setKind] = useState<Kind | null>((task.kind as Kind | null) ?? null)

  return (
    <div className="px-4 py-3 bg-violet-500/10 space-y-2.5">
      <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Task name"
        className="w-full text-sm px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-low text-on-surface outline-none focus:border-violet-500" />
      <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)"
        className="w-full text-sm px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-low text-on-surface outline-none focus:border-violet-500" />
      <div className="flex items-end gap-2 flex-wrap">
        <TimePickerInput value={startTime} onChange={setStartTime} label="Start" />
        <span className="text-on-surface-variant/30 text-xs pb-2.5">→</span>
        <TimePickerInput value={endTime} onChange={setEndTime} label="End" />
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/60 mb-1.5">Kind</div>
        <KindPicker value={kind} onChange={setKind} size="sm" />
      </div>
      <div className="flex gap-2">
        <button onClick={() => onSave({ title: title.trim(), description: description.trim() || null, time: startTime || null, endTime: endTime || null, kind })}
          disabled={!title.trim()}
          className="px-3 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40 transition-colors">
          Save
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-on-surface-variant/60 hover:text-on-surface-variant transition-colors">Cancel</button>
      </div>
    </div>
  )
}

function DayHabitEditForm({ habit, onSave, onCancel }: { habit: Habit; onSave: (data: Record<string, unknown>) => void; onCancel: () => void }) {
  const [name, setName] = useState(habit.name)
  const [description, setDescription] = useState(habit.description ?? '')

  return (
    <div className="px-4 py-3 bg-violet-50/60 space-y-2.5">
      <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Habit name"
        className="w-full text-sm px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-low text-on-surface outline-none focus:border-violet-500" />
      <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)"
        className="w-full text-sm px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-low text-on-surface outline-none focus:border-violet-500" />
      <div className="flex gap-2">
        <button onClick={() => onSave({ name: name.trim(), description: description.trim() || null })}
          disabled={!name.trim()}
          className="px-3 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40 transition-colors">
          Save
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-on-surface-variant/60 hover:text-on-surface-variant transition-colors">Cancel</button>
      </div>
    </div>
  )
}

type EditState =
  | { type: 'task'; task: Task; scope: 'choose' | 'all' | 'day' }
  | { type: 'habit'; habit: Habit }

function DayContent({ date, tasks, habits, isTaskDone, onToggleTask, onToggleHabit, onSkipTask, onDeleteTask, onSkipHabit, onUpdateTask, onReplaceRecurringDay, onUpdateHabit }: {
  date: string; tasks: Task[]; habits: Habit[]
  isTaskDone: (t: Task, date: string) => boolean
  onToggleTask: (t: Task, date: string) => void; onToggleHabit: (id: number, date: string) => void
  onSkipTask: (id: number, date: string) => void
  onDeleteTask: (id: number) => void
  onSkipHabit: (id: number, date: string) => void
  onUpdateTask: (id: number, data: Record<string, unknown>) => void
  onReplaceRecurringDay: (task: Task, date: string, data: Record<string, unknown>) => void
  onUpdateHabit: (id: number, data: Record<string, unknown>) => void
}) {
  const [editState, setEditState] = useState<EditState | null>(null)
  const [burstIds, setBurstIds] = useState<Set<number>>(new Set())
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  function triggerBurst(id: number) {
    setBurstIds(prev => new Set(Array.from(prev).concat(id)))
    setTimeout(() => setBurstIds(prev => { const n = new Set(prev); n.delete(id); return n }), 520)
  }

  function startEditTask(task: Task) {
    setEditState(task.recurringType
      ? { type: 'task', task, scope: 'choose' }
      : { type: 'task', task, scope: 'all' }
    )
  }
  function startEditHabit(habit: Habit) {
    setEditState({ type: 'habit', habit })
  }

  function handleTaskSave(data: Record<string, unknown>) {
    if (!editState || editState.type !== 'task') return
    if (editState.scope === 'all') onUpdateTask(editState.task.id, data)
    else onReplaceRecurringDay(editState.task, date, data)
    setEditState(null)
  }
  function handleHabitSave(data: Record<string, unknown>) {
    if (!editState || editState.type !== 'habit') return
    onUpdateHabit(editState.habit.id, data)
    setEditState(null)
  }

  return (
    <>
      <div className="glass card-lift rounded-2xl border overflow-hidden">
        <div className="px-4 py-3 border-b border-outline-variant/40 flex items-center justify-between">
          <h3 className="font-semibold text-on-surface">Tasks</h3>
          <span className="text-xs text-on-surface-variant">{tasks.filter(t => isTaskDone(t, date)).length}/{tasks.length} done</span>
        </div>
        {tasks.length === 0 ? (
          <p className="px-4 py-6 text-sm text-on-surface-variant text-center">No tasks this day</p>
        ) : (
          <div className="divide-y divide-outline-variant/40">
            {tasks.map(task => {
              const isEditing = editState?.type === 'task' && editState.task.id === task.id
              if (isEditing && editState.type === 'task') {
                if (editState.scope === 'choose') {
                  return (
                    <div key={task.id} className="px-4 py-3 space-y-2 bg-violet-50/60">
                      <p className="text-xs font-semibold text-on-surface-variant">This is a recurring task. What would you like to edit?</p>
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={() => setEditState({ type: 'task', task, scope: 'all' })}
                          className="px-3 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors">
                          All occurrences
                        </button>
                        <button onClick={() => setEditState({ type: 'task', task, scope: 'day' })}
                          className="px-3 py-1.5 text-xs font-semibold bg-surface-container border border-outline-variant text-on-surface rounded-lg hover:bg-surface-container-lowest transition-colors">
                          Just {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </button>
                        <button onClick={() => setEditState(null)}
                          className="px-3 py-1.5 text-xs text-on-surface-variant/60 hover:text-on-surface-variant transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )
                }
                return (
                  <DayTaskEditForm key={task.id} task={task} onSave={handleTaskSave} onCancel={() => setEditState(null)} />
                )
              }

              const done = isTaskDone(task, date)
              const skipped = task.skips?.some(s => s.date === date)
              return (
                <div key={task.id} className={`flex items-start gap-3 px-4 py-3 group transition-colors ${skipped ? 'bg-amber-500/10' : 'hover:bg-surface-container-low'}`}>
                  <button onClick={() => { if (!skipped) { if (!done) triggerBurst(task.id); onToggleTask(task, date) } }} disabled={!!skipped}
                    className={`relative mt-0.5 text-lg leading-none shrink-0 ${skipped ? 'text-amber-300 cursor-not-allowed' : done ? 'text-emerald-500' : 'text-on-surface-variant/30 hover:text-violet-400'}`}>
                    {skipped ? '⏸' : done ? '✓' : '○'}
                    {burstIds.has(task.id) && (
                      <span className="burst-ring absolute inset-[-6px] rounded-full border-2 border-emerald-400" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-medium ${skipped ? 'text-on-surface-variant' : done ? 'line-through text-on-surface-variant/40' : 'text-on-surface'}`}>{task.title}</div>
                    {task.description && <div className="text-xs text-on-surface-variant mt-0.5 truncate">{task.description}</div>}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {skipped && <span className="text-[10px] font-semibold text-amber-400">Skipped today</span>}
                      {!skipped && <KindChip kind={task.kind} size="sm" />}
                      {!skipped && task.time && (
                        <span className="text-[10px] text-on-surface-variant">
                          ⏰ {formatTime(task.time)}{task.endTime ? ` – ${formatTime(task.endTime)}` : ''}
                        </span>
                      )}
                      {!skipped && task.recurringType && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{ color: 'var(--c-p-hex)', backgroundColor: 'rgba(var(--c-p), 0.10)' }}>
                          🔄 {recurringLabel(task.recurringType, task.recurringDays)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => startEditTask(task)} className="p-1.5 rounded-lg text-xs text-on-surface-variant/30 hover:text-violet-500 hover:bg-violet-500/10 transition-all">✏</button>
                    <button onClick={() => onSkipTask(task.id, date)} title={skipped ? 'Undo skip' : 'Skip today'}
                      className={`p-1.5 rounded-lg text-xs transition-all ${skipped ? 'text-amber-500 opacity-100' : 'text-on-surface-variant/30 hover:text-amber-500 hover:bg-amber-500/15'}`}>⏸</button>
                    {confirmDeleteId === task.id ? (
                      <>
                        <button onClick={() => { onDeleteTask(task.id); setConfirmDeleteId(null) }} className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-rose-500 text-white hover:bg-rose-600 transition-colors">Delete</button>
                        <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-1 rounded-lg text-[10px] font-semibold text-on-surface-variant/60 hover:text-on-surface-variant transition-colors">Cancel</button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(task.id)} className="w-8 h-8 flex items-center justify-center rounded-xl text-sm font-bold text-on-surface-variant hover:text-rose-500 hover:bg-rose-500/15 transition-all">✕</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="glass card-lift rounded-2xl border overflow-hidden">
        <div className="px-4 py-3 border-b border-outline-variant/40 flex items-center justify-between">
          <h3 className="font-semibold text-on-surface">Habits</h3>
          <span className="text-xs text-on-surface-variant">{habits.filter(h => h.completions.some(c => c.date === date)).length}/{habits.length} done</span>
        </div>
        {habits.length === 0 ? (
          <p className="px-4 py-6 text-sm text-on-surface-variant text-center">No habits scheduled this day</p>
        ) : (
          <div className="divide-y divide-outline-variant/40">
            {habits.map(habit => {
              const isEditingHabit = editState?.type === 'habit' && editState.habit.id === habit.id
              if (isEditingHabit && editState.type === 'habit') {
                return <DayHabitEditForm key={habit.id} habit={habit} onSave={handleHabitSave} onCancel={() => setEditState(null)} />
              }
              const done = habit.completions.some(c => c.date === date)
              const skipped = habit.skips?.some(s => s.date === date)
              return (
                <div key={habit.id} className={`flex items-center gap-3 px-4 py-3 group transition-colors ${skipped ? 'bg-amber-500/10' : 'hover:bg-surface-container-low'}`}>
                  <button onClick={() => { if (!skipped) { if (!done) triggerBurst(habit.id + 100000); onToggleHabit(habit.id, date) } }} disabled={!!skipped}
                    className={`relative text-lg leading-none shrink-0 ${skipped ? 'text-amber-300 cursor-not-allowed' : done ? 'text-emerald-500' : 'text-on-surface-variant/30 hover:text-emerald-400'}`}>
                    {skipped ? '⏸' : done ? '✓' : '○'}
                    {burstIds.has(habit.id + 100000) && (
                      <span className="burst-ring absolute inset-[-6px] rounded-full border-2 border-emerald-400" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-medium ${skipped ? 'text-on-surface-variant' : done ? 'text-emerald-400' : 'text-on-surface'}`}>{habit.name}</div>
                    {skipped && <div className="text-[10px] font-semibold text-amber-400 mt-0.5">Skipped today</div>}
                    {habit.description && !skipped && <div className="text-xs text-on-surface-variant mt-0.5">{habit.description}</div>}
                  </div>
                  <div className="flex gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => startEditHabit(habit)} className="p-1.5 rounded-lg text-xs text-on-surface-variant/30 hover:text-violet-500 hover:bg-violet-500/10 transition-all">✏</button>
                    <button onClick={() => onSkipHabit(habit.id, date)} title={skipped ? 'Undo skip' : 'Skip today'}
                      className={`p-1.5 rounded-lg text-xs transition-all ${skipped ? 'text-amber-500 opacity-100' : 'text-on-surface-variant/30 hover:text-amber-500 hover:bg-amber-500/15'}`}>⏸</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

function NoteEditor({ date, note, onSave }: { date: string; note: string; onSave: (date: string, content: string) => Promise<void> | void }) {
  const [value, setValue] = useState(note)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedValue = useRef(note)
  useEffect(() => { setValue(note); savedValue.current = note }, [note])

  async function doSave(val: string) {
    setSaveStatus('saving')
    await onSave(date, val)
    savedValue.current = val
    setSaveStatus('saved')
    if (statusTimer.current) clearTimeout(statusTimer.current)
    statusTimer.current = setTimeout(() => setSaveStatus('idle'), 2000)
  }

  function handleChange(val: string) {
    setValue(val)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      if (val !== savedValue.current) doSave(val)
    }, 800)
  }

  async function handleBlur() {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    if (value !== savedValue.current) await doSave(value)
  }

  return (
    <div className="glass card-lift rounded-2xl border overflow-hidden">
      <div className="px-4 py-3 border-b border-outline-variant/40 flex items-center gap-2">
        <span className="text-amber-400 text-sm">📝</span>
        <h3 className="font-semibold text-on-surface text-sm">Note</h3>
        <span className="ml-auto text-[10px] font-medium transition-colors">
          {saveStatus === 'saving' && <span className="text-on-surface-variant">Saving…</span>}
          {saveStatus === 'saved'  && <span className="text-emerald-500">Saved ✓</span>}
        </span>
      </div>
      <textarea
        value={value}
        onChange={e => handleChange(e.target.value)}
        onBlur={handleBlur}
        placeholder="Add a note for this day..."
        rows={3}
        className="w-full px-4 py-3 text-sm text-on-surface bg-transparent placeholder-white/70 resize-none outline-none"
      />
    </div>
  )
}

// Time picker: HH | : | MM inputs in one border + AM/PM toggle. Works on mobile numeric keyboard.
function TimePickerInput({ value, onChange, label }: { value: string; onChange: (hhmm: string) => void; label: string }) {
  function parse(hhmm: string): { h: string; m: string; ap: 'AM' | 'PM' } {
    if (!hhmm) return { h: '', m: '', ap: 'AM' }
    const [hh, mm] = hhmm.split(':').map(Number)
    const ap: 'AM' | 'PM' = hh >= 12 ? 'PM' : 'AM'
    const h12 = hh % 12 || 12
    return { h: String(h12).padStart(2, '0'), m: String(mm).padStart(2, '0'), ap }
  }
  const init = parse(value)
  const [h, setH] = useState(init.h)
  const [m, setM] = useState(init.m)
  const [ap, setAp] = useState<'AM' | 'PM'>(init.ap)
  const hourRef = useRef<HTMLInputElement>(null)
  const minRef = useRef<HTMLInputElement>(null)

  useEffect(() => { const p = parse(value); setH(p.h); setM(p.m); setAp(p.ap) }, [value])

  function commit(hours: string, mins: string, meridiem: 'AM' | 'PM') {
    if (hours.length < 2 || mins.length < 2) { onChange(''); return }
    let hh = parseInt(hours), mm = parseInt(mins)
    if (isNaN(hh) || isNaN(mm) || hh < 1 || hh > 12 || mm > 59) { onChange(''); return }
    if (meridiem === 'PM' && hh !== 12) hh += 12
    if (meridiem === 'AM' && hh === 12) hh = 0
    onChange(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`)
  }

  function handleHour(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2)
    const shouldAutoAdvance = val.length === 2 || (val.length === 1 && parseInt(val) >= 2)
    if (shouldAutoAdvance && val.length === 1) {
      const padded = '0' + val
      setH(padded)
      commit(padded, m, ap)
      minRef.current?.focus(); minRef.current?.select()
    } else {
      setH(val)
      commit(val, m, ap)
      if (val.length === 2) { minRef.current?.focus(); minRef.current?.select() }
    }
  }

  function handleMin(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2)
    setM(val); commit(h, val, ap)
  }

  function handleMinKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && m === '') {
      e.preventDefault()
      hourRef.current?.focus()
      hourRef.current?.setSelectionRange(2, 2)
    }
  }

  function toggleAp() {
    const next: 'AM' | 'PM' = ap === 'AM' ? 'PM' : 'AM'
    setAp(next); commit(h, m, next)
  }

  const fieldCls = "w-7 text-sm py-2 bg-transparent text-on-surface placeholder-white/70 outline-none text-center font-mono"

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold text-on-surface-variant text-center">{label}</span>
      <div className="flex items-center gap-1">
        <div className="flex items-center px-1 rounded-xl border border-outline-variant bg-surface-container-lowest focus-within:border-violet-500 transition-colors">
          <input ref={hourRef} type="text" inputMode="numeric" value={h} onChange={handleHour}
            placeholder="--" className={fieldCls} />
          <span className="text-on-surface-variant font-bold text-sm select-none">:</span>
          <input ref={minRef} type="text" inputMode="numeric" value={m} onChange={handleMin}
            onKeyDown={handleMinKeyDown} placeholder="--" className={fieldCls} />
        </div>
        <button type="button" onClick={toggleAp}
          className="text-[11px] font-bold px-1.5 py-2 rounded-xl border border-outline-variant bg-surface-container-lowest text-violet-400 hover:bg-violet-500/10 transition-colors w-10 text-center">
          {ap}
        </button>
      </div>
    </div>
  )
}

function QuickAddTask({ date, onAdd }: { date: string; onAdd: (title: string, date: string, time?: string, endTime?: string) => void }) {
  const [value, setValue] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!value.trim()) return
    setLoading(true)
    await onAdd(value.trim(), date, startTime || undefined, endTime || undefined)
    setValue(''); setStartTime(''); setEndTime('')
    setLoading(false)
  }

  return (
    <form onSubmit={submit} className="glass card-lift rounded-2xl border overflow-hidden">
      <div className="px-4 py-3 border-b border-outline-variant/40">
        <h3 className="font-semibold text-on-surface text-sm">Add Task</h3>
      </div>
      <div className="p-3 space-y-2">
        <input type="text" value={value} onChange={e => setValue(e.target.value)} placeholder="Task name..."
          className="w-full text-sm px-3 py-2 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface placeholder-white/70 outline-none focus:border-violet-500 transition-colors" />
        <div className="flex items-end gap-2">
          <TimePickerInput value={startTime} onChange={setStartTime} label="Start" />
          <span className="text-on-surface-variant/30 text-xs pb-2.5">→</span>
          <TimePickerInput value={endTime} onChange={setEndTime} label="End" />
          <button type="submit" disabled={!value.trim() || loading}
            className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0">
            {loading ? '…' : 'Add'}
          </button>
        </div>
      </div>
    </form>
  )
}

function DayModal({ date, score, tasks, habits, isTaskDone, onClose, onToggleTask, onToggleHabit, note, onSaveNote, onAddTask, onSkipTask, onDeleteTask, onSkipHabit, onUpdateTask, onReplaceRecurringDay, onUpdateHabit }: {
  date: string; score?: DayScore; tasks: Task[]; habits: Habit[]
  isTaskDone: (t: Task, date: string) => boolean; onClose: () => void
  onToggleTask: (t: Task, date: string) => void; onToggleHabit: (id: number, date: string) => void
  note?: string; onSaveNote: (date: string, content: string) => void
  onAddTask: (title: string, date: string, time?: string, endTime?: string) => void
  onSkipTask: (id: number, date: string) => void
  onDeleteTask: (id: number) => void
  onSkipHabit: (id: number, date: string) => void
  onUpdateTask: (id: number, data: Record<string, unknown>) => void
  onReplaceRecurringDay: (task: Task, date: string, data: Record<string, unknown>) => void
  onUpdateHabit: (id: number, data: Record<string, unknown>) => void
}) {
  const d = new Date(date + 'T12:00:00')
  const isToday = date === today()
  const isFuture = date > today()
  return (
    <div className="fixed inset-0 bg-black/20 z-[999] flex items-end sm:items-start justify-center p-0 sm:p-4 sm:pt-24"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="glass rounded-t-2xl sm:rounded-2xl border w-full sm:max-w-lg max-h-[90vh] sm:max-h-[calc(100vh-7rem)] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/40">
          <div>
            <div className="text-xs text-on-surface-variant font-medium uppercase tracking-wide">{WEEKDAYS[d.getDay()]}</div>
            <div className="font-bold text-on-surface">
              {MONTHS[d.getMonth()]} {d.getDate()}, {d.getFullYear()}
              {isToday && <span className="ml-2 text-xs font-semibold text-violet-600 bg-violet-500/20 px-2 py-0.5 rounded-full">Today</span>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {score && !isFuture && <DayScoreWheel score={score} />}
            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl text-base font-bold text-on-surface-variant bg-surface-container hover:text-rose-500 hover:bg-rose-500/15 transition-colors">✕</button>
          </div>
        </div>
        <div className="overflow-y-auto p-4 space-y-4 flex-1">
          <QuickAddTask date={date} onAdd={onAddTask} />
          <DayContent date={date} tasks={tasks} habits={habits} isTaskDone={isTaskDone} onToggleTask={onToggleTask} onToggleHabit={onToggleHabit} onSkipTask={onSkipTask} onDeleteTask={onDeleteTask} onSkipHabit={onSkipHabit} onUpdateTask={onUpdateTask} onReplaceRecurringDay={onReplaceRecurringDay} onUpdateHabit={onUpdateHabit} />
          <NoteEditor date={date} note={note || ''} onSave={onSaveNote} />
        </div>
      </div>
    </div>
  )
}
