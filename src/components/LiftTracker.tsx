'use client'
import { useState, useEffect } from 'react'

type LiftEntry = {
  id: number
  date: string
  name: string
  weight: number
  sets: string // JSON
  totalReps: number
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

export default function LiftTracker() {
  const [entries, setEntries] = useState<LiftEntry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())

  // Form state
  const [name, setName] = useState('')
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState<string[]>([''])
  const [saving, setSaving] = useState(false)

  const t = today()
  const startDate = addDays(t, -29)

  useEffect(() => {
    fetch(`/api/lifts?startDate=${startDate}&endDate=${t}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : [])
      .then((data: LiftEntry[]) => { setEntries(data); setLoaded(true) })
  }, [])

  async function addEntry() {
    const parsedReps = reps.map(r => parseInt(r) || 0).filter(r => r > 0)
    if (!name.trim() || !weight || parsedReps.length === 0) return
    setSaving(true)
    const res = await fetch('/api/lifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: t, name: name.trim(), weight: parseFloat(weight), sets: parsedReps }),
    })
    const entry = await res.json()
    setEntries(prev => [...prev, entry])
    setName('')
    setWeight('')
    setReps([''])
    setSaving(false)
  }

  async function deleteEntry(id: number) {
    await fetch(`/api/lifts/${id}`, { method: 'DELETE' })
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  function addSet() { setReps(prev => [...prev, '']) }
  function removeSet(i: number) { setReps(prev => prev.filter((_, idx) => idx !== i)) }
  function updateRep(i: number, val: string) { setReps(prev => prev.map((r, idx) => idx === i ? val : r)) }

  const totalRepsPreview = reps.map(r => parseInt(r) || 0).reduce((a, b) => a + b, 0)

  // Group entries by date, sorted newest first
  const byDate = entries.reduce<Record<string, LiftEntry[]>>((acc, e) => {
    acc[e.date] = acc[e.date] ? [...acc[e.date], e] : [e]
    return acc
  }, {})
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))
  const todayEntries = byDate[t] ?? []
  const pastDates = dates.filter(d => d !== t)

  function toggleDate(date: string) {
    setExpandedDates(prev => {
      const next = new Set(prev)
      next.has(date) ? next.delete(date) : next.add(date)
      return next
    })
  }

  if (!loaded) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-5 h-5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-4">

      {/* Add exercise form */}
      <div className="bg-white dark:bg-[#16161e] rounded-2xl border border-slate-100 dark:border-violet-700 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-50 dark:border-violet-700 flex items-center gap-2">
          <span className="text-base">🏋️</span>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Log Exercise</h3>
        </div>

        <div className="p-4 space-y-3">
          {/* Name + weight row */}
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Exercise name"
              className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-violet-700/60 bg-slate-50 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 placeholder-slate-300 dark:placeholder-slate-600 outline-none focus:border-violet-400 dark:focus:border-violet-500 transition-colors"
            />
            <div className="relative">
              <input
                type="number"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                placeholder="lbs"
                min={0}
                className="w-24 px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-violet-700/60 bg-slate-50 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 placeholder-slate-300 dark:placeholder-slate-600 outline-none focus:border-violet-400 dark:focus:border-violet-500 transition-colors"
              />
            </div>
          </div>

          {/* Sets */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Sets — reps per set</span>
              {totalRepsPreview > 0 && (
                <span className="ml-auto text-[11px] font-bold text-violet-600 dark:text-violet-400">
                  {totalRepsPreview} total reps
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {reps.map((r, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-400 dark:text-slate-600 font-medium w-10 text-right">Set {i + 1}</span>
                  <input
                    type="number"
                    value={r}
                    onChange={e => updateRep(i, e.target.value)}
                    min={0}
                    placeholder="—"
                    className="w-16 px-2 py-1.5 text-sm text-center rounded-lg border border-slate-200 dark:border-violet-700/60 bg-slate-50 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 outline-none focus:border-violet-400 dark:focus:border-violet-500 transition-colors"
                  />
                  {reps.length > 1 && (
                    <button onClick={() => removeSet(i)}
                      className="text-slate-300 dark:text-slate-600 hover:text-rose-400 transition-colors text-xs px-1">
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button onClick={addSet}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-dashed border-slate-200 dark:border-violet-700/60 text-slate-400 dark:text-slate-500 hover:border-violet-400 hover:text-violet-500 transition-colors">
                + Set
              </button>
            </div>
          </div>

          <button
            onClick={addEntry}
            disabled={saving || !name.trim() || !weight || totalRepsPreview === 0}
            className="w-full py-2 text-sm font-semibold rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm">
            {saving ? 'Logging…' : 'Log Exercise'}
          </button>
        </div>
      </div>

      {/* Today's log */}
      <div className="bg-white dark:bg-[#16161e] rounded-2xl border border-slate-100 dark:border-violet-700 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-50 dark:border-violet-700 flex items-center gap-2">
          <span className="text-base">📋</span>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Today</h3>
          {todayEntries.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 rounded-full">
              {todayEntries.length}
            </span>
          )}
        </div>

        {todayEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <span className="text-3xl">🏋️</span>
            <p className="text-sm text-slate-400 dark:text-slate-500">No exercises logged today</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-white/[0.04]">
            {todayEntries.map(e => (
              <ExerciseRow key={e.id} entry={e} onDelete={deleteEntry} />
            ))}
          </div>
        )}
      </div>

      {/* Past sessions */}
      {pastDates.length > 0 && (
        <div className="bg-white dark:bg-[#16161e] rounded-2xl border border-slate-100 dark:border-violet-700 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-50 dark:border-violet-700">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">History</h3>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-white/[0.04]">
            {pastDates.map(date => {
              const dayEntries = byDate[date]
              const isOpen = expandedDates.has(date)
              const totalVol = dayEntries.reduce((sum, e) => sum + e.weight * e.totalReps, 0)
              return (
                <div key={date}>
                  <button
                    onClick={() => toggleDate(date)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors text-left">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{formatDate(date)}</span>
                      <span className="ml-2 text-[11px] text-slate-400 dark:text-slate-500">
                        {dayEntries.length} exercise{dayEntries.length !== 1 ? 's' : ''} · {totalVol.toLocaleString()} lbs total vol
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-300 dark:text-slate-600">{isOpen ? '▲' : '▼'}</span>
                  </button>
                  {isOpen && (
                    <div className="divide-y divide-slate-50 dark:divide-white/[0.04] border-t border-slate-50 dark:border-white/[0.04]">
                      {dayEntries.map(e => (
                        <ExerciseRow key={e.id} entry={e} onDelete={deleteEntry} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function ExerciseRow({ entry, onDelete }: { entry: LiftEntry; onDelete: (id: number) => void }) {
  const sets: number[] = JSON.parse(entry.sets)
  return (
    <div className="group flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{entry.name}</span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">{entry.weight} lbs</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {sets.map((r, i) => (
            <span key={i} className="px-1.5 py-0.5 text-[10px] font-semibold bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 rounded-md">
              {r}
            </span>
          ))}
          <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-1">
            = <span className="font-bold text-slate-600 dark:text-slate-300">{entry.totalReps}</span> reps
          </span>
        </div>
      </div>
      <button
        onClick={() => onDelete(entry.id)}
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-200 dark:text-slate-700 hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 opacity-0 group-hover:opacity-100 transition-all text-xs">
        ✕
      </button>
    </div>
  )
}
