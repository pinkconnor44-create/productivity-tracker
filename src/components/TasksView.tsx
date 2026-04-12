'use client'
import { useState, useEffect, useCallback } from 'react'
import { isTaskActiveOnDate, recurringLabel } from '@/lib/recurring'
import { toast } from '@/lib/toast'

type TaskCompletion = { id: number; taskId: number; date: string }
type Task = {
  id: number; title: string; description?: string; dueDate?: string; time?: string; endTime?: string
  completed: boolean; completedAt?: string; recurringType?: string
  recurringDays?: string; recurringEnd?: string; weight: number
  completions: TaskCompletion[]; skips: { date: string }[]; createdAt: string
}

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const RECURRING_TYPES = [
  { value: 'daily',    label: 'Every day' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekends', label: 'Weekends' },
  { value: 'weekly',   label: 'Specific days' },
]

// Weight styling
const W_BORDER = ['','border-l-slate-200 dark:border-l-white/[0.06]','border-l-blue-400','border-l-orange-400']
const W_LABEL  = ['','Normal','Important','Critical']
const W_COLOR  = ['','text-slate-600 dark:text-slate-300','text-blue-500','text-orange-500']
const W_BG     = ['','bg-slate-50 dark:bg-white/[0.03]','bg-blue-50 dark:bg-blue-900/20','bg-orange-50 dark:bg-orange-900/20']

function today(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`
}
function addDays(s: string, n: number): string {
  const d = new Date(s+'T12:00:00'); d.setDate(d.getDate()+n)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function formatDueDate(s: string): string {
  const t = today()
  if (s === t) return 'Today'
  if (s === addDays(t,1)) return 'Tomorrow'
  if (s === addDays(t,-1)) return 'Yesterday'
  const d = new Date(s+'T12:00:00')
  return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:d.getFullYear()!==new Date().getFullYear()?'numeric':undefined})
}
function formatTime(t: string): string {
  const [h,m] = t.split(':').map(Number)
  return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`
}

// Parses shorthand like "9a", "930p", "14", "230", "9:30am" → "HH:MM" or null
function parseTimeInput(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/\s/g, '')
  if (!s) return ''
  const isPM = s.endsWith('pm') || (s.endsWith('p') && !s.endsWith('mp'))
  const isAM = s.endsWith('am') || s.endsWith('a')
  const clean = s.replace(/(am|pm|a|p)$/, '').replace(':', '')
  if (!/^\d+$/.test(clean) || clean.length > 4) return null
  let h: number, m: number
  if (clean.length <= 2) { h = parseInt(clean); m = 0 }
  else if (clean.length === 3) { h = parseInt(clean[0]); m = parseInt(clean.slice(1)) }
  else { h = parseInt(clean.slice(0, 2)); m = parseInt(clean.slice(2)) }
  if (isPM && h !== 12) h += 12
  if (isAM && h === 12) h = 0
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
}

function TimeInput({ value, onChange, placeholder = 'e.g. 9a' }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  const [text, setText] = useState(value ? formatTime(value) : '')
  useEffect(() => { setText(value ? formatTime(value) : '') }, [value])
  function handleBlur() {
    if (!text.trim()) { onChange(''); setText(''); return }
    const parsed = parseTimeInput(text)
    if (parsed !== null) { onChange(parsed); setText(parsed ? formatTime(parsed) : '') }
    else setText(value ? formatTime(value) : '')
  }
  return (
    <input type="text" value={text} onChange={e => setText(e.target.value)} onBlur={handleBlur}
      placeholder={placeholder}
      className="text-[11px] text-slate-600 dark:text-slate-300 bg-transparent border-0 outline-none w-16" />
  )
}
function groupTasks(tasks: Task[]) {
  const t = today(), nextWeek = addDays(t,7)
  const g: Record<string,Task[]> = { overdue:[], today:[], thisWeek:[], later:[], noDueDate:[], completed:[] }
  for (const task of tasks) {
    if (task.recurringType) continue
    if (task.completed) { g.completed.push(task); continue }
    if (!task.dueDate) g.noDueDate.push(task)
    else if (task.dueDate < t) g.overdue.push(task)
    else if (task.dueDate === t) g.today.push(task)
    else if (task.dueDate <= nextWeek) g.thisWeek.push(task)
    else g.later.push(task)
  }
  // Sort overdue oldest-first so most urgent surfaces at top
  g.overdue.sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
  return g
}
function blankForm() {
  return { title:'', description:'', dueDate:'', time:'', endTime:'', weight:1, isRecurring:false, recurringType:'daily', recurringDays:[] as number[], recurringEnd:'' }
}

