'use client'
import { useState } from 'react'
import Shell, { Tab } from '@/components/Shell'
import CalendarView from '@/components/CalendarView'
import TasksView from '@/components/TasksView'
import HabitsView from '@/components/HabitsView'
import StatsView from '@/components/StatsView'
import SettingsView from '@/components/SettingsView'
import LiftTracker from '@/components/LiftTracker'
import ProjectsView from '@/components/ProjectsView'
import ToastContainer from '@/components/ToastContainer'
import { StopwatchProvider } from '@/lib/stopwatch'

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('calendar')

  // Views are constructed once. Shell handles lazy-mount + keep-mounted via its
  // internal `mounted` set; views passed here don't execute until Shell mounts them.
  const views: Partial<Record<Tab, React.ReactNode>> = {
    calendar: <CalendarView />,
    tasks: <TasksView />,
    habits: <HabitsView />,
    lifts: <LiftTracker />,
    stats: <StatsView />,
    projects: <ProjectsView />,
    settings: <SettingsView />,
  }

  return (
    <div className="min-h-screen md:flex">
      <div className="aurora-orb aurora-orb-1" />
      <div className="aurora-orb aurora-orb-2" />
      <div className="aurora-orb aurora-orb-3" />
      <div className="dot-grid" />

      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="wGreen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
          <linearGradient id="wYellow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffb829" />
            <stop offset="100%" stopColor="#f5a300" />
          </linearGradient>
          <linearGradient id="wRed" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#f5a300" />
          </linearGradient>
        </defs>
      </svg>

      <StopwatchProvider>
        <Shell activeTab={activeTab} onTabChange={setActiveTab} views={views} />
      </StopwatchProvider>

      <ToastContainer />
    </div>
  )
}
