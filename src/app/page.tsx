'use client'
import { useState, useEffect, useRef } from 'react'
import CalendarView from '@/components/CalendarView'
import TasksView from '@/components/TasksView'
import HabitsView from '@/components/HabitsView'
import StatsView from '@/components/StatsView'
import WeeklyReview from '@/components/WeeklyReview'
import HotmapView from '@/components/HotmapView'
import SettingsView, { applyTheme } from '@/components/SettingsView'
import LiftTracker from '@/components/LiftTracker'
import ToastContainer from '@/components/ToastContainer'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

type Tab = 'calendar' | 'tasks' | 'habits' | 'stats' | 'weekly-review' | 'hotmap' | 'lifts' | 'settings'
type DayScore = { completed: number; total: number; pct: number }
type ScoreData = Record<string, DayScore>

function today(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function calcCurrentStreak(scores: ScoreData): number {
  const t = today()
  let check = scores[t]?.completed > 0 ? t : addDays(t, -1)
  let streak = 0
  let emptyRun = 0
  for (let i = 0; i < 400; i++) {
    const s = scores[check]
    if (!s) {
      emptyRun++
      if (emptyRun > 7) break
      check = addDays(check, -1)
      continue
    }
    emptyRun = 0
    if (s.completed === 0) break
    streak++
    check = addDays(check, -1)
  }
  return streak
}

const PRIMARY_TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'calendar', label: 'Calendar', icon: '📅' },
  { id: 'tasks',    label: 'Tasks',    icon: '✓'  },
  { id: 'habits',   label: 'Habits',   icon: '🔄' },
  { id: 'lifts',    label: 'Lifts',    icon: '🏋️' },
]

const MORE_TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'stats',         label: 'Stats',         icon: '📊' },
  { id: 'weekly-review', label: 'Weekly Review', icon: '📋' },
  { id: 'hotmap',        label: 'Hotmap',        icon: '🟩' },
  { id: 'settings',      label: 'Settings',      icon: '⚙️' },
]