// Shared card style
const card = 'glass card-lift rounded-2xl border overflow-hidden'

function WeightPicker({ value, onChange }: { value: number; onChange: (w: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">Weight</span>
      <div className="flex bg-slate-100 dark:bg-white/[0.05] rounded-lg p-0.5 gap-0.5">
        {[1,2,3].map(w => (
          <button key={w} type="button" onClick={() => onChange(w)}
            title={W_LABEL[w]}
            className={`w-6 h-5 rounded-md text-[11px] font-bold transition-all ${
              value === w
                ? w === 1 ? 'bg-white dark:bg-white/10 text-slate-500 shadow-sm'
                : w === 2 ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-orange-500 text-white shadow-sm'
                : 'text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400'
            }`}>{w}</button>
        ))}
      </div>
    </div>
  )
}

export default function TasksView() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(blankForm())
  const [submitting, setSubmitting] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const fetchTasks = useCallback(async () => {
    const res = await fetch('/api/tasks')
    setTasks(await res.json())
    setLoading(false)
  }, [])
  useEffect(() => { fetchTasks() }, [fetchTasks])

  function setField<K extends keyof ReturnType<typeof blankForm>>(k: K, v: ReturnType<typeof blankForm>[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }
  function toggleDay(d: number) {
    setForm(f => ({ ...f, recurringDays: f.recurringDays.includes(d) ? f.recurringDays.filter(x=>x!==d) : [...f.recurringDays,d].sort() }))
  }
  async function createTask(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSubmitting(true)
    try {
      const body: Record<string,unknown> = { title:form.title, description:form.description, dueDate:form.dueDate, time:form.time, endTime:form.endTime, weight:form.weight }
      if (form.isRecurring) {
        body.recurringType = form.recurringType
        body.recurringDays = form.recurringType === 'weekly' ? form.recurringDays.join(',') : null
        body.recurringEnd  = form.recurringEnd || null
      }
      const res = await fetch('/api/tasks',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
      if (!res.ok) throw new Error()
      toast('Task added', 'info')
      setForm(blankForm()); setShowForm(false); fetchTasks()
    } catch { toast('Failed to add task', 'warning') }
    setSubmitting(false)
  }
  async function toggleTask(task: Task) {
    try {
      const res = await fetch(`/api/tasks/${task.id}`,{ method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ completed:!task.completed }) })
      if (!res.ok) throw new Error()
      if (!task.completed) toast('Task complete ✓')
      fetchTasks()
    } catch { toast('Failed to update task', 'warning') }
  }
  async function toggleRecurringToday(task: Task) {
    const completing = !task.completions.some(c => c.date === today())
    try {
      const res = await fetch('/api/task-completions',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ taskId:task.id, date:today() }) })
      if (!res.ok) throw new Error()
      if (completing) toast('Task complete ✓')
      fetchTasks()
    } catch { toast('Failed to update task', 'warning') }
  }
  async function deleteTask(id: number) {
    try {
      const res = await fetch(`/api/tasks/${id}`,{ method:'DELETE' })
      if (!res.ok) throw new Error()
      toast('Task deleted', 'warning')
      fetchTasks()
    } catch { toast('Failed to delete task', 'warning') }
  }
  async function skipTask(taskId: number) {
    try {
      const res = await fetch('/api/task-skips', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ taskId, date:today() }) })
      if (!res.ok) throw new Error()
      toast('Skipped for today', 'warning')
      fetchTasks()
    } catch { toast('Failed to skip task', 'warning') }
  }
  async function saveTask(id: number, data: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/tasks/${id}`,{ method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) })
      if (!res.ok) throw new Error()
      setEditingId(null); fetchTasks()
    } catch { toast('Failed to save task', 'warning') }
  }

  const todayStr = today()
  const groups = groupTasks(tasks)
  const recurringTasks = tasks.filter(t => t.recurringType)
  const activeRecurringToday = recurringTasks.filter(t => isTaskActiveOnDate(t, todayStr))

  const groupConfig = [
    { key:'overdue',   label:'Overdue',    color:'text-rose-500',   dot:'bg-rose-400' },
    { key:'today',     label:'Today',      color:'text-violet-600 dark:text-violet-400', dot:'bg-violet-500' },
    { key:'thisWeek',  label:'This Week',  color:'text-blue-600 dark:text-blue-400',    dot:'bg-blue-400' },
    { key:'later',     label:'Later',      color:'text-slate-500',  dot:'bg-slate-300 dark:bg-slate-600' },
    { key:'noDueDate', label:'Someday',    color:'text-slate-400',  dot:'bg-slate-200 dark:bg-slate-700' },
  ]

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-4">

      {/* Add task */}
      {!showForm ? (
        <button onClick={() => setShowForm(true)}
          className="w-full flex items-center gap-2.5 px-4 py-3.5 glass border border-dashed rounded-2xl text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:border-violet-300 dark:hover:border-violet-500/50 transition-all text-sm font-medium group">
          <span className="w-5 h-5 rounded-md border-2 border-slate-200 dark:border-violet-700 flex items-center justify-center text-slate-300 dark:text-slate-600 group-hover:border-violet-400 group-hover:text-violet-400 transition-colors text-xs font-bold">+</span>
          New task
        </button>
      ) : (
        <TaskForm form={form} setField={setField} toggleDay={toggleDay} onSubmit={createTask} onCancel={() => { setShowForm(false); setForm(blankForm()) }} submitting={submitting} />
      )}

      {/* Recurring today */}
      {activeRecurringToday.length > 0 && (
        <Section label="Recurring · Today" dot="bg-violet-500" color="text-violet-600 dark:text-violet-400" count={activeRecurringToday.filter(t => t.completions.some(c=>c.date===todayStr)).length} total={activeRecurringToday.length}>
          <div className={card}>
            <div className="divide-y divide-slate-50 dark:divide-white/[0.04]">
              {activeRecurringToday.map(task => {
                if (editingId === task.id) return <InlineTaskEditor key={task.id} task={task} onSave={saveTask} onCancel={() => setEditingId(null)} />
                const done = task.completions.some(c => c.date === todayStr)
                const skipped = task.skips?.some(s => s.date === todayStr)
                const w = task.weight ?? 1
                return (
                  <div key={task.id} className={`flex items-start gap-3 pl-0 pr-4 py-3 group transition-colors border-l-[3px] ${W_BORDER[w]} ${skipped ? 'bg-amber-50/60 dark:bg-amber-900/10' : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'}`}>
                    <button onClick={() => !skipped && toggleRecurringToday(task)} disabled={skipped}
                      className={`ml-4 mt-0.5 shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                        skipped ? 'border-amber-200 dark:border-violet-700 bg-amber-50 dark:bg-amber-900/20 cursor-not-allowed'
                        : done ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-slate-200 dark:border-violet-700 hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20'
                      }`}>
                      {!skipped && done && <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${skipped ? 'text-slate-600 dark:text-slate-300' : done ? 'line-through text-slate-300 dark:text-slate-600' : 'text-slate-800 dark:text-slate-100'}`}>{task.title}</div>
                      {task.description && <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 truncate">{task.description}</div>}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {skipped
                          ? <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-full">⏸ Excused today</span>
                          : <span className="text-[10px] text-violet-500 font-medium bg-violet-50 dark:bg-violet-900/20 px-1.5 py-0.5 rounded-full">🔄 {recurringLabel(task.recurringType!, task.recurringDays)}</span>
                        }
                        {task.time && <span className="text-[10px] text-slate-600 dark:text-slate-300">⏰ {formatTime(task.time)}{task.endTime ? ` – ${formatTime(task.endTime)}` : ''}</span>}
                        {w > 1 && <span className={`text-[10px] font-semibold ${W_COLOR[w]}`}>{W_LABEL[w]}</span>}
                      </div>
                    </div>
                    <RecurringRowActions taskId={task.id} skipped={!!skipped} onSkip={() => skipTask(task.id)} onEdit={() => setEditingId(task.id)} onDelete={() => deleteTask(task.id)} />
                  </div>
                )
              })}
            </div>
          </div>
        </Section>
      )}

      {/* One-time groups */}
      {groupConfig.map(({ key, label, color, dot }) => {
        const group = (groups as Record<string, Task[]>)[key]
        if (group.length === 0) return null
        return (
          <Section key={key} label={label} dot={dot} color={color} count={group.filter(t=>t.completed).length} total={group.length}>
            <div className={card}>
              <div className="divide-y divide-slate-50 dark:divide-white/[0.04]">
                {group.map(task =>
                  editingId === task.id
                    ? <InlineTaskEditor key={task.id} task={task} onSave={saveTask} onCancel={() => setEditingId(null)} />
                    : <TaskRow key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} onEdit={() => setEditingId(task.id)}
                        onSkip={key === 'today' ? () => skipTask(task.id) : undefined}
                        skipped={key === 'today' ? task.skips?.some(s => s.date === todayStr) : undefined}
                      />
                )}
              </div>
            </div>
          </Section>
        )
      })}

      {/* Completed */}
      {groups.completed.length > 0 && (
        <div>
          <button onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 mb-2.5 transition-colors">
            <span>{showCompleted ? '▾' : '▸'}</span>
            Completed ({groups.completed.length})
          </button>
          {showCompleted && (
            <div className={card}>
              <div className="divide-y divide-slate-50 dark:divide-white/[0.04]">
                {groups.completed.map(task =>
                  editingId === task.id
                    ? <InlineTaskEditor key={task.id} task={task} onSave={saveTask} onCancel={() => setEditingId(null)} />
                    : <TaskRow key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} onEdit={() => setEditingId(task.id)} />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Other recurring */}
      {recurringTasks.filter(t => !activeRecurringToday.includes(t)).length > 0 && (
        <Section label="Other Recurring" dot="bg-slate-300 dark:bg-slate-600" color="text-slate-600 dark:text-slate-300">
          <div className={card}>
            <div className="divide-y divide-slate-50 dark:divide-white/[0.04]">
              {recurringTasks.filter(t => !activeRecurringToday.includes(t)).map(task => {
                if (editingId === task.id) return <InlineTaskEditor key={task.id} task={task} onSave={saveTask} onCancel={() => setEditingId(null)} />
                const w = task.weight ?? 1
                return (
                  <div key={task.id} className={`flex items-start gap-3 pl-0 pr-4 py-3 group hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors border-l-[3px] ${W_BORDER[w]}`}>
                    <div className="ml-4 mt-0.5 shrink-0 w-5 h-5 rounded-md border-2 border-slate-100 dark:border-violet-700 flex items-center justify-center text-slate-300 dark:text-slate-600 text-[10px]">—</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-600 dark:text-slate-300">{task.title}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-600 dark:text-slate-300 font-medium bg-slate-50 dark:bg-white/[0.04] px-1.5 py-0.5 rounded-full">🔄 {recurringLabel(task.recurringType!, task.recurringDays)} · not today</span>
                        {w > 1 && <span className={`text-[10px] font-semibold ${W_COLOR[w]}`}>{W_LABEL[w]}</span>}
                      </div>
                    </div>
                    <SimpleRowActions onEdit={() => setEditingId(task.id)} onDelete={() => deleteTask(task.id)} />
                  </div>
                )
              })}
            </div>
          </div>
        </Section>
      )}

      {tasks.filter(t => !t.completed && !t.recurringType).length === 0 && recurringTasks.length === 0 && (
        <div className="text-center py-16 text-slate-600 dark:text-slate-300">
          <div className="w-14 h-14 bg-white dark:bg-[#16161e] rounded-2xl border border-slate-100 dark:border-violet-700 flex items-center justify-center mx-auto mb-4 text-2xl shadow-sm">✓</div>
          <p className="font-semibold text-slate-600 dark:text-slate-400">All clear!</p>
          <p className="text-sm mt-1">Add a task to get started.</p>
        </div>
      )}
    </div>
  )
}

// ── Section header ──
function Section({ label, dot, color, count, total, children }: {
  label: string; dot: string; color: string; count?: number; total?: number; children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
        <span className={`text-[11px] font-bold uppercase tracking-wider ${color}`}>{label}</span>
        {total !== undefined && (
          <span className="ml-auto text-[10px] text-slate-600 dark:text-slate-300 font-medium">
            {count}/{total}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

// ── Task row ──
function TaskRow({ task, onToggle, onDelete, onEdit, onSkip, skipped }: {
  task: Task; onToggle: (t: Task) => void; onDelete: (id: number) => void; onEdit: () => void
  onSkip?: () => void; skipped?: boolean
}) {
  const t = today()
  const isOverdue = task.dueDate && task.dueDate < t && !task.completed
  const w = task.weight ?? 1
  const [confirming, setConfirming] = useState(false)
  return (
    <div className={`flex items-start gap-3 pl-0 pr-4 py-3 group transition-colors border-l-[3px] ${W_BORDER[w]} ${skipped ? 'bg-amber-50/60 dark:bg-amber-900/10' : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'}`}>
      <button onClick={() => !skipped && onToggle(task)} disabled={!!skipped}
        className={`ml-4 mt-0.5 shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
          skipped ? 'border-amber-200 dark:border-violet-700 bg-amber-50 dark:bg-amber-900/20 cursor-not-allowed'
          : task.completed ? 'bg-emerald-500 border-emerald-500 text-white'
          : 'border-slate-200 dark:border-violet-700 hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20'
        }`}>
        {!skipped && task.completed && <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium leading-snug ${skipped ? 'text-slate-600 dark:text-slate-300' : task.completed ? 'line-through text-slate-300 dark:text-slate-600' : 'text-slate-800 dark:text-slate-100'}`}>{task.title}</div>
        {task.description && <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-1">{task.description}</div>}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {skipped
            ? <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-full">⏸ Excused today</span>
            : <>
                {task.dueDate && (
                  <span className={`text-[11px] font-medium ${
                    task.completed ? 'text-slate-300 dark:text-slate-600'
                    : isOverdue ? 'text-rose-500'
                    : task.dueDate === t ? 'text-violet-500 dark:text-violet-400'
                    : 'text-slate-600 dark:text-slate-300'
                  }`}>{isOverdue ? '⚠ ' : ''}{formatDueDate(task.dueDate)}{isOverdue ? ' · overdue' : ''}</span>
                )}
                {task.time && <span className={`text-[11px] ${task.completed ? 'text-slate-300 dark:text-slate-600' : 'text-slate-600 dark:text-slate-300'}`}>⏰ {formatTime(task.time)}{task.endTime ? ` – ${formatTime(task.endTime)}` : ''}</span>}
                {w > 1 && <span className={`text-[10px] font-semibold ${W_COLOR[w]}`}>{W_LABEL[w]}</span>}
              </>
          }
        </div>
      </div>
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {onSkip && (
          <button onClick={onSkip} title={skipped ? 'Undo excuse' : 'Excuse for today'}
            className={`p-1.5 rounded-lg transition-all text-xs ${skipped ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 opacity-100' : 'text-slate-300 dark:text-slate-600 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'}`}>⏸</button>
        )}
        <button onClick={onEdit} className="p-1.5 rounded-lg text-slate-300 dark:text-slate-600 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all text-xs">✏</button>
        {confirming ? (
          <>
            <button onClick={() => onDelete(task.id)} className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-rose-500 text-white hover:bg-rose-600 transition-colors">Delete</button>
            <button onClick={() => setConfirming(false)} className="px-2 py-1 rounded-lg text-[10px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">Cancel</button>
          </>
        ) : (
          <button onClick={() => setConfirming(true)} className="w-8 h-8 flex items-center justify-center rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all">✕</button>
        )}
      </div>
    </div>
  )
}

// ── Reusable confirm-delete action groups ──
function RecurringRowActions({ taskId, skipped, onSkip, onEdit, onDelete }: { taskId: number; skipped: boolean; onSkip: () => void; onEdit: () => void; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false)
  return (
    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
      <button onClick={onSkip} title={skipped ? 'Undo excuse' : 'Excuse for today'}
        className={`p-1.5 rounded-lg transition-all text-xs ${skipped ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 opacity-100' : 'text-slate-300 dark:text-slate-600 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'}`}>⏸</button>
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
function SimpleRowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
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

// ── Inline edit form ──
function InlineTaskEditor({ task, onSave, onCancel }: {
  task: Task
  onSave: (id: number, data: Record<string, unknown>) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || '')
  const [dueDate, setDueDate] = useState(task.dueDate || '')
  const [time, setTime] = useState(task.time || '')
  const [endTime, setEndTime] = useState(task.endTime || '')
  const [weight, setWeight] = useState(task.weight ?? 1)
  const [isRecurring, setIsRecurring] = useState(!!task.recurringType)
  const [recurringType, setRecurringType] = useState(task.recurringType || 'daily')
  const [recurringDays, setRecurringDays] = useState<number[]>(task.recurringDays ? task.recurringDays.split(',').map(Number) : [])
  const [recurringEnd, setRecurringEnd] = useState(task.recurringEnd || '')

  function toggleDay(d: number) {
    setRecurringDays(prev => prev.includes(d) ? prev.filter(x=>x!==d) : [...prev,d].sort())
  }
  function handleSave() {
    if (!title.trim()) return
    const data: Record<string, unknown> = { title: title.trim(), description: description.trim() || null, dueDate: dueDate || null, time: time || null, endTime: endTime || null, weight }
    if (isRecurring) {
      data.recurringType = recurringType
      data.recurringDays = recurringType === 'weekly' ? recurringDays.join(',') : null
      data.recurringEnd = recurringEnd || null
    } else {
      data.recurringType = null; data.recurringDays = null; data.recurringEnd = null
    }
    onSave(task.id, data)
  }

  return (
    <div className="px-4 py-3 space-y-3 bg-violet-50/50 dark:bg-violet-900/10 border-l-[3px] border-l-violet-400">
      <input autoFocus type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title"
        className="w-full text-sm font-medium bg-transparent border-0 outline-none text-slate-800 dark:text-slate-100 placeholder-white/70 p-0" />
      <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Description"
        className="w-full text-sm bg-transparent border-0 outline-none text-slate-600 dark:text-slate-300 placeholder-white/70 p-0" />
      <div className="flex flex-wrap gap-3 items-center pt-2 border-t border-violet-100 dark:border-violet-700">
        <label className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300">
          📅 <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="text-[11px] text-slate-600 dark:text-slate-300 bg-transparent border-0 outline-none" />
        </label>
        <label className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300">
          ⏰ <TimeInput value={time} onChange={setTime} />
        </label>
        <label className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300">
          → <TimeInput value={endTime} onChange={setEndTime} />
        </label>
        <WeightPicker value={weight} onChange={setWeight} />
      </div>
      <div className="border-t border-violet-100 dark:border-violet-700 pt-2 space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <div onClick={() => setIsRecurring(!isRecurring)}
            className={`w-8 h-4 rounded-full transition-colors relative ${isRecurring ? 'bg-violet-600' : 'bg-slate-200 dark:bg-slate-600'}`}>
            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${isRecurring ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Repeat</span>
        </label>
        {isRecurring && (
          <div className="space-y-2 pl-2">
            <div className="flex flex-wrap gap-1">
              {RECURRING_TYPES.map(rt => (
                <button key={rt.value} type="button" onClick={() => setRecurringType(rt.value)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${recurringType===rt.value ? 'bg-violet-600 text-white' : 'bg-white dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10'}`}>
                  {rt.label}
                </button>
              ))}
            </div>
            {recurringType === 'weekly' && (
              <div className="flex gap-1">
                {DAY_NAMES.map((d,i) => (
                  <button key={i} type="button" onClick={() => toggleDay(i)}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-colors ${recurringDays.includes(i) ? 'bg-violet-600 text-white' : 'bg-white dark:bg-white/[0.05] text-slate-600 dark:text-slate-300'}`}>
                    {d[0]}
                  </button>
                ))}
              </div>
            )}
            <label className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
              Ends: <input type="date" value={recurringEnd} onChange={e => setRecurringEnd(e.target.value)} className="bg-transparent border-0 outline-none text-slate-600 dark:text-slate-300 text-[11px]" />
              {recurringEnd && <button type="button" onClick={() => setRecurringEnd('')} className="text-slate-300 hover:text-slate-500">✕</button>}
            </label>
          </div>
        )}
      </div>
      <div className="flex gap-2 justify-end border-t border-violet-100 dark:border-violet-700 pt-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-white dark:hover:bg-white/[0.05] transition-all">Cancel</button>
        <button onClick={handleSave} disabled={!title.trim()} className="px-3 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40 transition-colors shadow-sm">Save</button>
      </div>
    </div>
  )
}

// ── Create form ──
function TaskForm({ form, setField, toggleDay, onSubmit, onCancel, submitting }: {
  form: ReturnType<typeof blankForm>
  setField: <K extends keyof ReturnType<typeof blankForm>>(k: K, v: ReturnType<typeof blankForm>[K]) => void
  toggleDay: (d: number) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
  submitting: boolean
}) {
  return (
    <form onSubmit={onSubmit} className="glass rounded-2xl border p-4 space-y-3">
      <input autoFocus type="text" placeholder="Task title" value={form.title} onChange={e => setField('title',e.target.value)}
        className="w-full text-sm font-medium bg-transparent border-0 outline-none text-slate-800 dark:text-slate-100 placeholder-white/70 p-0" />
      <input type="text" placeholder="Description (optional)" value={form.description} onChange={e => setField('description',e.target.value)}
        className="w-full text-sm bg-transparent border-0 outline-none text-slate-600 dark:text-slate-300 placeholder-white/70 p-0" />
      <div className="flex flex-wrap gap-3 items-center pt-2 border-t border-slate-50 dark:border-violet-700">
        <label className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300">
          📅 <input type="date" value={form.dueDate} onChange={e => setField('dueDate',e.target.value)} className="text-[11px] text-slate-600 dark:text-slate-300 bg-transparent border-0 outline-none" />
        </label>
        <label className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300">
          ⏰ <TimeInput value={form.time} onChange={v => setField('time', v)} />
        </label>
        <label className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300">
          → <TimeInput value={form.endTime} onChange={v => setField('endTime', v)} />
        </label>
        <WeightPicker value={form.weight} onChange={v => setField('weight',v)} />
      </div>
      <div className="border-t border-slate-50 dark:border-violet-700 pt-2 space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <div onClick={() => setField('isRecurring',!form.isRecurring)}
            className={`w-8 h-4 rounded-full transition-colors relative ${form.isRecurring ? 'bg-violet-600' : 'bg-slate-200 dark:bg-slate-600'}`}>
            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${form.isRecurring ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Repeat</span>
        </label>
        {form.isRecurring && (
          <div className="space-y-2 pl-2">
            <div className="flex flex-wrap gap-1">
              {RECURRING_TYPES.map(rt => (
                <button key={rt.value} type="button" onClick={() => setField('recurringType',rt.value)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${form.recurringType===rt.value ? 'bg-violet-600 text-white' : 'bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'}`}>
                  {rt.label}
                </button>
              ))}
            </div>
            {form.recurringType === 'weekly' && (
              <div className="flex gap-1">
                {DAY_NAMES.map((d,i) => (
                  <button key={i} type="button" onClick={() => toggleDay(i)}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-colors ${form.recurringDays.includes(i) ? 'bg-violet-600 text-white' : 'bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300'}`}>
                    {d[0]}
                  </button>
                ))}
              </div>
            )}
            <label className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
              Ends: <input type="date" value={form.recurringEnd} onChange={e => setField('recurringEnd',e.target.value)} className="bg-transparent border-0 outline-none text-slate-600 dark:text-slate-300 text-[11px]" />
              {form.recurringEnd && <button type="button" onClick={() => setField('recurringEnd','')} className="text-slate-300 hover:text-slate-500">✕</button>}
            </label>
          </div>
        )}
      </div>
      <div className="flex gap-2 justify-end border-t border-slate-50 dark:border-violet-700 pt-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-all">Cancel</button>
        <button type="submit" disabled={!form.title.trim()||submitting||(form.isRecurring&&form.recurringType==='weekly'&&form.recurringDays.length===0)}
          className="px-3 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40 transition-colors shadow-sm">Add Task</button>
      </div>
    </form>
  )
}
