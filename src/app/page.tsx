'use client'
import { useState, useEffect } from 'react'
import Shell, { Tab } from '@/components/Shell'
import CalendarView from '@/components/CalendarView'
import TasksView from '@/components/TasksView'
import HabitsView from '@/components/HabitsView'
import StatsView from '@/components/StatsView'
import WeeklyReview from '@/components/WeeklyReview'
import SettingsView, { applyTheme } from '@/components/SettingsView'
import LiftTracker from '@/components/LiftTracker'
import ProjectsView from '@/components/ProjectsView'
import Scratchpad from '@/components/Scratchpad'
import ToastContainer from '@/components/ToastContainer'

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('calendar')

  useEffect(() => {
    const accent = localStorage.getItem('accent-theme')
    if (accent && accent !== 'purple') applyTheme(accent as Parameters<typeof applyTheme>[0])
  }, [])

  // Views are constructed once. Shell handles lazy-mount + keep-mounted via its
  // internal `mounted` set; views passed here don't execute until Shell mounts them.
  const views: Partial<Record<Tab, React.ReactNode>> = {
    calendar: <CalendarView />,
    tasks: <TasksView />,
    habits: <HabitsView />,
    lifts: <LiftTracker />,
    stats: <StatsView />,
    projects: <ProjectsView />,
    'weekly-review': <WeeklyReview />,
    scratchpad: <Scratchpad />,
    settings: <SettingsView />,
  }

  return (
    <div className="min-h-screen flex">
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

      <Shell activeTab={activeTab} onTabChange={setActiveTab} views={views} />

      <ToastContainer />
    </div>
  )
}