function PowerButton() {
  const [confirm, setConfirm] = useState(false)
  async function shutdown() {
    await fetch('/api/shutdown', { method: 'POST' }).catch(() => {})
  }
  if (confirm) return (
    <button onClick={shutdown}
      className="h-8 px-2.5 flex items-center rounded-xl bg-rose-500 text-white text-[11px] font-semibold hover:bg-rose-600 transition-all animate-pulse">
      Stop?
    </button>
  )
  return (
    <button onClick={() => { setConfirm(true); setTimeout(() => setConfirm(false), 3000) }}
      title="Stop server"
      className="w-8 h-8 flex items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant/60 hover:text-rose-400 hover:bg-rose-500/15 transition-all text-sm">
      ⏻
    </button>
  )
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('calendar')
  const [scores, setScores] = useState<ScoreData>({})
  const [moreOpen, setMoreOpen] = useState(false)
  const navRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const moreRef = useRef<HTMLDivElement>(null)
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null)

  useEffect(() => {
    const accent = localStorage.getItem('accent-theme')
    if (accent && accent !== 'purple') applyTheme(accent as Parameters<typeof applyTheme>[0])
  }, [])

  useEffect(() => {
    const t = today()
    const refresh = () => {
      fetch(`/api/scores?startDate=${t.slice(0, 4)}-01-01&endDate=${t}`)
        .then(r => r.ok ? r.json() : {}).then(setScores)
    }
    refresh()
    window.addEventListener('score-refresh', refresh)
    return () => window.removeEventListener('score-refresh', refresh)
  }, [activeTab])

  useEffect(() => {
    const idx = PRIMARY_TABS.findIndex(t => t.id === activeTab)
    if (idx === -1) { setPill(null); return }
    const btn = tabRefs.current[idx]
    const nav = navRef.current
    if (!btn || !nav) return
    const navRect = nav.getBoundingClientRect()
    const btnRect = btn.getBoundingClientRect()
    setPill({ left: btnRect.left - navRect.left, width: btnRect.width })
  }, [activeTab])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const streak = calcCurrentStreak(scores)

  return (
    <div className="min-h-screen flex flex-col">

      <div className="aurora-orb aurora-orb-1" />
      <div className="aurora-orb aurora-orb-2" />
      <div className="aurora-orb aurora-orb-3" />
      <div className="dot-grid" />

      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="wGreen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
          <linearGradient id="wYellow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#fb923c" />
          </linearGradient>
          <linearGradient id="wRed" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#fb923c" />
          </linearGradient>
        </defs>
      </svg>

      <header className="sticky top-0 z-40 bg-surface/60 backdrop-blur-2xl border-b border-outline-variant/40">
        <div className="max-w-3xl mx-auto px-6 pt-3 pb-2 space-y-2.5">

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-base font-display font-bold tracking-tight leading-none gradient-text">
                {greeting()}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-on-surface-variant/60 leading-none">
                  {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                {streak > 0 && (
                  <span className="streak-glow text-[11px] font-bold text-orange-400 leading-none">🔥 {streak}d</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <PowerButton />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div ref={navRef} className="relative flex flex-1 bg-surface-container-low rounded-xl p-0.5 gap-0.5">
              {pill && (
                <div
                  className="neon-pill absolute top-0.5 bottom-0.5 rounded-[10px] bg-surface-container-high pointer-events-none"
                  style={{ left: pill.left, width: pill.width }}
                />
              )}
              {PRIMARY_TABS.map((tab, i) => (
                <button key={tab.id}
                  ref={el => { tabRefs.current[i] = el }}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex-1 flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-[10px] text-[11px] font-semibold transition-colors duration-150 ${
                    activeTab === tab.id
                      ? 'text-violet-400'
                      : 'text-on-surface-variant/70 hover:text-on-surface'
                  }`}>
                  <span className="leading-none text-sm">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            <div ref={moreRef} className="relative">
              <button
                onClick={() => setMoreOpen(o => !o)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-colors duration-150 ${
                  MORE_TABS.some(t => t.id === activeTab) || moreOpen
                    ? 'bg-surface-container-high text-violet-400 shadow-sm'
                    : 'bg-surface-container-low text-on-surface-variant/70 hover:text-on-surface'
                }`}
              >
                {MORE_TABS.some(t => t.id === activeTab)
                  ? <><span className="text-sm leading-none">{MORE_TABS.find(t => t.id === activeTab)!.icon}</span><span className="hidden sm:inline">{MORE_TABS.find(t => t.id === activeTab)!.label}</span></>
                  : <span>••• </span>
                }
                <span className="text-[9px] opacity-60">{moreOpen ? '▲' : '▼'}</span>
              </button>

              {moreOpen && (
                <div className="glass absolute right-0 top-full mt-1.5 z-50 w-44 rounded-2xl overflow-hidden">
                  {MORE_TABS.map(tab => (
                    <button key={tab.id}
                      onClick={() => { setActiveTab(tab.id); setMoreOpen(false) }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-[12px] font-semibold transition-colors ${
                        activeTab === tab.id
                          ? 'text-violet-400 bg-violet-500/15'
                          : 'text-on-surface-variant hover:bg-surface-container-low'
                      }`}>
                      <span className="text-base leading-none">{tab.icon}</span>
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </header>

      <main className={`relative z-10 flex-1 mx-auto w-full px-6 py-5 ${activeTab === 'calendar' || activeTab === 'hotmap' ? 'max-w-container' : 'max-w-3xl'}`}>
        <div key={activeTab} className="tab-fade">
          {activeTab === 'calendar'      && <CalendarView />}
          {activeTab === 'tasks'         && <TasksView />}
          {activeTab === 'habits'        && <HabitsView />}
          {activeTab === 'stats'         && <StatsView />}
          {activeTab === 'weekly-review' && <WeeklyReview />}
          {activeTab === 'hotmap'        && <HotmapView />}
          {activeTab === 'lifts'         && <LiftTracker />}
          {activeTab === 'settings'      && <SettingsView />}
        </div>
      </main>

      <ToastContainer />

    </div>
  )
}
