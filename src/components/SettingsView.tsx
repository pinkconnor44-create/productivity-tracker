'use client'
import { PageHeader, Card } from '@/components/ui'

// The five-accent theme switcher lived here and is gone. A curated palette and
// a colour picker are mutually exclusive, and the switcher never fully worked:
// the [data-theme] rules it drove intercepted bare violet utilities only, so
// roughly a quarter of the accent surface (bg-violet-500/10, /15, /16, /20,
// border-violet-500/30, ring-violet-400/80 …) stayed violet on the other four
// themes regardless of the setting.
//
// `applyTheme` / `readAccentTheme` were exported from here and imported only by
// app/page.tsx. The orphaned localStorage('accent-theme') key is inert —
// nothing sets data-theme on the document any more — so it needs no migration.

export default function SettingsView() {
  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <PageHeader eyebrow="Settings" title="Preferences" />

      <Card padding={24} className="neon-card">
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/70 mb-3">About</div>
        <div className="space-y-1.5">
          <Row label="App" value="Productivity Tracker" />
          <Row label="Theme" value="Void · Electric Iris" />
          <Row label="Mode" value="Dark only" />
        </div>
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-on-surface-variant">{label}</span>
      <span className="text-xs font-semibold text-on-surface">{value}</span>
    </div>
  )
}
