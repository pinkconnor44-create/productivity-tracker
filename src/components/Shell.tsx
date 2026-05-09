'use client'
import { useState, useEffect, useRef, ReactNode, useCallback } from 'react'
import { scoreColor } from '@/components/ui'

// ──────────────────────────────────────────────────────────────────────────
// Z-INDEX LADDER (documented for future modals — keep in sync with new code)
//
//   Aurora orbs / dot grid:        -z-10
//   View content (default):         z-0
//   Sticky desktop sidebar:         z-30
//   Mobile top bar:                 z-30
//   Mobile drawer + backdrop:       z-40
//   Modals via createPortal(body):  z-50
//   Toasts + month-cell tooltips:   z-[60]
//
// Modals already mount at document.body via createPortal so they escape any
// DOM-sibling stacking context. Internal z-50 ensures they sit above the
// sticky sidebar (which creates a stacking context via position: sticky).
// ──────────────────────────────────────────────────────────────────────────

export type Tab =
  | 'calendar' | 'tasks' | 'habits' | 'lifts'
  | 'stats' | 'projects' | 'weekly-review' | 'scratchpad' | 'settings'

type DayScore = { completed: number; total: number; pct: number }
type ScoreData = Record<string, DayScore>

type Props = {
  activeTab: Tab
  onTabChange: (t: Tab) => void
  views: Partial<Record<Tab, ReactNode>>
}

type NavItem = { id: Tab; label: string; icon: ReactNode }

const NAV_ITEMS: NavItem[] = [
  { id: 'tasks',         label: 'Tasks',         icon: <IconTasks    /> },
  { id: 'habits',        label: 'Habits',        icon: <IconHabits   /> },
  { id: 'lifts',         label: 'Lifts',         icon: <IconLifts    /> },
  { id: 'stats',         label: 'Stats',         icon: <IconStats    /> },
  { id: 'calendar',      label: 'Calendar',      icon: <IconCalendar /> },
  { id: 'projects',      label: 'Projects',      icon: <IconProjects /> },
  { id: 'weekly-review', label: 'Weekly Review', icon: <IconReview   /> },
  { id: 'scratchpad',    label: 'Scratchpad',    icon: <IconNote     /> },
]

const NAV_ORDER_KEY = 'nav-order-v1'

