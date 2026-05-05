'use client'
import { useState, useEffect, useRef } from 'react'

type Item = { id: number; text: string; createdAt: string }
type TriageAction = 'task' | 'note' | 'checklist'

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export default function BrainDump() {
  const [items, setItems]   = useState<Item[]>([])
  const [input, setInput]   = useState('')
  const [loading, setLoading] = useState(true)
  const [triaging, setTriaging] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/inbox')
      .then(r => r.ok ? r.json() : [])
      .then(data => { setItems(data); setLoading(false) })
  }, [])

  async function capture() {
    if (!input.trim()) return
    const res = await fetch('/api/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: input.trim() }),
    })
    const item = await res.json()
    setItems(prev => [item, ...prev])
    setInput('')
    inputRef.current?.focus()
  }

  async function dismiss(id: number) {
    await fetch(`/api/inbox/${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function promote(item: Item, action: TriageAction) {
    setTriaging(item.id)
    try {
      if (action === 'task') {
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: item.text }),
        })
      } else if (action === 'note') {
        // Append to scratchpad notes
        const current = await fetch('/api/scratchpad').then(r => r.ok ? r.json() : { notes: '', checklist: [] })
        const appended = current.notes
          ? current.notes + '\n\n' + item.text
          : item.text
        await fetch('/api/scratchpad', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: appended }),
        })
      } else if (action === 'checklist') {
        const current = await fetch('/api/scratchpad').then(r => r.ok ? r.json() : { notes: '', checklist: [] })
        const newItem = { id: Date.now().toString(), text: item.text, done: false }
        await fetch('/api/scratchpad', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checklist: [...(current.checklist ?? []), newItem] }),
        })
      }
      await dismiss(item.id)
    } finally {
      setTriaging(null)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); capture() }
  }

  const count = items.length

  return (
    <div className="space-y-4">

      {/* Capture bar */}
      <div className="bg-surface-container rounded-2xl border border-outline-variant/40 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-outline-variant/40 flex items-center gap-2">
          <span className="text-base">⚡</span>
          <h3 className="text-sm font-semibold text-on-surface">Brain Dump</h3>
          <span className="ml-auto text-[10px] text-on-surface-variant/30 font-medium">capture anything · triage later</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-3">
          <input
            ref={inputRef}
            autoFocus
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What's on your mind? Press Enter to capture…"
            className="flex-1 text-sm bg-transparent border-0 outline-none text-on-surface placeholder-white/70"
          />
          {input.trim() && (
            <button onClick={capture}
              className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors shadow-sm">
              Capture
            </button>
          )}
        </div>
      </div>

      {/* Inbox */}
      <div className="bg-surface-container rounded-2xl border border-outline-variant/40 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-outline-variant/40 flex items-center gap-2">
          <span className="text-base">📥</span>
          <h3 className="text-sm font-semibold text-on-surface">Inbox</h3>
          {count > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-violet-500/15 text-violet-400 rounded-full">
              {count}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : count === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <span className="text-3xl">🧠</span>
            <p className="text-sm text-on-surface-variant/50">Inbox zero. Capture something above.</p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/40">
            {items.map(item => (
              <div key={item.id}
                className="group px-4 py-3 hover:bg-surface-container-low transition-colors">
                <div className="flex items-start gap-3">
                  <p className="flex-1 text-sm text-on-surface leading-snug pt-0.5">
                    {item.text}
                  </p>
                  <span className="shrink-0 text-[10px] text-on-surface-variant/30 pt-1 tabular-nums">
                    {relativeTime(item.createdAt)}
                  </span>
                </div>

                {/* Triage actions */}
                <div className="flex items-center gap-1.5 mt-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] text-on-surface-variant/30 mr-0.5">Send to →</span>
                  <button
                    onClick={() => promote(item, 'task')}
                    disabled={triaging === item.id}
                    className="px-2 py-1 text-[10px] font-semibold rounded-md bg-violet-500/15 text-violet-400 hover:bg-violet-500/15 transition-colors disabled:opacity-40">
                    ✓ Task
                  </button>
                  <button
                    onClick={() => promote(item, 'checklist')}
                    disabled={triaging === item.id}
                    className="px-2 py-1 text-[10px] font-semibold rounded-md bg-emerald-500/15 text-emerald-400 hover:bg-emerald-100 transition-colors disabled:opacity-40">
                    ☑ Checklist
                  </button>
                  <button
                    onClick={() => promote(item, 'note')}
                    disabled={triaging === item.id}
                    className="px-2 py-1 text-[10px] font-semibold rounded-md bg-amber-500/15 text-amber-400 hover:bg-amber-100 transition-colors disabled:opacity-40">
                    📝 Note
                  </button>
                  <button
                    onClick={() => dismiss(item.id)}
                    disabled={triaging === item.id}
                    className="ml-auto px-2 py-1 text-[10px] font-semibold rounded-md text-on-surface-variant/30 hover:bg-rose-500/15 hover:text-rose-400 transition-colors disabled:opacity-40">
                    ✕ Discard
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
