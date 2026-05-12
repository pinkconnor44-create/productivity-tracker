'use client'
import { useState, useEffect } from 'react'
import { PageHeader, Card } from '@/components/ui'

export type AccentTheme = 'violet' | 'green' | 'red' | 'pink' | 'cyan'

const THEMES: {
  id: AccentTheme
  label: string
  hex: string
  light: string
  glow: string
}[] = [
  { id: 'violet', label: 'Violet', hex: '#7c3aed', light: '#a78bfa', glow: 'rgba(139,92,246,0.5)'  },
  { id: 'green',  label: 'Green',  hex: '#10b981', light: '#34d399', glow: 'rgba(16,185,129,0.5)'  },
  { id: 'red',    label: 'Red',    hex: '#f43f5e', light: '#fb7185', glow: 'rgba(244,63,94,0.5)'   },
  { id: 'pink',   label: 'Pink',   hex: '#ec4899', light: '#f472b6', glow: 'rgba(236,72,153,0.5)'  },
  { id: 'cyan',   label: 'Cyan',   hex: '#06b6d4', light: '#22d3ee', glow: 'rgba(6,182,212,0.5)'   },
]

export function applyTheme(theme: AccentTheme) {
  try { localStorage.setItem('accent-theme', theme) } catch {}
  if (theme === 'violet') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', theme)
  }
}

// Migrates legacy `'purple'` localStorage value to `'violet'`. Safe to call repeatedly.
// localStorage is wrapped in try/catch — Safari private mode throws on access.
export function readAccentTheme(): AccentTheme {
  if (typeof window === 'undefined') return 'violet'
  try {
    const stored = localStorage.getItem('accent-theme')
    if (stored === 'purple') {
      try { localStorage.setItem('accent-theme', 'violet') } catch {}
      return 'violet'
    }
    if (stored && (['violet','green','red','pink','cyan'] as const).includes(stored as AccentTheme)) {
      return stored as AccentTheme
    }
  } catch {}
  return 'violet'
}

export default function SettingsView() {
  const [accent, setAccent] = useState<AccentTheme>('violet')

  useEffect(() => {
    setAccent(readAccentTheme())
  }, [])

  function handleTheme(theme: AccentTheme) {
    setAccent(theme)
    applyTheme(theme)
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <PageHeader
        eyebrow="Settings"
        title="Preferences"
      />

      {/* Accent Color */}
      <Card padding={24} className="neon-card">
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/70 mb-1">
          Accent Color
        </div>
        <p className="text-xs text-on-surface-variant/70 mb-5">
          Changes the neon glow, gradients, aurora, and all UI accents throughout the app.
        </p>

        <div className="flex gap-4 flex-wrap">
          {THEMES.map(theme => {
            const active = accent === theme.id
            return (
              <button
                key={theme.id}
                onClick={() => handleTheme(theme.id)}
                className="flex flex-col items-center gap-2.5 group"
              >
                {/* Color swatch */}
                <div
                  className="w-12 h-12 rounded-2xl transition-all duration-300"
                  style={{
                    background: `linear-gradient(135deg, ${theme.hex}, ${theme.light})`,
                    boxShadow: active
                      ? `0 0 0 3px white, 0 0 0 5px ${theme.hex}, 0 0 20px ${theme.glow}`
                      : `0 2px 8px ${theme.glow}`,
                    transform: active ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
                {/* Label */}
                <span
                  className="text-[11px] font-semibold transition-all duration-200"
                  style={{ color: active ? theme.hex : undefined }}
                >
                  {active ? (
                    <span style={{ color: theme.hex }}>{theme.label}</span>
                  ) : (
                    <span className="text-on-surface-variant">{theme.label}</span>
                  )}
                </span>
              </button>
            )
          })}
        </div>

        {/* Active theme preview strip */}
        <div className="mt-6 pt-5 border-t border-outline-variant/40">
          <div className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Preview</div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Gradient text sample */}
            <span className="text-sm font-bold gradient-text">Gradient Text</span>
            {/* Neon button sample */}
            <div
              className="px-3 py-1 rounded-lg text-xs font-semibold text-white"
              style={{ background: `linear-gradient(135deg, ${THEMES.find(t=>t.id===accent)?.hex}, ${THEMES.find(t=>t.id===accent)?.light})`, boxShadow: `0 0 12px ${THEMES.find(t=>t.id===accent)?.glow}` }}
            >
              Active State
            </div>
            {/* Ring sample */}
            <div
              className="w-6 h-6 rounded-full border-2"
              style={{ borderColor: THEMES.find(t=>t.id===accent)?.hex, boxShadow: `0 0 8px ${THEMES.find(t=>t.id===accent)?.glow}` }}
            />
            {/* Dot sample */}
            <div
              className="w-3 h-3 rounded-full"
              style={{ background: THEMES.find(t=>t.id===accent)?.hex, boxShadow: `0 0 6px ${THEMES.find(t=>t.id===accent)?.glow}` }}
            />
          </div>
        </div>
      </Card>

      {/* About */}
      <Card padding={24} className="neon-card">
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/70 mb-3">About</div>
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-xs text-on-surface-variant">App</span>
            <span className="text-xs font-semibold text-on-surface">Productivity Tracker</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-on-surface-variant">Theme engine</span>
            <span className="text-xs font-semibold text-on-surface">CSS Custom Properties</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-on-surface-variant">Mode</span>
            <span className="text-xs font-semibold text-on-surface">Dark only (Lumina)</span>
          </div>
        </div>
      </Card>
    </div>
  )
}
