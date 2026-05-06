'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { toast } from '@/lib/toast'
import { PageHeader, StatCard, scoreColor } from '@/components/ui'

type ChecklistItem = { id: string; text: string; done: boolean }
type Project = {
  id: number
  title: string
  notes: string
  checklist: string // JSON
  order: number
  createdAt: string
  updatedAt: string
}

function parseChecklist(raw: string): ChecklistItem[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export default function ProjectsView() {
  const [projects, setProjects] = useState<Project[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')

  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const newItemRef = useRef<HTMLInputElement>(null)
  const [newItem, setNewItem] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const closeModal = useCallback(() => {
    setModalOpen(false)
    setEditingTitle(false)
    setConfirmDeleteId(null)
  }, [])

  useEffect(() => {
    if (!modalOpen) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') closeModal() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [modalOpen, closeModal])

  function openProject(id: number) {
    setActiveId(id)
    setModalOpen(true)
  }

  const fetchProjects = useCallback(async () => {
    const res = await fetch('/api/projects', { cache: 'no-store' })
    if (res.ok) {
      const data: Project[] = await res.json()
      setProjects(data)
      setActiveId(prev => prev && data.some(p => p.id === prev) ? prev : (data[0]?.id ?? null))
    }
    setLoaded(true)
  }, [])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  const active = projects.find(p => p.id === activeId) ?? null

  const adjustHeight = useCallback(() => {
    const el = notesRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [])

  // Resize on modal open + active project change + notes content change.
  // rAF ensures portal/textarea is mounted before measuring scrollHeight.
  useEffect(() => {
    if (!modalOpen) return
    const id = requestAnimationFrame(() => adjustHeight())
    return () => cancelAnimationFrame(id)
  }, [modalOpen, active?.id, active?.notes, adjustHeight])

  async function patchProject(id: number, data: Partial<Pick<Project, 'title' | 'notes' | 'checklist'>>) {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...data } : p))
    await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  }

  async function createProject(e?: React.FormEvent) {
    e?.preventDefault()
    if (!newTitle.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      })
      if (!res.ok) throw new Error()
      const created: Project = await res.json()
      setProjects(prev => [...prev, created])
      setActiveId(created.id)
      setNewTitle('')
      toast('Project added', 'info')
    } catch {
      toast('Failed to add project', 'warning')
    }
    setAdding(false)
  }

  async function deleteProject(id: number) {
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      const remaining = projects.filter(p => p.id !== id)
      setProjects(remaining)
      setActiveId(remaining[0]?.id ?? null)
      setConfirmDeleteId(null)
      setModalOpen(false)
      toast('Project deleted', 'warning')
    } catch {
      toast('Failed to delete project', 'warning')
    }
  }

  function handleNotesChange(val: string) {
    if (!active) return
    const projectId = active.id
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, notes: val } : p))
    adjustHeight()
    pendingNotes.current = { id: projectId, notes: val }
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => {
      fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: val }),
      }).then(() => { pendingNotes.current = null }).catch(() => {})
    }, 600)
  }

  function startEditTitle() {
    if (!active) return
    setTitleDraft(active.title)
    setEditingTitle(true)
  }

  async function commitTitle() {
    if (!active) return
    const trimmed = titleDraft.trim()
    setEditingTitle(false)
    if (!trimmed || trimmed === active.title) return
    await patchProject(active.id, { title: trimmed })
  }

  // ── Checklist ──
  // Race-safe: each mutation runs through a functional setProjects updater,
  // so toggling/adding/deleting always reads the latest committed list.
  // Server saves are debounced (250ms) and serialized via AbortController so
  // out-of-order responses can't overwrite newer state.
  const checklistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const checklistAbort = useRef<AbortController | null>(null)
  const pendingChecklist = useRef<{ id: number; json: string } | null>(null)
  const pendingNotes = useRef<{ id: number; notes: string } | null>(null)

  // Flush pending saves on unmount (don't lose last keystroke if user navigates away)
  useEffect(() => {
    return () => {
      if (checklistTimer.current) clearTimeout(checklistTimer.current)
      if (notesTimer.current) clearTimeout(notesTimer.current)
      const cl = pendingChecklist.current
      if (cl) {
        fetch(`/api/projects/${cl.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checklist: cl.json }),
          keepalive: true,
        }).catch(() => {})
      }
      const n = pendingNotes.current
      if (n) {
        fetch(`/api/projects/${n.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: n.notes }),
          keepalive: true,
        }).catch(() => {})
      }
    }
  }, [])

  function checklistItems(p: Project): ChecklistItem[] {
    return parseChecklist(p.checklist)
  }

  function scheduleChecklistSave(projectId: number, json: string) {
    pendingChecklist.current = { id: projectId, json }
    if (checklistTimer.current) clearTimeout(checklistTimer.current)
    checklistTimer.current = setTimeout(() => {
      if (checklistAbort.current) checklistAbort.current.abort()
      const ctrl = new AbortController()
      checklistAbort.current = ctrl
      fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklist: json }),
        signal: ctrl.signal,
      }).then(() => { pendingChecklist.current = null }).catch(() => {})
    }, 250)
  }

  function mutateChecklist(fn: (items: ChecklistItem[]) => ChecklistItem[]) {
    if (!active) return
    const projectId = active.id
    let nextJson = ''
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p
      const next = fn(parseChecklist(p.checklist))
      nextJson = JSON.stringify(next)
      return { ...p, checklist: nextJson }
    }))
    scheduleChecklistSave(projectId, nextJson)
  }

  function addItem() {
    if (!active || !newItem.trim()) return
    const text = newItem.trim()
    mutateChecklist(items => [...items, { id: Date.now().toString() + Math.random().toString(36).slice(2,6), text, done: false }])
    setNewItem('')
    newItemRef.current?.focus()
  }

  function toggleItem(id: string) {
    mutateChecklist(items => items.map(i => i.id === id ? { ...i, done: !i.done } : i))
  }

  function deleteItem(id: string) {
    mutateChecklist(items => items.filter(i => i.id !== id))
  }

  function clearDone() {
    mutateChecklist(items => items.filter(i => !i.done))
  }

  if (!loaded) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const items = active ? checklistItems(active) : []
  const doneCount = items.filter(i => i.done).length

  const totalDoneAll = projects.reduce((s, p) => {
    try { const list = JSON.parse(p.checklist) as { done: boolean }[]; return s + list.filter(i => i.done).length } catch { return s }
  }, 0)
  const totalItemsAll = projects.reduce((s, p) => {
    try { return s + (JSON.parse(p.checklist) as unknown[]).length } catch { return s }
  }, 0)
  const overallPct = totalItemsAll > 0 ? Math.round((totalDoneAll / totalItemsAll) * 100) : 0

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Projects"
        title={<>{projects.length}<span className="text-on-surface-variant/50"> active</span></>}
        sub="Per-project notes + checklist. Click any card to expand the detail view."
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        <StatCard label="Active" value={projects.length} sub="projects" />
        <StatCard label="Items" value={totalItemsAll} sub={`${totalDoneAll} done`} />
        <StatCard label="Progress" value={overallPct} suffix="%" sub="across all projects" color={scoreColor(overallPct)} barPct={overallPct} />
      </div>

      {/* Add project */}
      <form onSubmit={createProject}
        className="bg-surface-container border border-outline-variant/40 rounded-2xl p-3 flex items-center gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          placeholder="New project title…"
          className="flex-1 text-sm bg-transparent border-0 outline-none text-on-surface placeholder-white/50 px-1"
        />
        <button type="submit" disabled={!newTitle.trim() || adding}
          className="px-3 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40 transition-colors shadow-sm">
          Add
        </button>
      </form>

      {projects.length === 0 ? (
        <div className="text-center py-16 text-on-surface-variant">
          <div className="w-14 h-14 bg-surface-container rounded-2xl border border-outline-variant/40 flex items-center justify-center mx-auto mb-4 text-2xl shadow-sm">📁</div>
          <p className="font-semibold text-on-surface-variant/60">No projects yet</p>
          <p className="text-sm mt-1">Add one above to get started.</p>
        </div>
      ) : (
        <>
          {/* Project name list */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {projects.map(p => {
              const pItems = checklistItems(p)
              const pDone = pItems.filter(i => i.done).length
              return (
                <button key={p.id} onClick={() => openProject(p.id)}
                  className="glass neon-card rounded-xl border border-outline-variant/40 px-4 py-3 text-left flex items-center gap-3 transition-all">
                  <span className="flex-1 text-sm font-semibold text-on-surface truncate">{p.title}</span>
                  {pItems.length > 0 && (
                    <span className="shrink-0 text-[10px] text-on-surface-variant/60 font-medium">{pDone}/{pItems.length}</span>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Modal */}
      {mounted && modalOpen && active && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto"
          onClick={closeModal}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="glass rounded-2xl border w-full max-w-2xl my-auto overflow-hidden shadow-2xl"
          ><div className="contents">

              {/* Header: title + delete */}
              <div className="px-4 py-3 border-b border-outline-variant/40 flex items-center gap-2">
                {editingTitle ? (
                  <input
                    autoFocus
                    type="text"
                    value={titleDraft}
                    onChange={e => setTitleDraft(e.target.value)}
                    onBlur={commitTitle}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); commitTitle() }
                      if (e.key === 'Escape') setEditingTitle(false)
                    }}
                    className="flex-1 text-base font-semibold bg-transparent border-0 border-b border-violet-400 outline-none text-on-surface pb-0.5"
                  />
                ) : (
                  <h3 onDoubleClick={startEditTitle}
                    className="flex-1 text-base font-semibold text-on-surface cursor-text">
                    {active.title}
                  </h3>
                )}
                {!editingTitle && (
                  <button onClick={startEditTitle} title="Rename"
                    className="p-1.5 rounded-lg text-xs text-on-surface-variant/40 hover:text-violet-400 hover:bg-violet-500/10 transition-all">
                    ✏
                  </button>
                )}
                {confirmDeleteId === active.id ? (
                  <>
                    <button onClick={() => deleteProject(active.id)}
                      className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-rose-500 text-white hover:bg-rose-600 transition-colors">Delete</button>
                    <button onClick={() => setConfirmDeleteId(null)}
                      className="px-2 py-1 rounded-lg text-[10px] font-semibold text-on-surface-variant/60 hover:text-on-surface-variant transition-colors">Cancel</button>
                  </>
                ) : (
                  <button onClick={() => setConfirmDeleteId(active.id)}
                    title="Delete project"
                    className="w-8 h-8 flex items-center justify-center rounded-xl text-sm font-bold text-on-surface-variant/40 hover:text-rose-500 hover:bg-rose-500/15 transition-all">
                    🗑
                  </button>
                )}
                <button onClick={closeModal}
                  title="Close"
                  className="w-8 h-8 flex items-center justify-center rounded-xl text-base font-bold text-on-surface-variant/60 hover:text-on-surface hover:bg-surface-container-high transition-all">
                  ✕
                </button>
              </div>

              {/* Notes */}
              <div className="px-4 py-3 border-b border-outline-variant/40 flex items-center gap-2">
                <span className="text-base">📝</span>
                <h4 className="text-sm font-semibold text-on-surface">Notes</h4>
                <span className="ml-auto text-[10px] text-on-surface-variant/30 font-medium">auto-saved</span>
              </div>
              <textarea
                ref={notesRef}
                value={active.notes}
                onChange={e => handleNotesChange(e.target.value)}
                placeholder="Project context, links, decisions…"
                style={{ minHeight: '80px' }}
                className="w-full px-4 py-3 text-sm text-on-surface bg-transparent placeholder-white/50 resize-none outline-none leading-relaxed overflow-hidden"
              />

              {/* Checklist */}
              <div className="px-4 py-3 border-y border-outline-variant/40 flex items-center gap-2">
                <span className="text-base">☑</span>
                <h4 className="text-sm font-semibold text-on-surface">Checklist</h4>
                {items.length > 0 && (
                  <span className="ml-1 text-[10px] text-on-surface-variant font-medium">{doneCount}/{items.length}</span>
                )}
                {doneCount > 0 && (
                  <button onClick={clearDone}
                    className="ml-auto text-[11px] text-on-surface-variant hover:text-rose-400 font-medium transition-colors">
                    Clear done
                  </button>
                )}
              </div>

              {items.length > 0 && (
                <div className="divide-y divide-outline-variant/40">
                  {items.map(item => (
                    <div key={item.id}
                      className="flex items-start gap-2 px-3 py-2.5 group hover:bg-surface-container-low transition-colors">
                      <button onClick={() => toggleItem(item.id)}
                        className={`mt-0.5 shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                          item.done
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-outline-variant hover:border-violet-400 hover:bg-violet-500/10'
                        }`}>
                        {item.done && (
                          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                      <span className={`flex-1 text-sm leading-snug pt-0.5 ${item.done ? 'line-through text-on-surface-variant/30' : 'text-on-surface'}`}>
                        {item.text}
                      </span>
                      <button onClick={() => deleteItem(item.id)}
                        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl text-sm font-bold text-on-surface-variant/40 hover:text-rose-500 hover:bg-rose-500/15 opacity-0 group-hover:opacity-100 transition-all">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add item */}
              <div className="flex items-center gap-2 px-4 py-3 border-t border-outline-variant/40">
                <div className="shrink-0 w-5 h-5 rounded-md border-2 border-dashed border-outline-variant flex items-center justify-center text-on-surface-variant/30 text-xs font-bold">
                  +
                </div>
                <input
                  ref={newItemRef}
                  type="text"
                  value={newItem}
                  onChange={e => setNewItem(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem() } }}
                  placeholder="Add a checklist item…"
                  className="flex-1 text-sm bg-transparent border-0 outline-none text-on-surface placeholder-white/50"
                />
                {newItem.trim() && (
                  <button onClick={addItem}
                    className="shrink-0 px-2.5 py-1 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors shadow-sm">
                    Add
                  </button>
                )}
              </div>

            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
