'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { PageHeader, Card, useConfirm } from '@/components/ui'

type Item = { id: string; text: string; done: boolean }

export default function Scratchpad() {
  const [notes, setNotes] = useState('')
  const [checklist, setChecklist] = useState<Item[]>([])
  const [newItem, setNewItem] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  // Drag state
  const dragIndex = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [])

  // Load on mount
  useEffect(() => {
    fetch('/api/scratchpad', { cache: 'no-store' })
      .then(r => r.json().catch(() => ({ notes: '', checklist: [] })))
      .then(data => {
        setNotes(data.notes ?? '')
        setChecklist(data.checklist ?? [])
        setLoaded(true)
      })
  }, [])

  // Expand textarea to fit content whenever notes change
  useEffect(() => { adjustHeight() }, [notes, adjustHeight])

  // Auto-save notes after 800ms of no typing
  function handleNotesChange(val: string) {
    setNotes(val)
    adjustHeight()
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      fetch('/api/scratchpad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: val }),
      })
    }, 800)
  }

  // Save checklist immediately on any change
  async function saveChecklist(items: Item[]) {
    setChecklist(items)
    await fetch('/api/scratchpad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checklist: items }),
    })
  }

  function addItem() {
    if (!newItem.trim()) return
    const item: Item = { id: Date.now().toString(), text: newItem.trim(), done: false }
    saveChecklist([...checklist, item])
    setNewItem('')
    inputRef.current?.focus()
  }

  function toggleItem(id: string) {
    saveChecklist(checklist.map(i => i.id === id ? { ...i, done: !i.done } : i))
  }

  const confirm = useConfirm()
  async function deleteItem(id: string) {
    const item = checklist.find(i => i.id === id)
    const ok = await confirm({
      title: 'Delete item?',
      message: <>Remove <span className="font-semibold text-on-surface">{item?.text || 'this item'}</span> from the checklist?</>,
      confirmLabel: 'Delete',
    })
    if (!ok) return
    saveChecklist(checklist.filter(i => i.id !== id))
  }

  async function clearDone() {
    const doneCount = checklist.filter(i => i.done).length
    if (doneCount === 0) return
    const ok = await confirm({
      title: 'Clear completed?',
      message: `Remove ${doneCount} completed item${doneCount === 1 ? '' : 's'} from the checklist?`,
      confirmLabel: 'Clear',
    })
    if (!ok) return
    saveChecklist(checklist.filter(i => !i.done))
  }

  function startEdit(item: Item) {
    setEditingId(item.id)
    setEditText(item.text)
    setTimeout(() => { editInputRef.current?.select() }, 0)
  }

  function commitEdit(id: string) {
    const trimmed = editText.trim()
    if (trimmed) {
      saveChecklist(checklist.map(i => i.id === id ? { ...i, text: trimmed } : i))
    }
    setEditingId(null)
  }

  function handleEditKeyDown(e: React.KeyboardEvent, id: string) {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(id) }
    if (e.key === 'Escape') setEditingId(null)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); addItem() }
  }

  // Drag handlers
  function handleDragStart(index: number) {
    dragIndex.current = index
    setDraggingIndex(index)
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    setDragOver(index)
  }

  function handleDrop(e: React.DragEvent, index: number) {
    e.preventDefault()
    const from = dragIndex.current
    if (from === null || from === index) {
      dragIndex.current = null
      setDragOver(null)
      return
    }
    const reordered = [...checklist]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(index, 0, moved)
    dragIndex.current = null
    setDragOver(null)
    saveChecklist(reordered)
  }

  function handleDragEnd() {
    dragIndex.current = null
    setDragOver(null)
    setDraggingIndex(null)
  }

  const doneCount = checklist.filter(i => i.done).length

  // Flush any pending debounced save when the component is about to unmount
  // (tab switch w/ keep-mounted shouldn't unmount, but a full page nav will).
  useEffect(() => {
    return () => {
      if (saveTimer.current && notes !== '') {
        try {
          fetch('/api/scratchpad', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes }),
            keepalive: true,
          })
        } catch {}
        clearTimeout(saveTimer.current)
      }
    }
  }, [notes])

  if (!loaded) return (
    <div className="flex items-center justify-center py-8">
      <div className="w-5 h-5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div>
      <PageHeader
        eyebrow="Scratchpad"
        title="Quick notes"
      />
      <Card className="overflow-hidden">

        {/* Notes */}
        <div className="px-4 py-3 border-b border-outline-variant/40 flex items-center gap-2">
          <span className="text-base">📝</span>
          <h3 className="text-sm font-semibold text-on-surface">Notes</h3>
          <span className="ml-auto text-[10px] text-on-surface-variant/30 font-medium">auto-saved</span>
        </div>
        <textarea
          ref={textareaRef}
          value={notes}
          onChange={e => handleNotesChange(e.target.value)}
          placeholder="Jot down anything on your mind…"
          style={{ minHeight: '60px' }}
          className="w-full px-4 py-3 text-sm text-on-surface bg-transparent placeholder-white/70 resize-none outline-none leading-relaxed overflow-hidden"
        />

        {/* Checklist */}
        <div>
        <div className="px-4 py-3 border-b border-outline-variant/40 flex items-center gap-2">
          <span className="text-base">☑</span>
          <h3 className="text-sm font-semibold text-on-surface">Checklist</h3>
          {checklist.length > 0 && (
            <span className="ml-1 text-[10px] text-on-surface-variant font-medium">
              {doneCount}/{checklist.length}
            </span>
          )}
          {doneCount > 0 && (
            <button onClick={clearDone}
              className="ml-auto text-[11px] text-on-surface-variant hover:text-rose-400 font-medium transition-colors">
              Clear done
            </button>
          )}
        </div>

        {/* Items */}
        {checklist.length > 0 && (
          <div className="divide-y divide-outline-variant/40">
            {checklist.map((item, index) => (
              <div
                key={item.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={e => handleDragOver(e, index)}
                onDrop={e => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-start gap-2 px-3 py-2.5 group transition-all cursor-default ${
                  draggingIndex === index
                    ? 'opacity-40 scale-[0.98] bg-surface-container-lowest'
                    : dragOver === index && dragIndex.current !== index
                      ? 'bg-violet-500/15 border-t-2 border-violet-400'
                      : 'hover:bg-surface-container-low'
                }`}
              >
                {/* Drag handle */}
                <span className="shrink-0 mt-0.5 text-on-surface opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-xs select-none leading-[20px]">
                  ⠿
                </span>
                <button onClick={() => toggleItem(item.id)}
                  className={`mt-0.5 shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                    item.done
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-outline-variant hover:border-violet-400 hover:bg-violet-500/10'
                  }`}>
                  {item.done && (
                    <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
                {editingId === item.id ? (
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onBlur={() => commitEdit(item.id)}
                    onKeyDown={e => handleEditKeyDown(e, item.id)}
                    className="flex-1 text-sm bg-transparent border-0 border-b border-violet-400 outline-none text-on-surface pb-0.5"
                  />
                ) : (
                  <span
                    onDoubleClick={() => !item.done && startEdit(item)}
                    className={`flex-1 text-sm leading-snug pt-0.5 ${
                      item.done ? 'line-through text-on-surface-variant/30' : 'text-on-surface'
                    }`}
                  >
                    {item.text}
                  </span>
                )}
                {editingId !== item.id && (
                  <>
                    {!item.done && (
                      <button onClick={() => startEdit(item)}
                        className="shrink-0 mt-0.5 p-1 rounded-lg text-on-surface hover:text-violet-400 hover:bg-violet-500/10 opacity-0 group-hover:opacity-100 transition-all text-xs">
                        ✏
                      </button>
                    )}
                    <button onClick={() => deleteItem(item.id)}
                      className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl text-sm font-bold text-on-surface-variant hover:text-rose-500 hover:bg-rose-500/15 opacity-0 group-hover:opacity-100 transition-all">
                      ✕
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add item input */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-outline-variant/40">
          <div className="shrink-0 w-5 h-5 rounded-md border-2 border-dashed border-outline-variant flex items-center justify-center text-on-surface-variant/30 text-xs font-bold">
            +
          </div>
          <input
            ref={inputRef}
            type="text"
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add an item…"
            className="flex-1 text-sm bg-transparent border-0 outline-none text-on-surface placeholder-white/70"
          />
          {newItem.trim() && (
            <button onClick={addItem}
              className="shrink-0 px-2.5 py-1 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors shadow-sm">
              Add
            </button>
          )}
        </div>
        </div>{/* end checklist wrapper */}

      </Card>
    </div>
  )
}
