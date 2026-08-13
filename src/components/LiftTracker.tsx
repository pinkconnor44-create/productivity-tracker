'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { PageHeader, useConfirm } from '@/components/ui'
import { toast } from '@/lib/toast'

type LiftEntry = {
  id: number
  date: string
  name: string
  weight: number
  sets: string // JSON
  totalReps: number
}

type LiftGroup = {
  id: number
  name: string
  exercises: string[]
  order: number
}

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDate(dateStr: string): string {
  const t = today()
  if (dateStr === t) return 'Today'
  if (dateStr === addDays(t, -1)) return 'Yesterday'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function shortDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function LiftTracker() {
  const [entries, setEntries] = useState<LiftEntry[]>([])
  const [groups, setGroups] = useState<LiftGroup[]>([])
  const [loaded, setLoaded] = useState(false)
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const [activeGroupId, setActiveGroupId] = useState<number | null | 'ungrouped'>(null)
  const [showNewGroupInput, setShowNewGroupInput] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const confirm = useConfirm()

  const t = today()

  useEffect(() => {
    Promise.all([
      // No date params on purpose: the route returns everything without them,
      // and the UI labels its deltas "All-time". A 90-day window here left 81%
      // of lift history rendering nowhere (item 05).
      fetch('/api/lifts', { cache: 'no-store' }).then(r => r.ok ? r.json() : []),
      fetch('/api/lift-groups', { cache: 'no-store' }).then(r => r.ok ? r.json() : []),
    ]).then(([liftData, groupData]: [LiftEntry[], LiftGroup[]]) => {
      setEntries(liftData)
      setGroups(groupData)
      setLoaded(true)
    })
  }, [])

  // Every mutation checks res.ok — a thrown route handler comes back as a
  // bare 500 with no error.tsx to catch it, so res.ok is the only failure
  // signal. A failed save must throw so InlineLogForm can clear its
  // "Saving…" disabled state instead of wedging until reload (item 11).
  async function logSession(exName: string, weightVal: number, parsedReps: number[]) {
    const res = await fetch('/api/lifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: t, name: exName, weight: weightVal, sets: parsedReps }),
    })
    if (!res.ok) throw new Error('save failed')
    const entry = await res.json()
    setEntries(prev => [...prev, entry])
  }

  async function deleteEntry(id: number) {
    const res = await fetch(`/api/lifts/${id}`, { method: 'DELETE' }).catch(() => null)
    if (!res?.ok) { toast('Failed to delete entry', 'warning'); return }
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  async function createGroup() {
    const trimmed = newGroupName.trim()
    if (!trimmed || groups.some(g => g.name.toLowerCase() === trimmed.toLowerCase())) return
    const res = await fetch('/api/lift-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    }).catch(() => null)
    if (!res?.ok) { toast('Failed to create workout day', 'warning'); return }
    const group = await res.json()
    setGroups(prev => [...prev, group])
    setNewGroupName(''); setShowNewGroupInput(false)
    setActiveGroupId(group.id)
  }

  async function deleteGroup(groupId: number) {
    const group = groups.find(g => g.id === groupId)
    const ok = await confirm({
      title: 'Delete workout day?',
      message: <>Permanently delete <span className="font-semibold text-on-surface">{group?.name ?? 'this day'}</span>? Exercises in this day will become ungrouped.</>,
      confirmLabel: 'Delete',
    })
    if (!ok) return
    const res = await fetch(`/api/lift-groups/${groupId}`, { method: 'DELETE' }).catch(() => null)
    if (!res?.ok) { toast('Failed to delete workout day', 'warning'); return }
    setGroups(prev => prev.filter(g => g.id !== groupId))
    if (activeGroupId === groupId) setActiveGroupId(null)
  }

  async function assignExerciseToGroup(exerciseName: string, groupId: number | null) {
    const prevGroups = groups
    const updated = groups.map(g => ({
      ...g,
      exercises: g.exercises.filter(e => e !== exerciseName),
    }))
    if (groupId !== null) {
      const idx = updated.findIndex(g => g.id === groupId)
      if (idx !== -1) updated[idx] = { ...updated[idx], exercises: [...updated[idx].exercises, exerciseName] }
    }
    setGroups(updated)
    for (const orig of prevGroups) {
      const upd = updated.find(g => g.id === orig.id)!
      if (JSON.stringify([...orig.exercises].sort()) !== JSON.stringify([...upd.exercises].sort())) {
        const res = await fetch(`/api/lift-groups/${orig.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exercises: upd.exercises }),
        }).catch(() => null)
        if (!res?.ok) {
          // Optimistic update failed on the server — roll the UI back so the
          // list matches what is actually stored.
          setGroups(prevGroups)
          toast('Failed to move exercise', 'warning')
          return
        }
      }
    }
  }

  const byExercise = entries.reduce<Record<string, LiftEntry[]>>((acc, e) => {
    acc[e.name] = acc[e.name] ? [...acc[e.name], e] : [e]
    return acc
  }, {})

  const exerciseNames = Object.keys(byExercise).sort((a, b) => {
    const latestA = byExercise[a].map(e => e.date).sort().at(-1) ?? ''
    const latestB = byExercise[b].map(e => e.date).sort().at(-1) ?? ''
    return latestB.localeCompare(latestA)
  })

  const allGroupedExercises = new Set(groups.flatMap(g => g.exercises))
  const ungroupedExerciseNames = exerciseNames.filter(n => !allGroupedExercises.has(n))

  const selectedSessions = selectedExercise
    ? (byExercise[selectedExercise] ?? []).slice().sort((a, b) => b.date.localeCompare(a.date))
    : []

  const currentGroup = typeof activeGroupId === 'number' ? groups.find(g => g.id === activeGroupId) ?? null : null

  if (!loaded) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // ── Layer 2: Workout Day ──────────────────────────────────────────────────
  if (typeof activeGroupId === 'number' && currentGroup) {
    return (
      <div className="space-y-4">

        {/* Header */}
        <div className="flex items-center gap-2">
          <button onClick={() => setActiveGroupId(null)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-on-surface-variant/70 hover:text-primary-400 rounded-xl hover:bg-primary-500/10 transition-all">
            ‹ Back
          </button>
          <h2 className="text-base font-bold text-on-surface flex-1">{currentGroup.name}</h2>
          <button onClick={() => deleteGroup(currentGroup.id)}
            className="shrink-0 text-xs text-on-surface-variant/60 hover:text-rose-500 transition-colors px-2 py-1 rounded-lg hover:bg-rose-500/15">
            Delete day
          </button>
        </div>

        {/* Exercise list */}
        <div className="bg-surface-container rounded-2xl border border-outline-variant/40 shadow-sm overflow-hidden">
          {currentGroup.exercises.length === 0 ? (
            <div className="py-10 text-center">
              <div className="text-2xl mb-2">💪</div>
              <p className="text-sm text-on-surface-variant/50">No exercises yet — add one below</p>
            </div>
          ) : (
            <div className="divide-y divide-outline-variant/40">
              {currentGroup.exercises.map(exName => {
                const sessions = (byExercise[exName] ?? []).slice().sort((a, b) => b.date.localeCompare(a.date))
                const hasToday = sessions.some(s => s.date === t)
                const maxWeight = sessions.length > 0 ? Math.max(...sessions.map(s => s.weight)) : null
                return (
                  <div key={exName} className="group flex items-center hover:bg-surface-container-low transition-colors">
                    <button onClick={() => setSelectedExercise(exName)}
                      className="flex-1 flex items-center gap-3 px-4 py-3 text-left min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-on-surface">{exName}</span>
                          {hasToday && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-500/20 text-emerald-400 rounded-full uppercase tracking-wide">today</span>
                          )}
                        </div>
                        {sessions.length > 0 ? (
                          <div className="text-tiny text-on-surface-variant/50 mt-0.5">
                            {sessions.length} session{sessions.length !== 1 ? 's' : ''} · max {maxWeight} lbs · last {formatDate(sessions[0].date)}
                          </div>
                        ) : (
                          <div className="text-tiny text-primary-400 mt-0.5">No sessions yet — tap to log</div>
                        )}
                      </div>
                      <span className="text-on-surface-variant/30 shrink-0">›</span>
                    </button>
                    <button onClick={() => assignExerciseToGroup(exName, null)}
                      title="Remove from day"
                      className="mr-3 w-7 h-7 shrink-0 flex items-center justify-center rounded-lg text-on-surface hover:text-rose-400 hover:bg-rose-500/15 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all text-xs">
                      ✕
                    </button>
                  </div>
                )
              })}
            </div>
          )}
          <AddExerciseToGroup
            suggestions={exerciseNames.filter(n => !currentGroup.exercises.includes(n))}
            onAdd={n => assignExerciseToGroup(n, currentGroup.id)}
          />
        </div>

        {selectedExercise && (
          <ExerciseModal exName={selectedExercise} sessions={selectedSessions}
            onClose={() => setSelectedExercise(null)}
            onAdd={(w, r) => logSession(selectedExercise, w, r)}
            onDelete={deleteEntry} />
        )}
      </div>
    )
  }

  // ── Layer 2: Ungrouped ────────────────────────────────────────────────────
  if (activeGroupId === 'ungrouped') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setActiveGroupId(null)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-on-surface-variant/70 hover:text-primary-400 rounded-xl hover:bg-primary-500/10 transition-all">
            ‹ Back
          </button>
          <h2 className="text-base font-bold text-on-surface">Ungrouped</h2>
        </div>
        <div className="bg-surface-container rounded-2xl border border-outline-variant/40 shadow-sm overflow-hidden">
          <div className="divide-y divide-outline-variant/40">
            {ungroupedExerciseNames.map(exName => {
              const sessions = byExercise[exName].slice().sort((a, b) => b.date.localeCompare(a.date))
              const hasToday = sessions.some(s => s.date === t)
              const maxWeight = Math.max(...sessions.map(s => s.weight))
              return (
                <button key={exName} onClick={() => setSelectedExercise(exName)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-container-low transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-on-surface">{exName}</span>
                      {hasToday && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-500/20 text-emerald-400 rounded-full uppercase tracking-wide">today</span>
                      )}
                    </div>
                    <div className="text-tiny text-on-surface-variant/50 mt-0.5">
                      {sessions.length} session{sessions.length !== 1 ? 's' : ''} · max {maxWeight} lbs · last {formatDate(sessions[0].date)}
                    </div>
                  </div>
                  <span className="text-on-surface-variant/30 shrink-0">›</span>
                </button>
              )
            })}
          </div>
        </div>
        {selectedExercise && (
          <ExerciseModal exName={selectedExercise} sessions={selectedSessions}
            onClose={() => setSelectedExercise(null)}
            onAdd={(w, r) => logSession(selectedExercise, w, r)}
            onDelete={deleteEntry} />
        )}
      </div>
    )
  }

  // ── Layer 1: Workout Days list ────────────────────────────────────────────
  // The landing view IS the split (Connor, 2026-08-12): each day card lists
  // its exercises with the tonnage change of the LATEST session vs the one
  // before it. The old 4-StatCard strip (sessions/7d, /30d, volume, last
  // date) was removed — none of it answered "am I progressing?".

  const todayStr = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}` })()
  const subDays = (s: string, n: number) => { const d = new Date(s+'T12:00:00'); d.setDate(d.getDate()-n); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
  const last7 = new Set(entries.filter(e => e.date >= subDays(todayStr, 7)).map(e => e.date)).size

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Lifts"
        title={<>{last7}<span className="text-on-surface-variant/50"> sessions</span> this week</>}
      />

      {/* Workout Days header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-on-surface">Workout Days</h3>
        {showNewGroupInput ? (
          <input autoFocus type="text" value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') createGroup()
              if (e.key === 'Escape') { setShowNewGroupInput(false); setNewGroupName('') }
            }}
            onBlur={() => { if (!newGroupName.trim()) { setShowNewGroupInput(false); setNewGroupName('') } }}
            placeholder="Day name (e.g. Push)"
            className="w-44 px-3 py-1.5 text-sm rounded-xl border border-primary-500 outline-none bg-surface-container text-on-surface placeholder-on-surface-variant/40" />
        ) : (
          <button onClick={() => setShowNewGroupInput(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-dashed border-outline-variant/60 text-on-surface-variant/50 hover:border-primary-400 hover:text-primary-500 transition-colors">
            + New Day
          </button>
        )}
      </div>

      {/* Group cards */}
      {groups.length === 0 && ungroupedExerciseNames.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <span className="text-4xl">🏋️</span>
          <p className="text-sm font-semibold text-on-surface-variant/70">No workout days yet</p>
          <p className="text-xs text-on-surface-variant/50 max-w-[220px]">Create a day like Push, Pull, or Legs to organize your exercises.</p>
        </div>
      )}

      {groups.map(g => {
        const loggedInGroup = g.exercises.filter(n => byExercise[n])
        const lastDate = loggedInGroup.flatMap(n => byExercise[n].map(e => e.date)).sort().at(-1) ?? null
        const hasToday = loggedInGroup.some(n => byExercise[n]?.some(e => e.date === t))
        return (
          <div key={g.id} className="bg-surface-container rounded-2xl border border-outline-variant/40 shadow-sm overflow-hidden">
            {/* Header → Layer 2 (manage the day) */}
            <button onClick={() => setActiveGroupId(g.id)}
              className="w-full text-left p-4 hover:bg-surface-container-low transition-colors group">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-on-surface">{g.name}</span>
                    {hasToday && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-500/20 text-emerald-400 rounded-full uppercase tracking-wide">today</span>
                    )}
                  </div>
                  <div className="text-tiny text-on-surface-variant/50 mt-0.5">
                    {g.exercises.length} exercise{g.exercises.length !== 1 ? 's' : ''}
                    {lastDate && ` · last ${formatDate(lastDate)}`}
                  </div>
                </div>
                <span className="text-on-surface-variant/30 group-hover:text-primary-400 transition-colors text-lg leading-none">›</span>
              </div>
            </button>
            {/* Every exercise in the day, with tonnage vs the previous session */}
            {g.exercises.length > 0 && (
              <div className="border-t border-outline-variant/40 divide-y divide-outline-variant/25">
                {g.exercises.map(exName => (
                  <ExerciseDeltaRow key={exName} name={exName}
                    entries={byExercise[exName] ?? []}
                    onOpen={() => setSelectedExercise(exName)} />
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Ungrouped card */}
      {ungroupedExerciseNames.length > 0 && (
        <div className="bg-surface-container rounded-2xl border border-dashed border-outline-variant/60 overflow-hidden">
          <button onClick={() => setActiveGroupId('ungrouped')}
            className="w-full text-left p-4 hover:bg-surface-container-low transition-colors group">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-on-surface-variant/70 mb-0.5">Ungrouped</div>
                <div className="text-tiny text-on-surface-variant/50">
                  {ungroupedExerciseNames.length} exercise{ungroupedExerciseNames.length !== 1 ? 's' : ''} not assigned to a day
                </div>
              </div>
              <span className="text-on-surface-variant/30 group-hover:text-primary-400 transition-colors text-lg leading-none">›</span>
            </div>
          </button>
          <div className="border-t border-outline-variant/40 divide-y divide-outline-variant/25">
            {ungroupedExerciseNames.map(exName => (
              <ExerciseDeltaRow key={exName} name={exName}
                entries={byExercise[exName] ?? []}
                onOpen={() => setSelectedExercise(exName)} />
            ))}
          </div>
        </div>
      )}

      {selectedExercise && (
        <ExerciseModal exName={selectedExercise} sessions={selectedSessions}
          onClose={() => setSelectedExercise(null)}
          onAdd={(w, r) => logSession(selectedExercise, w, r)}
          onDelete={deleteEntry} />
      )}
    </div>
  )
}

/** One session = all entries on one date; its tonnage = Σ weight × reps. */
function sessionVolumes(entries: LiftEntry[]): { date: string; vol: number }[] {
  const byDate = new Map<string, number>()
  for (const e of entries) byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.weight * e.totalReps)
  return [...byDate.entries()].map(([date, vol]) => ({ date, vol }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

// Landing-view row: exercise name + tonnage change of the latest session vs
// the one before it. Tapping opens the exercise's log modal directly.
function ExerciseDeltaRow({ name, entries, onOpen }: {
  name: string
  entries: LiftEntry[]
  onOpen: () => void
}) {
  const vols = sessionVolumes(entries)
  const delta = vols.length >= 2 && vols[1].vol > 0
    ? Math.round(((vols[0].vol - vols[1].vol) / vols[1].vol) * 100)
    : null
  return (
    <button onClick={onOpen}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-container-low transition-colors">
      <span className="flex-1 min-w-0 truncate text-sm font-medium text-on-surface">{name}</span>
      {vols.length > 0 && (
        <span className="text-micro text-on-surface-variant/40 tabular-nums shrink-0">
          {Math.round(vols[0].vol).toLocaleString()} lb
        </span>
      )}
      {delta != null ? (
        <span className={`shrink-0 px-2 py-0.5 rounded-full text-tiny font-bold tabular-nums ${
          delta > 0 ? 'bg-emerald-500/15 text-emerald-400'
          : delta < 0 ? 'bg-rose-500/15 text-rose-400'
          : 'bg-surface-container-low text-on-surface-variant/60'
        }`}>
          {delta > 0 ? '+' : ''}{delta}%
        </span>
      ) : (
        <span className="shrink-0 px-2 py-0.5 rounded-full text-tiny font-semibold bg-surface-container-low text-on-surface-variant/40">
          {vols.length === 1 ? 'first' : '—'}
        </span>
      )}
    </button>
  )
}

function AddExerciseToGroup({ suggestions, onAdd }: {
  suggestions: string[]
  onAdd: (name: string) => Promise<void>
}) {
  const [value, setValue] = useState('')
  const [adding, setAdding] = useState(false)
  const [showSugg, setShowSugg] = useState(false)

  const filtered = value.trim()
    ? suggestions.filter(n => n.toLowerCase().includes(value.toLowerCase()) && n.toLowerCase() !== value.toLowerCase())
    : []

  async function submit() {
    const trimmed = value.trim()
    if (!trimmed) return
    setAdding(true)
    await onAdd(trimmed)
    setValue('')
    setAdding(false)
  }

  return (
    <div className="px-4 py-3 border-t border-outline-variant/40">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input type="text" value={value}
            onChange={e => { setValue(e.target.value); setShowSugg(true) }}
            onFocus={() => setShowSugg(true)}
            onBlur={() => setTimeout(() => setShowSugg(false), 150)}
            onKeyDown={e => { if (e.key === 'Enter') submit() }}
            placeholder="Add exercise (e.g. Bench Press)"
            className="w-full px-3 py-2 text-sm rounded-xl border border-outline-variant/60 bg-surface-container-lowest text-on-surface placeholder-on-surface-variant/30 outline-none focus:border-primary-500 transition-colors" />
          {showSugg && filtered.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl border border-outline-variant/60 bg-surface-container shadow-xl overflow-hidden">
              {filtered.slice(0, 5).map(s => (
                <button key={s} onMouseDown={() => { setValue(s); setShowSugg(false) }}
                  className="w-full text-left px-3 py-2 text-sm text-on-surface hover:bg-primary-500/10 transition-colors">{s}</button>
              ))}
            </div>
          )}
        </div>
        <button onClick={submit} disabled={adding || !value.trim()}
          className="px-4 py-2 text-xs font-semibold rounded-xl bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm">
          {adding ? '…' : 'Add'}
        </button>
      </div>
    </div>
  )
}

function ExerciseModal({
  exName, sessions, onClose, onAdd, onDelete
}: {
  exName: string
  sessions: LiftEntry[]
  onClose: () => void
  onAdd: (weight: number, sets: number[]) => Promise<void>
  onDelete: (id: number) => void
}) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Centered on every size — this was a bottom sheet on phones
  // (justify-end), which pinned the whole exercise view, and the log form
  // inside it, to the bottom of the screen.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-lg bg-surface-container rounded-2xl shadow-2xl flex flex-col max-h-[85vh] border border-outline-variant/40">

        <div className="flex items-center gap-3 px-5 py-4 border-b border-outline-variant/40 shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-on-surface truncate">{exName}</h2>
            <p className="text-tiny text-on-surface-variant/50 mt-0.5">
              {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant/50 hover:text-on-surface-variant transition-colors text-sm font-bold">
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0">
          <InlineLogForm exName={exName} onAdd={onAdd} />

          <div className="divide-y divide-outline-variant/40">
            {sessions.map(session => (
              <SessionRow key={session.id} entry={session} onDelete={onDelete} />
            ))}
          </div>

          {sessions.length >= 2 && (
            <div className="px-4 pb-6 pt-2 border-t border-outline-variant/40">
              <div className="flex items-center justify-between mb-3">
                <p className="text-tiny font-semibold text-on-surface-variant/50 uppercase tracking-wide">
                  Volume over time (lbs × reps)
                </p>
                <VolumeDelta sessions={sessions} />
              </div>
              <VolumeChart sessions={sessions} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Tonnage deltas — all-time (first session vs latest) and 3-session running (T0 = latest, T1 = 3 sessions before).
// Two pill chips side by side with a divider.
function VolumeDelta({ sessions }: { sessions: LiftEntry[] }) {
  // Sort oldest → newest for both calculations.
  const sorted = sessions.slice().sort((a, b) => a.date.localeCompare(b.date))
  const n = sorted.length

  // All-time: first session's volume → latest session's volume.
  const first = sorted[0]
  const latest = sorted[n - 1]
  const firstVol = first ? first.weight * first.totalReps : 0
  const latestVol = latest ? latest.weight * latest.totalReps : 0
  const allTimePct = (first && latest && first !== latest && firstVol > 0)
    ? Math.round(((latestVol - firstVol) / firstVol) * 100)
    : null

  // 3-session running: T0 = latest, T1 = session at index n-4 (3 entries before T0).
  // Needs at least 4 sessions for a valid T1.
  const t1 = n >= 4 ? sorted[n - 4] : null
  const t0 = latest
  const t1Vol = t1 ? t1.weight * t1.totalReps : 0
  const t0Vol = t0 ? t0.weight * t0.totalReps : 0
  const threeSessionPct = (t1 && t0 && t1Vol > 0)
    ? Math.round(((t0Vol - t1Vol) / t1Vol) * 100)
    : null

  function Pill({ label, pct, tooltip }: { label: string; pct: number | null; tooltip: string }) {
    if (pct === null) {
      return <span className="text-micro text-on-surface-variant/40 italic">{label} —</span>
    }
    const positive = pct >= 0
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-micro font-bold ${
          positive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
        }`}
        title={tooltip}
      >
        <span className="text-on-surface-variant/60 font-semibold">{label}</span>
        {positive ? '↑' : '↓'} {Math.abs(pct)}%
      </span>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Pill
        label="All-time"
        pct={allTimePct}
        tooltip={first && latest ? `T1 ${firstVol.toLocaleString()} lb·reps (${first.date}) → T0 ${latestVol.toLocaleString()} lb·reps (${latest.date})` : ''}
      />
      <span className="text-on-surface-variant/30 text-micro">|</span>
      <Pill
        label="3-sess"
        pct={threeSessionPct}
        tooltip={t1 && t0 ? `T1 ${t1Vol.toLocaleString()} lb·reps (${t1.date}) → T0 ${t0Vol.toLocaleString()} lb·reps (${t0.date})` : 'needs ≥4 sessions'}
      />
    </div>
  )
}

function VolumeChart({ sessions }: { sessions: LiftEntry[] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)
  const sorted = sessions.slice().sort((a, b) => a.date.localeCompare(b.date))
  const points = sorted.map(s => ({ date: s.date, volume: s.weight * s.totalReps }))

  const W = 300, H = 140
  const PAD = { left: 56, right: 14, top: 14, bottom: 36 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const volumes = points.map(p => p.volume)
  const minV = Math.min(...volumes)
  const maxV = Math.max(...volumes)
  const vRange = maxV - minV || 1

  function cx(i: number) {
    return PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW)
  }
  function cy(v: number) {
    return PAD.top + plotH - ((v - minV) / vRange) * plotH
  }

  const polyline = points.map((p, i) => `${cx(i)},${cy(p.volume)}`).join(' ')

  const maxLabels = 5
  const labelIndices: number[] = []
  if (points.length <= maxLabels) {
    points.forEach((_, i) => labelIndices.push(i))
  } else {
    for (let i = 0; i < maxLabels; i++) {
      labelIndices.push(Math.round((i / (maxLabels - 1)) * (points.length - 1)))
    }
  }

  const yTicks = [minV, minV + vRange / 2, maxV]

  return (<>
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 140 }} aria-hidden="true">
      {yTicks.map((v, i) => (
        <line key={i} x1={PAD.left} y1={cy(v)} x2={W - PAD.right} y2={cy(v)}
          stroke="currentColor" strokeWidth="0.5"
          className="text-on-surface-variant/[0.08]" strokeDasharray="3 3" />
      ))}
      {yTicks.map((v, i) => (
        <text key={i} x={PAD.left - 6} y={cy(v) + 4} textAnchor="end" fontSize="11" fontWeight="600" fill="var(--c-p-hex)" fillOpacity="0.85">
          {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v)}
        </text>
      ))}
      {points.length > 1 && (
        <polyline points={polyline} fill="none" stroke="var(--c-p-hex)" strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />
      )}
      {points.length > 1 && (
        <polygon
          points={`${cx(0)},${PAD.top + plotH} ${polyline} ${cx(points.length - 1)},${PAD.top + plotH}`}
          fill="var(--c-p-hex)" opacity="0.08" />
      )}
      {points.map((p, i) => {
        const volLabel = p.volume >= 1000 ? `${(p.volume / 1000).toFixed(1)}k` : String(p.volume)
        return (
          <g key={i}
            onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, text: `${shortDate(p.date)} · ${volLabel} lbs` })}
            onMouseMove={e => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
            onMouseLeave={() => setTooltip(null)}
            style={{ cursor: 'default' }}>
            <circle cx={cx(i)} cy={cy(p.volume)} r="8" fill="transparent" />
            <circle cx={cx(i)} cy={cy(p.volume)} r="3" fill="var(--c-p-hex)" opacity="0.9" />
          </g>
        )
      })}
      {labelIndices.map(i => (
        <text key={i} x={cx(i)} y={H - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--c-p-hex)" fillOpacity="0.85">
          {shortDate(points[i].date)}
        </text>
      ))}
    </svg>
    {tooltip && (
      <div className="fixed z-50 pointer-events-none"
        style={{ left: tooltip.x, top: tooltip.y - 10, transform: 'translate(-50%, -100%)' }}>
        <div className="bg-surface-container border border-outline-variant text-white rounded-lg px-2.5 py-1.5 shadow-xl text-xs whitespace-nowrap">
          {tooltip.text}
        </div>
      </div>
    )}
  </>
  )
}

// Vertical stacked-set log form. Drafts auto-persist to localStorage so closing
// the modal and coming back keeps the rows filled in. "Finish session" submits
// all sets to the server and clears the draft.
type DraftRow = { weight: string; reps: string }
function draftKey(exName: string) {
  const t = today()
  return `lift-draft-${t}-${exName}`
}
function loadDraft(exName: string): DraftRow[] {
  if (typeof window === 'undefined') return [{ weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }]
  try {
    const raw = localStorage.getItem(draftKey(exName))
    if (!raw) return [{ weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }]
    const parsed = JSON.parse(raw) as DraftRow[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [{ weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }]
  } catch {
    return [{ weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }]
  }
}
function saveDraft(exName: string, rows: DraftRow[]) {
  try { localStorage.setItem(draftKey(exName), JSON.stringify(rows)) } catch {}
}
function clearDraft(exName: string) {
  try { localStorage.removeItem(draftKey(exName)) } catch {}
}

function InlineLogForm({ exName, onAdd }: { exName: string; onAdd: (weight: number, sets: number[]) => Promise<void> }) {
  const [rows, setRows] = useState<DraftRow[]>(() => loadDraft(exName))
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)

  // Persist drafts on every change. Cheap — JSON of <10 short strings.
  useEffect(() => { saveDraft(exName, rows) }, [exName, rows])

  // Reload draft if the exercise name changes (modal could be reused, defensive)
  useEffect(() => { setRows(loadDraft(exName)) }, [exName])

  const filledRows = rows.filter(r => parseInt(r.reps) > 0 && parseFloat(r.weight) > 0)
  const totalReps = filledRows.reduce((s, r) => s + (parseInt(r.reps) || 0), 0)
  const totalVolume = filledRows.reduce((s, r) => s + (parseFloat(r.weight) || 0) * (parseInt(r.reps) || 0), 0)
  const hasDraft = rows.some(r => r.weight !== '' || r.reps !== '')

  function addRow() { setRows(prev => [...prev, { weight: '', reps: '' }]) }
  function removeRow(i: number) { setRows(prev => prev.filter((_, idx) => idx !== i)) }
  function update(i: number, key: keyof DraftRow, val: string) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [key]: val } : r))
  }
  function clearAll() {
    setRows([{ weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }])
    clearDraft(exName)
  }

  async function submit() {
    if (filledRows.length === 0) return
    setSaving(true)
    try {

    // Group consecutive same-weight rows into single LiftEntry submissions
    // (schema is one weight per entry with reps[] for sets).
    const groups: { weight: number; reps: number[] }[] = []
    for (const row of filledRows) {
      const w = parseFloat(row.weight)
      const r = parseInt(row.reps)
      const last = groups[groups.length - 1]
      if (last && last.weight === w) last.reps.push(r)
      else groups.push({ weight: w, reps: [r] })
    }
    for (const g of groups) {
      await onAdd(g.weight, g.reps)
    }
    clearDraft(exName)
    setRows([{ weight: '', reps: '' }, { weight: '', reps: '' }, { weight: '', reps: '' }])
    setOpen(false)
    } catch {
      // Keep the draft and the open form — the sets aren't saved. Clearing
      // the disabled state is the point: without it a failed save left
      // "Finish session" reading "Saving…" until a reload (item 11).
      toast('Failed to save session', 'warning')
    }
    setSaving(false)
  }

  if (!open) return (
    <div className="px-4 py-2 border-t border-outline-variant/40">
      <button onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl border border-dashed border-outline-variant/60 text-on-surface-variant/50 hover:border-primary-400 hover:text-primary-500 transition-colors">
        + Log new session{hasDraft && <span className="ml-1 text-amber-400">· draft saved</span>}
      </button>
    </div>
  )

  // A centered modal, portalled to document.body (fixed positioning would be
  // trapped by any transformed ancestor — .neon-card hover, .tab-fade). It
  // used to expand in place at the BOTTOM of the exercise card, which on a
  // phone pinned the inputs against the keyboard at the bottom of the screen.
  // Closing (backdrop tap or ✕) is safe: the draft persists per keystroke.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
      <div className="relative glass rounded-2xl w-full max-w-md p-5 space-y-3 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-primary-400">New session — {exName}</span>
          {hasDraft && (
            <span className="text-micro text-amber-400 font-bold uppercase tracking-wider">draft</span>
          )}
          <button onClick={() => setOpen(false)} aria-label="Close" className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant/60 hover:text-on-surface hover:bg-surface-container-low transition-colors">✕</button>
        </div>

        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[32px_1fr_1fr_32px] gap-2 px-1 text-micro font-bold uppercase tracking-[0.1em] text-on-surface-variant/45">
            <span>Set</span>
            <span>Weight</span>
            <span>Reps</span>
            <span />
          </div>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[32px_1fr_1fr_32px] gap-2 items-center">
              <span className="text-body font-semibold text-on-surface-variant/70 tabular-nums text-center">{i + 1}</span>
              <input
                type="number"
                value={r.weight}
                onChange={e => update(i, 'weight', e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submit() }}
                placeholder="lbs"
                min={0}
                inputMode="decimal"
                className="w-full px-3 py-3.5 text-lg sm:text-base rounded-xl border border-outline-variant/60 bg-surface-container-low text-on-surface placeholder-on-surface-variant/30 outline-none focus:border-primary-500 tabular-nums transition-colors"
              />
              <input
                type="number"
                value={r.reps}
                onChange={e => update(i, 'reps', e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submit() }}
                placeholder="reps"
                min={0}
                inputMode="numeric"
                className="w-full px-3 py-3.5 text-lg sm:text-base rounded-xl border border-outline-variant/60 bg-surface-container-low text-on-surface placeholder-on-surface-variant/30 outline-none focus:border-primary-500 tabular-nums transition-colors"
              />
              <button
                onClick={() => removeRow(i)}
                disabled={rows.length === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant/40 hover:text-rose-400 transition-colors text-sm disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label={`Remove set ${i + 1}`}
              >✕</button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={addRow}
            className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-dashed border-outline-variant/60 text-on-surface-variant/70 hover:border-primary-400 hover:text-primary-300 transition-colors">
            + Add set
          </button>
          {hasDraft && (
            <button onClick={clearAll}
              className="px-4 py-2.5 text-sm font-semibold rounded-xl border border-outline-variant/60 text-on-surface-variant/60 hover:text-rose-400 hover:border-rose-500/40 transition-colors">
              Clear
            </button>
          )}
        </div>

        {filledRows.length > 0 && (
          <div className="flex items-center gap-3 px-1 text-caption">
            <span className="text-on-surface-variant/60">{filledRows.length} set{filledRows.length === 1 ? '' : 's'}</span>
            <span className="text-on-surface-variant/30">·</span>
            <span className="text-primary-300 font-bold">{totalReps} reps</span>
            <span className="text-on-surface-variant/30">·</span>
            <span className="text-primary-300 font-bold tabular-nums">{totalVolume.toLocaleString()} vol</span>
          </div>
        )}

        <button
          onClick={submit}
          disabled={saving || filledRows.length === 0}
          className="w-full py-3.5 text-base font-bold rounded-xl bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm">
          {saving ? 'Saving…' : `Finish session${filledRows.length > 0 ? ` · ${filledRows.length} set${filledRows.length === 1 ? '' : 's'}` : ''}`}
        </button>
      </div>
    </div>,
    document.body
  )
}

function SessionRow({ entry, onDelete }: { entry: LiftEntry; onDelete: (id: number) => void }) {
  const sets: number[] = JSON.parse(entry.sets)
  const t = today()
  const volume = entry.weight * entry.totalReps
  const confirm = useConfirm()
  async function handleDelete() {
    const ok = await confirm({
      title: 'Delete session?',
      message: <>Permanently delete this {entry.weight} lbs · {entry.totalReps} reps session?</>,
      confirmLabel: 'Delete',
    })
    if (ok) onDelete(entry.id)
  }
  return (
    <div className="group flex items-start gap-3 px-4 py-2.5 hover:bg-surface-container-low transition-colors pl-6">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-tiny font-semibold text-on-surface-variant/70">
            {entry.date === t ? 'Today' : new Date(entry.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
          <span className="text-tiny text-on-surface-variant/50">{entry.weight} lbs</span>
          <span className="text-micro text-on-surface-variant/50">·</span>
          <span className="text-micro font-bold text-on-surface-variant/70">{entry.totalReps} reps</span>
          <span className="text-micro text-on-surface-variant/50">·</span>
          <span className="text-micro font-semibold text-primary-400">{volume.toLocaleString()} vol</span>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {sets.map((r, i) => (
            <span key={i} className="px-1.5 py-0.5 text-micro font-semibold bg-primary-500/15 text-primary-400 rounded-md">
              {r}
            </span>
          ))}
        </div>
      </div>
      <button
        onClick={handleDelete}
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-on-surface hover:text-rose-400 hover:bg-rose-500/15 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all text-xs">
        ✕
      </button>
    </div>
  )
}
