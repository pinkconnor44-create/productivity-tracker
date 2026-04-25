'use client'
import { useState, useEffect, useCallback } from 'react'
import { isHabitActiveOnDate } from '@/lib/recurring'
import { toast } from '@/lib/toast'

type HabitCompletion = { id: number; habitId: number; date: string }
type Habit = {
  id: number; name: string; description?: string; active: boolean
  recurringDays?: string; weight: number; createdAt: string
  completions: HabitCompletion[]; skips: { date: string }[]
}

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const SCHEDULE_PRESETS = [
  { label: 'Every day', value: null as string|null },
  { label: 'Weekdays',  value: '1,2,3,4,5' },
  { label: 'Weekends',  value: '0,6' },
  { label: 'Custom',    value: 'custom' },
]
const W_BORDER = ['','border-l-slate-200 dark:border-l-white/[0.06]','border-l-blue-400','border-l-orange-400']
const W_LABEL  = ['','Normal','Important','Critical']
const W_COLOR  = ['','text-slate-600 dark:text-slate-300','text-blue-500','text-orange-500']

function today(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`
}
function addDays(s: string, n: number): string {
  const d = new Date(s+'T12:00:00'); d.setDate(d.getDate()+n)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function scheduleLabel(r?: string|null): string {
  if (!r) return 'Every day'
  if (r==='1,2,3,4,5') return 'Weekdays'
  if (r==='0,6') return 'Weekends'
  return r.split(',').map(Number).map(d=>DAY_NAMES[d]).join(', ')
}
function calcStreak(completions: HabitCompletion[], skips: {date:string}[], recurringDays?: string|null): number {
  const doneDates = new Set(completions.map(c => c.date))
  const skipDates = new Set(skips.map(s => s.date))
  let streak = 0
  let check = today()
  // If nothing today, start from yesterday
  if (!doneDates.has(check) && !skipDates.has(check)) check = addDays(check, -1)
  for (let i = 0; i < 400; i++) {
    // Skip days where this habit isn't scheduled
    if (!isHabitActiveOnDate({ recurringDays }, check)) { check = addDays(check, -1); continue }
    if (doneDates.has(check)) { streak++; check = addDays(check, -1) }
    else if (skipDates.has(check)) { check = addDays(check, -1) } // excused — don't break streak
    else break // scheduled, not done, not excused — streak ends
  }
  return streak
}
function countInWindow(completions: HabitCompletion[], recurringDays: string|null|undefined, windowDays: number, habitStart?: string): { done: number; scheduled: number } {
  const t = today()
  const windowStart = addDays(t, -(windowDays - 1))
  const start = habitStart && habitStart > windowStart ? habitStart : windowStart
  let scheduled = 0, done = 0, cursor = start
  while (cursor <= t) {
    if (isHabitActiveOnDate({ recurringDays }, cursor)) {
      scheduled++
      if (completions.some(c => c.date === cursor)) done++
    }
    cursor = addDays(cursor, 1)
  }
  return { done, scheduled }
}
function blankForm() {
  return { name:'', description:'', schedulePreset:null as string|null, customDays:[] as number[], weight:1 }
}
function parseSchedule(recurringDays?: string|null): { preset: string|null; customDays: number[] } {
  if (!recurringDays) return { preset: null, customDays: [] }
  if (recurringDays === '1,2,3,4,5') return { preset: '1,2,3,4,5', customDays: [] }
  if (recurringDays === '0,6') return { preset: '0,6', customDays: [] }
  return { preset: 'custom', customDays: recurringDays.split(',').map(Number) }
}

const card = 'glass rounded-2xl border overflow-hidden'

function WeightPicker({ value, onChange }: { value: number; onChange: (w: number) => void }) {
  const labels = ['','Normal (×1)','Important (×2)','Critical (×3)']
  const descriptions = ['','Counts once toward daily score','Counts twice toward daily score','Counts three times toward daily score']
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">Weight</span>
        <div className="flex bg-slate-100 dark:bg-white/[0.05] rounded-lg p-0.5 gap-0.5">
          {[1,2,3].map(w => (
            <button key={w} type="button" onClick={() => onChange(w)} title={labels[w]}
              className={`w-6 h-5 rounded-md text-[11px] font-bold transition-all ${
                value === w
                  ? w === 1 ? 'bg-white dark:bg-white/10 text-slate-500 shadow-sm'
                  : w === 2 ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-orange-500 text-white shadow-sm'
                  : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'
              }`}>{w}</button>
          ))}
        </div>
      </div>
      <span className="text-[10px] text-slate-300 dark:text-slate-600">{descriptions[value]}</span>
    </div>
  )
}

export default function HabitsView() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(blankForm())
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null)

  const todayStr = today()
  const fetchHabits = useCallback(async () => {
    const res = await fetch('/api/habits')
    if (res.ok) setHabits(await res.json())
    setLoading(false)
  }, [])
  useEffect(() => { fetchHabits() }, [fetchHabits])

  function setField<K extends keyof ReturnType<typeof blankForm>>(k: K, v: ReturnType<typeof blankForm>[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }
  function toggleCustomDay(d: number) {
    setForm(f => ({ ...f, customDays: f.customDays.includes(d) ? f.customDays.filter(x=>x!==d) : [...f.customDays,d].sort() }))
  }
  function resolvedRecurringDays(): string|null {
    if (form.schedulePreset===null) return null
    if (form.schedulePreset==='custom') return form.customDays.length>0 ? form.customDays.join(',') : null
    return form.schedulePreset
  }
  async function createHabit(e: React.FormEvent) {
    e.preventDefault(); if (!form.name.trim()) return
    if (form.schedulePreset === 'custom' && form.customDays.length === 0) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/habits',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name:form.name, description:form.description, recurringDays:resolvedRecurringDays(), weight:form.weight, startDate:todayStr }) })
      if (!res.ok) throw new Error()
      toast('Habit added', 'info')
      setForm(blankForm()); setShowForm(false); fetchHabits()
    } catch { toast('Failed to add habit', 'warning') }
    setSubmitting(false)
  }
  async function toggleToday(habitId: number) {
    try {
      const res = await fetch('/api/habit-completions',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ habitId, date:todayStr }) })
      if (!res.ok) throw new Error()
      fetchHabits()
      window.dispatchEvent(new Event('score-refresh'))
    } catch { toast('Failed to update habit', 'warning') }
  }
  async function deleteHabit(id: number) {
    try {
      const res = await fetch(`/api/habits/${id}`,{ method:'DELETE' })
      if (!res.ok) throw new Error()
      toast('Habit deleted', 'warning')
      fetchHabits()
    } catch { toast('Failed to delete habit', 'warning') }
  }
  async function skipHabit(habitId: number) {
    try {
      const res = await fetch('/api/habit-skips', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ habitId, date:todayStr }) })
      if (!res.ok) throw new Error()
      fetchHabits()
    } catch { toast('Failed to update habit', 'warning') }
  }
  async function saveHabit(id: number, data: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/habits/${id}`,{ method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) })
      if (!res.ok) throw new Error()
      setEditingId(null); fetchHabits()
    } catch { toast('Failed to save habit', 'warning') }
  }

  const activeToday = habits.filter(h => isHabitActiveOnDate(h, todayStr))
  const notToday    = habits.filter(h => !isHabitActiveOnDate(h, todayStr))

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-4">

      {/* Add habit */}
      {!showForm ? (
        <button onClick={() => setShowForm(true)}
          className="w-full flex items-center gap-2.5 px-4 py-3.5 bg-white dark:bg-[#16161e] border border-dashed border-slate-200 dark:border-white/[0.1] rounded-2xl text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:border-violet-300 dark:hover:border-violet-500/50 transition-all text-sm font-medium group">
          <span className="w-5 h-5 rounded-md border-2 border-slate-200 dark:border-violet-700 flex items-center justify-center text-slate-300 dark:text-slate-600 group-hover:border-violet-400 group-hover:text-violet-400 transition-colors text-xs font-bold">+</span>
          New habit
        </button>
      ) : (
        <form onSubmit={createHabit} className="glass rounded-2xl border p-4 space-y-3">
          <input autoFocus type="text" placeholder="Habit name (e.g. Workout, Read, Meditate)" value={form.name}
            onChange={e => setField('name',e.target.value)}
            className="w-full text-sm font-medium bg-transparent border-0 outline-none text-slate-800 dark:text-slate-100 placeholder-white/70 p-0" />
          <input type="text" placeholder="Description (optional)" value={form.description}
            onChange={e => setField('description',e.target.value)}
            className="w-full text-sm bg-transparent border-0 outline-none text-slate-600 dark:text-slate-300 placeholder-white/70 p-0" />
          <div className="border-t border-slate-50 dark:border-violet-700 pt-2 space-y-2">
            <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Schedule</p>
            <div className="flex flex-wrap gap-1">
              {SCHEDULE_PRESETS.map(p => (
                <button key={String(p.value)} type="button" onClick={() => setField('schedulePreset',p.value)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                    form.schedulePreset===p.value ? 'bg-violet-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                  }`}>{p.label}</button>
              ))}
            </div>
            {form.schedulePreset==='custom' && (
              <>
                <div className="flex gap-1">
                  {DAY_NAMES.map((d,i) => (
                    <button key={i} type="button" onClick={() => toggleCustomDay(i)}
                      className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-colors ${form.customDays.includes(i) ? 'bg-violet-600 text-white' : 'bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300'}`}>
                      {d[0]}
                    </button>
                  ))}
                </div>
                {form.customDays.length === 0 && (
                  <p className="text-[10px] text-amber-500 dark:text-amber-400">Select at least one day.</p>
                )}
              </>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-slate-50 dark:border-violet-700 pt-2">
            <WeightPicker value={form.weight} onChange={v => setField('weight',v)} />
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowForm(false); setForm(blankForm()) }}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-all">Cancel</button>
              <button type="submit" disabled={!form.name.trim()||submitting||(form.schedulePreset==='custom'&&form.customDays.length===0)}
                className="px-3 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40 transition-colors shadow-sm">Add Habit</button>
            </div>
          </div>
        </form>
      )}

      {/* Habit list */}
      {habits.length === 0 ? (
        <div className="text-center py-16 text-slate-600 dark:text-slate-300">
          <div className="w-14 h-14 bg-white dark:bg-[#16161e] rounded-2xl border border-slate-100 dark:border-violet-700 flex items-center justify-center mx-auto mb-4 text-2xl shadow-sm">🔄</div>
          <p className="font-semibold text-slate-600 dark:text-slate-400">No habits yet</p>
          <p className="text-sm mt-1">Build your routine by adding your first habit.</p>
        </div>
      ) : (
        <>
          {activeToday.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Today's Habits</span>
                <span className="ml-auto text-[10px] text-slate-600 dark:text-slate-300 font-medium">{activeToday.filter(h => h.completions.some(c => c.date===todayStr)).length}/{activeToday.length}</span>
              </div>
              <div className={card}>
                <div className="divide-y divide-slate-50 dark:divide-white/[0.04]">
                  {activeToday.map(habit =>
                    editingId === habit.id
                      ? <InlineHabitEditor key={habit.id} habit={habit} onSave={saveHabit} onCancel={() => setEditingId(null)} />
                      : <HabitRow key={habit.id} habit={habit} date={todayStr} onToggle={toggleToday} onDelete={deleteHabit} onEdit={() => setEditingId(habit.id)} onSkip={() => skipHabit(habit.id)} skipped={habit.skips?.some(s => s.date===todayStr)} onSelect={() => setSelectedHabit(habit)} />
                  )}
                </div>
              </div>
            </div>
          )}

          {notToday.length > 0 && (
            <div className="opacity-50">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Not Today</span>
              </div>
              <div className={card}>
                <div className="divide-y divide-slate-50 dark:divide-white/[0.04]">
                  {notToday.map(habit =>
                    editingId === habit.id
                      ? <InlineHabitEditor key={habit.id} habit={habit} onSave={saveHabit} onCancel={() => setEditingId(null)} />
                      : (
                        <div key={habit.id} className="flex items-center gap-3 pl-0 pr-4 py-3 group hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors border-l-[3px] border-l-transparent">
                          <div className="ml-4 shrink-0 w-7 h-7 rounded-xl border-2 border-slate-100 dark:border-violet-700 flex items-center justify-center text-slate-300 dark:text-slate-600 text-xs">—</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-600 dark:text-slate-300">{habit.name}</div>
                            <div className="text-[10px] text-slate-600 dark:text-slate-300 mt-0.5">{scheduleLabel(habit.recurringDays)}</div>
                          </div>
                          <AllHabitsRowActions onEdit={() => setEditingId(habit.id)} onDelete={() => deleteHabit(habit.id)} />
                        </div>
                      )
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {habits.length > 0 && (
        <div className="bg-white dark:bg-[#16161e] rounded-2xl border border-slate-100 dark:border-violet-700 p-4 text-xs text-slate-600 dark:text-slate-300">
          <p className="font-semibold text-slate-600 dark:text-slate-300 mb-1">How scoring works</p>
          <p className="leading-relaxed">Each task and habit counts toward your score by its weight (1–3). Your score is the % of weighted points earned vs. scheduled.</p>
        </div>
      )}

      {selectedHabit && (
        <HabitDetailModal habit={selectedHabit} onClose={() => setSelectedHabit(null)} />
      )}
    </div>
  )
}

function HabitRow({ habit, date, onToggle, onDelete, onEdit, onSkip, onSelect, skipped }: {
  habit: Habit; date: string
  onToggle: (id: number) => void; onDelete: (id: number) => void; onEdit: () => void
  onSkip?: () => void; onSelect: () => void; skipped?: boolean
}) {
  const [confirming, setConfirming] = useState(false)
  const streak = calcStreak(habit.completions, habit.skips ?? [], habit.recurringDays)
  const w = habit.weight ?? 1
  return (
    <div className={`flex items-center gap-3 pl-0 pr-4 py-3 group transition-colors border-l-[3px] ${W_BORDER[w]} ${skipped ? 'bg-amber-50/60 dark:bg-amber-900/10' : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'}`}>
      <button onClick={() => !skipped && onToggle(habit.id)} disabled={!!skipped}
        className={`ml-4 shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
          skipped ? 'border-amber-200 dark:border-violet-700 bg-amber-50 dark:bg-amber-900/20 cursor-not-allowed'
          : habit.completions.some(c=>c.date===date) ? 'bg-emerald-500 border-emerald-500 text-white'
          : 'border-slate-200 dark:border-violet-700 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
        }`}>
        {!skipped && habit.completions.some(c=>c.date===date) && <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </button>
      <button onClick={onSelect} className="flex-1 min-w-0 text-left">
        <div className={`text-sm font-medium ${skipped ? 'text-slate-600 dark:text-slate-300' : 'text-slate-800 dark:text-slate-100'}`}>{habit.name}</div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {skipped
            ? <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-full">⏸ Excused today</span>
            : <>
                {streak > 0 && <span className="text-[10px] font-semibold text-orange-500">🔥 {streak}d</span>}
                <span className="text-[10px] text-slate-600 dark:text-slate-300">{scheduleLabel(habit.recurringDays)}</span>
                {w > 1 && <span className={`text-[10px] font-semibold ${W_COLOR[w]}`}>{W_LABEL[w]}</span>}
              </>
          }
        </div>
      </button>
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {onSkip && (
          <button onClick={onSkip} title={skipped ? 'Undo excuse' : 'Excuse for today'}
            className={`p-1.5 rounded-lg transition-all text-xs ${skipped ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 opacity-100' : 'text-slate-300 dark:text-slate-600 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'}`}>⏸</button>
        )}
        <button onClick={onEdit} className="p-1.5 rounded-lg text-slate-300 dark:text-slate-600 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all text-xs">✏</button>
        {confirming ? (
          <>
            <button onClick={() => onDelete(habit.id)} className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-rose-500 text-white hover:bg-rose-600 transition-colors">Delete</button>
            <button onClick={() => setConfirming(false)} className="px-2 py-1 rounded-lg text-[10px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">Cancel</button>
          </>
        ) : (
          <button onClick={() => setConfirming(true)} className="w-8 h-8 flex items-center justify-center rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all">✕</button>
        )}
      </div>
    </div>
  )
}


function AllHabitsRowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false)
  return (
    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
      <button onClick={onEdit} className="p-1.5 rounded-lg text-slate-300 dark:text-slate-600 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all text-xs">✏</button>
      {confirming ? (
        <>
          <button onClick={onDelete} className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-rose-500 text-white hover:bg-rose-600 transition-colors">Delete</button>
          <button onClick={() => setConfirming(false)} className="px-2 py-1 rounded-lg text-[10px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">Cancel</button>
        </>
      ) : (
        <button onClick={() => setConfirming(true)} className="w-8 h-8 flex items-center justify-center rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all">✕</button>
      )}
    </div>
  )
}

function HabitDetailModal({ habit, onClose }: { habit: Habit; onClose: () => void }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const habitStart = habit.createdAt.slice(0, 10)
  const streak = calcStreak(habit.completions, habit.skips ?? [], habit.recurringDays)
  const w7  = countInWindow(habit.completions, habit.recurringDays, 7,     habitStart)
  const w30 = countInWindow(habit.completions, habit.recurringDays, 30,    habitStart)
  const wAll = countInWindow(habit.completions, habit.recurringDays, 10000, habitStart)

  const stats = [
    { label: '7-day',    value: `${w7.done}/${w7.scheduled}`     },
    { label: '30-day',   value: `${w30.done}/${w30.scheduled}`   },
    { label: 'All time', value: `${wAll.done}/${wAll.scheduled}` },
    { label: 'Streak',   value: streak > 0 ? `🔥 ${streak}d` : '—' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm bg-white dark:bg-[#16161e] rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-100 dark:border-violet-700">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-violet-700">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 truncate">{habit.name}</h2>
            {habit.description && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{habit.description}</p>}
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors text-sm font-bold">
            ✕
          </button>
        </div>
        <div className="grid grid-cols-2 gap-px bg-slate-100 dark:bg-white/[0.06] m-4 rounded-xl overflow-hidden">
          {stats.map(s => (
            <div key={s.label} className="bg-white dark:bg-[#16161e] px-4 py-4 flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{s.label}</span>
              <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{s.value}</span>
            </div>
          ))}
        </div>
        <div className="px-4 pb-4 text-[11px] text-slate-400 dark:text-slate-500">
          {scheduleLabel(habit.recurringDays)}
        </div>
      </div>
    </div>
  )
}

function InlineHabitEditor({ habit, onSave, onCancel }: {
  habit: Habit
  onSave: (id: number, data: Record<string, unknown>) => void
  onCancel: () => void
}) {
  const parsed = parseSchedule(habit.recurringDays)
  const [name, setName] = useState(habit.name)
  const [description, setDescription] = useState(habit.description || '')
  const [schedulePreset, setSchedulePreset] = useState<string|null>(parsed.preset)
  const [customDays, setCustomDays] = useState<number[]>(parsed.customDays)
  const [weight, setWeight] = useState(habit.weight ?? 1)

  function toggleCustomDay(d: number) {
    setCustomDays(prev => prev.includes(d) ? prev.filter(x=>x!==d) : [...prev,d].sort())
  }
  function resolvedRecurringDays(): string|null {
    if (schedulePreset===null) return null
    if (schedulePreset==='custom') return customDays.length>0 ? customDays.join(',') : null
    return schedulePreset
  }
  function handleSave() {
    if (!name.trim()) return
    onSave(habit.id, { name: name.trim(), description: description.trim() || null, recurringDays: resolvedRecurringDays(), weight })
  }

  return (
    <div className="px-4 py-3 space-y-3 bg-violet-50/50 dark:bg-violet-900/10 border-l-[3px] border-l-violet-400">
      <input autoFocus type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Habit name"
        className="w-full text-sm font-medium bg-transparent border-0 outline-none text-slate-800 dark:text-slate-100 placeholder-white/70 p-0" />
      <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Description"
        className="w-full text-sm bg-transparent border-0 outline-none text-slate-600 dark:text-slate-300 placeholder-white/70 p-0" />
      <div className="border-t border-violet-100 dark:border-violet-700 pt-2 space-y-2">
        <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Schedule</p>
        <div className="flex flex-wrap gap-1">
          {SCHEDULE_PRESETS.map(p => (
            <button key={String(p.value)} type="button" onClick={() => setSchedulePreset(p.value)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${schedulePreset===p.value ? 'bg-violet-600 text-white shadow-sm' : 'bg-white dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10'}`}>
              {p.label}
            </button>
          ))}
        </div>
        {schedulePreset==='custom' && (
          <>
            <div className="flex gap-1">
              {DAY_NAMES.map((d,i) => (
                <button key={i} type="button" onClick={() => toggleCustomDay(i)}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-colors ${customDays.includes(i) ? 'bg-violet-600 text-white' : 'bg-white dark:bg-white/[0.05] text-slate-600 dark:text-slate-300'}`}>
                  {d[0]}
                </button>
              ))}
            </div>
            {customDays.length === 0 && (
              <p className="text-[10px] text-amber-500 dark:text-amber-400">Select at least one day.</p>
            )}
          </>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-violet-100 dark:border-violet-700 pt-2">
        <WeightPicker value={weight} onChange={setWeight} />
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-white dark:hover:bg-white/[0.05] transition-all">Cancel</button>
          <button type="button" onClick={handleSave} disabled={!name.trim()||(schedulePreset==='custom'&&customDays.length===0)} className="px-3 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40 transition-colors shadow-sm">Save</button>
        </div>
      </div>
    </div>
  )
}
