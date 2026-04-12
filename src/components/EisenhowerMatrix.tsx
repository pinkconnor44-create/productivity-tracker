'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from '@/lib/toast'

type Item = { id: number; title: string; quadrant: number; done: boolean; createdAt: string }

const QUADRANTS = [
  {
    id: 1,
    label: 'Do First',
    sub: 'Urgent · Important',
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-900/20',
    border: 'border-rose-200 dark:border-violet-700',
    headerBg: 'bg-rose-500',
    dot: 'bg-rose-500',
    inputRing: 'focus-within:ring-rose-300 dark:focus-within:ring-rose-700',
    badge: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
  },
  {
    id: 2,
    label: 'Schedule',
    sub: 'Not Urgent · Important',
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-50 dark:bg-violet-900/20',
    border: 'border-violet-200 dark:border-violet-700',
    headerBg: 'bg-violet-500',
    dot: 'bg-violet-500',
    inputRing: 'focus-within:ring-violet-300 dark:focus-within:ring-violet-700',
    badge: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
  },
  {
    id: 3,
    label: 'Delegate',
    sub: 'Urgent · Not Important',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-violet-700',
    headerBg: 'bg-amber-500',
    dot: 'bg-amber-500',
    inputRing: 'focus-within:ring-amber-300 dark:focus-within:ring-amber-700',
    badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  },
  {
    id: 4,
    label: 'Eliminate',
    sub: 'Not Urgent · Not Important',
    color: 'text-slate-500 dark:text-slate-400',
    bg: 'bg-slate-50 dark:bg-slate-800/40',
    border: 'border-slate-200 dark:border-violet-700',
    headerBg: 'bg-slate-400 dark:bg-slate-600',
    dot: 'bg-slate-400',
    inputRing: 'focus-within:ring-slate-300 dark:focus-within:ring-slate-600',
    badge: 'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400',
  },
]