function loadOrder(): Tab[] {
  if (typeof window === 'undefined') return NAV_ITEMS.map(i => i.id)
  try {
    const raw = localStorage.getItem(NAV_ORDER_KEY)
    if (!raw) return NAV_ITEMS.map(i => i.id)
    const parsed = JSON.parse(raw) as Tab[]
    const valid = parsed.filter(id => NAV_ITEMS.some(i => i.id === id))
    // Append any new items not in saved order (forward-compat for future tabs)
    const missing = NAV_ITEMS.map(i => i.id).filter(id => !valid.includes(id))
    return [...valid, ...missing]
  } catch {
    return NAV_ITEMS.map(i => i.id)
  }
}
function saveOrder(order: Tab[]) {
  try { localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(order)) } catch {}
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function addDays(s: string, n: number): string {
  const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function calcStreak(scores: ScoreData): number {
  const t = todayStr()
  let check = scores[t]?.completed > 0 ? t : addDays(t, -1)
  let streak = 0, emptyRun = 0
  for (let i = 0; i < 400; i++) {
    const s = scores[check]
    if (!s) {
      emptyRun++
      if (emptyRun > 7) break
      check = addDays(check, -1); continue
    }
    emptyRun = 0
    if (s.completed === 0) break
    streak++
    check = addDays(check, -1)
  }
  return streak
}
function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
function fmtToday(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function Shell({ activeTab, onTabChange, views }: Props) {
  const [mounted, setMounted] = useState<Set<Tab>>(() => new Set([activeTab]))
  const [scores, setScores] = useState<ScoreData>({})
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [navOrder, setNavOrder] = useState<Tab[]>(() => NAV_ITEMS.map(i => i.id))
  const [dragOver, setDragOver] = useState<Tab | null>(null)
  const dragIdRef = useRef<Tab | null>(null)

  // Hydrate saved order on mount (avoids SSR/client mismatch)
  useEffect(() => { setNavOrder(loadOrder()) }, [])

  function reorder(fromId: Tab, toId: Tab) {
    if (fromId === toId) return
    setNavOrder(prev => {
      const fromIdx = prev.indexOf(fromId)
      const toIdx = prev.indexOf(toId)
      if (fromIdx === -1 || toIdx === -1) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      saveOrder(next)
      return next
    })
  }

  const orderedItems = navOrder
    .map(id => NAV_ITEMS.find(i => i.id === id))
    .filter((x): x is NavItem => !!x)

  // Lazy-mount: each view enters the DOM the first time it becomes active and stays.
  useEffect(() => {
    if (mounted.has(activeTab)) return
    setMounted(prev => { const next = new Set(prev); next.add(activeTab); return next })
  }, [activeTab, mounted])

  // Score refresh — listens for cross-view dispatches and refetches on tab change.
  useEffect(() => {
    const t = todayStr()
    const refresh = () => {
      fetch(`/api/scores?startDate=${t.slice(0, 4)}-01-01&endDate=${t}`)
        .then(r => r.ok ? r.json() : {}).then(setScores).catch(() => {})
    }
    refresh()
    window.addEventListener('score-refresh', refresh)
    return () => window.removeEventListener('score-refresh', refresh)
  }, [])
  useEffect(() => {
    window.dispatchEvent(new Event('score-refresh'))
  }, [activeTab])

  // Drawer body-scroll lock + Escape close.
  useEffect(() => {
    if (!drawerOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [drawerOpen])

  const todayScore = scores[todayStr()]
  const todayPct = todayScore?.pct ?? 0
  const streak = calcStreak(scores)

  const taskBadgeRef = useRef<{ overdue: number }>({ overdue: 0 })

  const onNavClick = useCallback((t: Tab) => {
    onTabChange(t)
    setDrawerOpen(false)
  }, [onTabChange])

  const sidebarBody = (
    <>
      <Logo />
      <TodayWidget pct={todayPct} streak={streak} />
      <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto -mx-1 px-1 py-1">
        {orderedItems.map(item => (
          <NavItem
            key={item.id}
            id={item.id}
            icon={item.icon}
            label={item.label}
            active={activeTab === item.id}
            isDragOver={dragOver === item.id}
            isDragging={dragIdRef.current === item.id}
            onTap={() => onNavClick(item.id)}
            onDragStart={() => { dragIdRef.current = item.id }}
            onDragOver={(targetId) => {
              if (dragIdRef.current && dragIdRef.current !== targetId) setDragOver(targetId)
            }}
            onDragEnd={(targetId) => {
              const from = dragIdRef.current
              if (from && targetId && from !== targetId) reorder(from, targetId)
              dragIdRef.current = null
              setDragOver(null)
            }}
          />
        ))}
      </nav>
      <FooterRow
        active={activeTab === 'settings'}
        onSettings={() => onNavClick('settings')}
      />
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col gap-5 sticky top-0 h-screen w-[240px] shrink-0 px-3.5 py-5 z-30 bg-surface/65 backdrop-blur-xl border-r border-violet-500/12"
      >
        {sidebarBody}
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 bg-surface/75 backdrop-blur-xl border-b border-outline-variant/40">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            className="w-10 h-10 flex items-center justify-center rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low active:bg-surface-container-high transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-display font-bold tracking-tight leading-none gradient-text truncate">
              {greeting()}
            </h1>
            <div className="text-[11px] text-on-surface-variant/60 leading-none mt-1">{fmtToday()}</div>
          </div>
          {streak > 0 && (
            <span className="streak-glow text-[12px] font-bold text-orange-400 leading-none whitespace-nowrap shrink-0">
              🔥 {streak}d
            </span>
          )}
        </div>
      </header>

      {/* Mobile drawer */}
      <div
        className={`md:hidden fixed inset-0 z-40 transition-opacity ${
          drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!drawerOpen}
      >
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        />
        <aside
          className={`absolute top-0 left-0 bottom-0 w-[280px] max-w-[85vw] bg-surface flex flex-col gap-5 px-3.5 py-5 border-r border-violet-500/20 shadow-2xl transition-transform duration-200 ${
            drawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {sidebarBody}
        </aside>
      </div>

      {/* Main view stack — lazy-mount + keep-mounted */}
      <main className="flex-1 min-w-0 relative z-0">
        {Array.from(mounted).map(tab => {
          const wide = tab === 'calendar' || tab === 'stats'
          const containerClass = wide
            ? 'mx-auto w-full max-w-container px-4 sm:px-6 py-5'
            : 'mx-auto w-full max-w-3xl px-4 sm:px-6 py-5'
          return (
            <div key={tab} className={tab === activeTab ? 'tab-fade' : 'hidden'}>
              <div className={containerClass}>{views[tab]}</div>
            </div>
          )
        })}
      </main>
    </>
  )
}

// ── sub-components ─────────────────────────────────────────────────────

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-1.5">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center font-display font-bold text-white text-sm shrink-0"
        style={{
          background: 'linear-gradient(135deg, var(--c-p-hex), var(--c-g-mid))',
          boxShadow: '0 0 16px rgba(var(--c-p), 0.4)',
        }}
      >
        L
      </div>
      <div>
        <div className="font-display text-[14px] font-semibold tracking-tight text-on-surface leading-none">
          Lumina
        </div>
        <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/50 mt-1 leading-none">
          Productivity
        </div>
      </div>
    </div>
  )
}

function TodayWidget({ pct, streak }: { pct: number; streak: number }) {
  const c = scoreColor(pct)
  return (
    <div className="px-3.5 py-3 rounded-xl bg-surface-container-low border border-outline-variant/40">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/50">
          Today
        </span>
        {streak > 0 && (
          <span className="streak-glow text-[11px] font-bold text-orange-400 leading-none whitespace-nowrap">
            🔥 {streak}d
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1 mt-1.5">
        <span className="font-display text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums" style={{ color: c }}>
          {pct}
        </span>
        <span className="text-[12px] font-semibold text-on-surface-variant/70">%</span>
      </div>
      <div className="h-[3px] bg-white/5 rounded-full mt-2 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c }} />
      </div>
      <div className="text-[11px] text-on-surface-variant/55 mt-2 leading-none">{fmtToday()}</div>
    </div>
  )
}

// Long-press threshold (ms) before a press becomes a drag
const LONG_PRESS_MS = 350
// Movement threshold (px) before a press is treated as scroll/cancel
const PRESS_MOVE_CANCEL = 8

function NavItem({ id, icon, label, active, isDragOver, isDragging, onTap, onDragStart, onDragOver, onDragEnd }: {
  id: Tab
  icon: ReactNode
  label: string
  active: boolean
  isDragOver?: boolean
  isDragging?: boolean
  onTap: () => void
  onDragStart?: () => void
  onDragOver?: (targetId: Tab) => void
  onDragEnd?: (targetId: Tab | null) => void
}) {
  // Pointer-event drag: works for both mouse and touch (mobile-friendly).
  // Long-press initiates drag; short tap fires onTap; movement before long-press cancels.
  const [pressed, setPressed] = useState(false)
  const dragStateRef = useRef<{
    pid: number | null
    startX: number
    startY: number
    longPressTimer: ReturnType<typeof setTimeout> | null
    isDragging: boolean
  }>({ pid: null, startX: 0, startY: 0, longPressTimer: null, isDragging: false })

  function clearTimer() {
    const s = dragStateRef.current
    if (s.longPressTimer) { clearTimeout(s.longPressTimer); s.longPressTimer = null }
  }

  function findTargetTabAt(x: number, y: number): Tab | null {
    const el = document.elementFromPoint(x, y)
    const navEl = el?.closest('[data-tab]') as HTMLElement | null
    return (navEl?.dataset.tab as Tab) ?? null
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Only react to primary button / single-touch
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const s = dragStateRef.current
    s.pid = e.pointerId
    s.startX = e.clientX
    s.startY = e.clientY
    s.isDragging = false
    setPressed(true)

    s.longPressTimer = setTimeout(() => {
      // Promote to drag
      s.isDragging = true
      onDragStart?.()
      try { (e.currentTarget as HTMLElement)?.setPointerCapture?.(s.pid!) } catch {}
    }, LONG_PRESS_MS)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const s = dragStateRef.current
    if (s.pid !== e.pointerId) return
    const dx = e.clientX - s.startX
    const dy = e.clientY - s.startY

    if (!s.isDragging) {
      // Cancel long-press if user moved beyond threshold (likely scrolling)
      if (Math.hypot(dx, dy) > PRESS_MOVE_CANCEL) {
        clearTimer()
        s.pid = null
        setPressed(false)
      }
      return
    }
    // Active drag: prevent scroll, hit-test
    e.preventDefault()
    const target = findTargetTabAt(e.clientX, e.clientY)
    if (target && target !== id) onDragOver?.(target)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const s = dragStateRef.current
    if (s.pid !== e.pointerId) return
    clearTimer()
    setPressed(false)

    if (s.isDragging) {
      const target = findTargetTabAt(e.clientX, e.clientY)
      onDragEnd?.(target && target !== id ? target : null)
      try { (e.currentTarget as HTMLElement)?.releasePointerCapture?.(e.pointerId) } catch {}
    } else {
      // Short press → tap
      onTap()
    }
    s.pid = null
    s.isDragging = false
  }

  const handlePointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    const s = dragStateRef.current
    if (s.pid !== e.pointerId) return
    clearTimer()
    if (s.isDragging) onDragEnd?.(null)
    setPressed(false)
    s.pid = null
    s.isDragging = false
  }

  return (
    <button
      type="button"
      data-tab={id}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className={[
        'group relative flex items-center gap-3 w-full px-3.5 py-2.5 rounded-lg text-left font-medium transition-colors touch-none',
        isDragging ? 'opacity-40 scale-[0.98]' : pressed ? 'scale-[0.99]' : '',
        isDragOver ? 'ring-2 ring-violet-400/70' : '',
        active
          ? 'bg-violet-500/16 border border-violet-400/30 text-on-surface font-semibold'
          : 'border border-transparent text-on-surface-variant/70 active:bg-surface-container-low md:hover:text-on-surface md:hover:bg-surface-container-low/50',
      ].join(' ')}
    >
      <span className={`w-4 h-4 inline-flex items-center justify-center shrink-0 ${active ? 'text-violet-300' : ''}`}>
        {icon}
      </span>
      <span className="text-[13px] tracking-[-0.005em] flex-1">{label}</span>
      <span className="opacity-30 md:opacity-0 md:group-hover:opacity-30 text-[10px] leading-none select-none" aria-hidden>⋮⋮</span>
    </button>
  )
}

function FooterRow({ active, onSettings }: { active: boolean; onSettings: () => void }) {
  return (
    <div className="flex items-center gap-2 pt-3 border-t border-outline-variant/40">
      <button
        onClick={onSettings}
        aria-label="Settings"
        className={[
          'flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-[12px] font-semibold transition-colors',
          active
            ? 'bg-violet-500/16 border border-violet-400/30 text-violet-300'
            : 'border border-outline-variant/40 text-on-surface-variant/70 hover:text-on-surface hover:bg-surface-container-low',
        ].join(' ')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        Settings
      </button>
      <PowerButton />
    </div>
  )
}

function PowerButton() {
  const [confirm, setConfirm] = useState(false)
  async function shutdown() {
    await fetch('/api/shutdown', { method: 'POST' }).catch(() => {})
  }
  if (confirm) {
    return (
      <button
        onClick={shutdown}
        className="h-10 px-3 flex items-center rounded-xl bg-rose-500 text-white text-[11px] font-semibold animate-pulse hover:bg-rose-600 transition-colors"
      >
        Stop?
      </button>
    )
  }
  return (
    <button
      onClick={() => { setConfirm(true); setTimeout(() => setConfirm(false), 3000) }}
      title="Stop server"
      aria-label="Stop server"
      className="w-10 h-10 flex items-center justify-center rounded-xl border border-outline-variant/40 text-on-surface-variant/60 hover:text-rose-400 hover:bg-rose-500/15 transition-colors text-base"
    >
      ⏻
    </button>
  )
}

// ── icons ──────────────────────────────────────────────────────────────

function IconTasks() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  )
}
function IconHabits() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v6m0 0c-3 0-5 3-5 6 0 4 3 8 5 8s5-4 5-8c0-3-2-6-5-6z" />
    </svg>
  )
}
function IconLifts() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6v12M18 6v12M2 9v6M22 9v6M6 12h12" />
    </svg>
  )
}
function IconStats() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 5-7" />
    </svg>
  )
}
function IconCalendar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}
function IconProjects() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  )
}
function IconReview() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11H7v9h10v-9h-2" /><path d="M9 4h6v4H9z" /><path d="M9 14h6M9 17h6" />
    </svg>
  )
}
function IconNote() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="13" y2="17" />
    </svg>
  )
}