export default function EisenhowerMatrix() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  const fetchItems = useCallback(async () => {
    const res = await fetch('/api/matrix')
    setItems(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  async function addItem(title: string, quadrant: number) {
    const res = await fetch('/api/matrix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, quadrant }),
    })
    const item = await res.json()
    setItems(prev => [...prev, item])
    toast('Item added', 'info')
  }

  async function toggleDone(item: Item) {
    const updated = { ...item, done: !item.done }
    setItems(prev => prev.map(i => i.id === item.id ? updated : i))
    await fetch(`/api/matrix/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !item.done }),
    })
  }

  async function moveItem(item: Item, quadrant: number) {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, quadrant } : i))
    await fetch(`/api/matrix/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quadrant }),
    })
  }

  async function deleteItem(id: number) {
    setItems(prev => prev.filter(i => i.id !== id))
    await fetch(`/api/matrix/${id}`, { method: 'DELETE' })
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="flex gap-3">

      {/* Y-axis label — Important / Not Important */}
      <div className="hidden sm:flex flex-col shrink-0 w-5 mt-8">
        <div className="flex-1 flex items-center justify-center">
          <span
            className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 select-none"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
            Important
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span
            className="text-[9px] font-bold uppercase tracking-widest text-slate-300 dark:text-slate-600 select-none"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
            Not Important
          </span>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        {/* X-axis labels — Urgent / Not Urgent */}
        <div className="hidden sm:grid grid-cols-2 gap-3 mb-1.5">
          <div className="text-center">
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Urgent</span>
          </div>
          <div className="text-center">
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Not Urgent</span>
          </div>
        </div>

        {/* 2×2 grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {QUADRANTS.map(q => {
            const qItems = items.filter(i => i.quadrant === q.id)
            const active = qItems.filter(i => !i.done)
            const done   = qItems.filter(i => i.done)
            return (
              <Quadrant
                key={q.id}
                q={q}
                active={active}
                done={done}
                onAdd={title => addItem(title, q.id)}
                onToggle={toggleDone}
                onMove={moveItem}
                onDelete={deleteItem}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Quadrant({
  q, active, done, onAdd, onToggle, onMove, onDelete,
}: {
  q: typeof QUADRANTS[0]
  active: Item[]
  done: Item[]
  onAdd: (title: string) => void
  onToggle: (item: Item) => void
  onMove: (item: Item, quadrant: number) => void
  onDelete: (id: number) => void
}) {
  const [input, setInput] = useState('')
  const [showDone, setShowDone] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleAdd() {
    if (!input.trim()) return
    onAdd(input.trim())
    setInput('')
    inputRef.current?.focus()
  }

  return (
    <div className={`rounded-2xl border ${q.border} overflow-hidden shadow-sm flex flex-col bg-white dark:bg-[#16161e]`}>
      {/* Header */}
      <div className={`px-4 py-3 ${q.bg} border-b ${q.border} flex items-center gap-2.5`}>
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${q.dot}`} />
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-bold ${q.color}`}>{q.label}</div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{q.sub}</div>
        </div>
        {active.length > 0 && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${q.badge}`}>
            {active.length}
          </span>
        )}
      </div>

      {/* Active items */}
      <div className="flex-1">
        {active.length === 0 && done.length === 0 ? (
          <p className="px-4 py-5 text-xs text-slate-300 dark:text-slate-600 italic">Nothing here yet…</p>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-white/[0.04]">
            {active.map(item => (
              <MatrixRow key={item.id} item={item} q={q} onToggle={onToggle} onMove={onMove} onDelete={onDelete} />
            ))}
          </div>
        )}

        {done.length > 0 && (
          <div className="border-t border-slate-50 dark:border-violet-700">
            <button onClick={() => setShowDone(v => !v)}
              className="w-full px-4 py-1.5 text-left text-[10px] font-semibold text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 transition-colors flex items-center gap-1.5">
              <span>{showDone ? '▾' : '▸'}</span>
              {done.length} done
            </button>
            {showDone && (
              <div className="divide-y divide-slate-50 dark:divide-white/[0.04]">
                {done.map(item => (
                  <MatrixRow key={item.id} item={item} q={q} onToggle={onToggle} onMove={onMove} onDelete={onDelete} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add input */}
      <div className={`flex items-center gap-2 px-3 py-2.5 border-t ${q.border} ${q.bg}`}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
          placeholder="Add item…"
          className="flex-1 text-xs bg-transparent border-0 outline-none text-slate-700 dark:text-slate-200 placeholder-slate-300 dark:placeholder-slate-600"
        />
        {input.trim() && (
          <button onClick={handleAdd}
            className={`shrink-0 px-2 py-1 text-[10px] font-bold rounded-lg text-white transition-colors ${q.headerBg} opacity-90 hover:opacity-100`}>
            Add
          </button>
        )}
      </div>
    </div>
  )
}

function MatrixRow({ item, q, onToggle, onMove, onDelete }: {
  item: Item
  q: typeof QUADRANTS[0]
  onToggle: (item: Item) => void
  onMove: (item: Item, quadrant: number) => void
  onDelete: (id: number) => void
}) {
  const [showMove, setShowMove] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const others = QUADRANTS.filter(x => x.id !== q.id)

  return (
    <div className="group flex items-start gap-2.5 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors relative">
      {/* Checkbox */}
      <button onClick={() => onToggle(item)}
        className={`mt-0.5 shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
          item.done
            ? 'bg-emerald-500 border-emerald-500 text-white'
            : `border-slate-200 dark:border-violet-700 hover:border-current ${q.color}`
        }`}>
        {item.done && (
          <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      {/* Title */}
      <span className={`flex-1 text-xs leading-snug pt-0.5 ${item.done ? 'line-through text-slate-300 dark:text-slate-600' : 'text-slate-700 dark:text-slate-200'}`}>
        {item.title}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {/* Move */}
        <div className="relative">
          <button onClick={() => setShowMove(v => !v)}
            className="p-1 rounded-md text-slate-300 dark:text-slate-600 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all text-[10px]"
            title="Move to quadrant">
            ⇄
          </button>
          {showMove && (
            <div className="absolute right-0 bottom-full mb-1 z-20 bg-white dark:bg-[#1e1e2a] border border-slate-100 dark:border-violet-700 rounded-xl shadow-lg py-1 min-w-[110px]">
              {others.map(o => (
                <button key={o.id} onClick={() => { onMove(item, o.id); setShowMove(false) }}
                  className="w-full text-left px-3 py-1.5 text-[10px] font-semibold hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${o.dot}`} />
                  <span className={o.color}>{o.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Delete */}
        {confirming ? (
          <>
            <button onClick={() => onDelete(item.id)} className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-rose-500 text-white hover:bg-rose-600 transition-colors">Delete</button>
            <button onClick={() => setConfirming(false)} className="px-2 py-1 rounded-lg text-[10px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">Cancel</button>
          </>
        ) : (
          <button onClick={() => setConfirming(true)}
            className="p-1 rounded-md text-slate-300 dark:text-slate-600 hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all text-[10px]">
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
