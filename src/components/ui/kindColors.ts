// Task kind palette — independent of accent theme.
// Uses non-violet Tailwind colors so the [data-theme] overrides in globals.css don't recolor kind tags.
// Each kind has: label, dot/ring hex (for SVG/inline use), and Tailwind utility classes.

export type Kind = 'meeting' | 'focus' | 'personal' | 'admin' | 'planning'

export const KIND_LIST: Kind[] = ['meeting', 'focus', 'personal', 'admin', 'planning']

export type KindStyle = {
  label: string
  dot: string         // hex (for SVG, inline border-l, raw style)
  bg: string          // Tailwind bg utility (subtle tint)
  fg: string          // Tailwind text utility
  border: string      // Tailwind border utility
  borderL: string     // Tailwind left-border utility
}

export const KIND_COLORS: Record<Kind, KindStyle> = {
  meeting:  { label: 'Meeting',  dot: '#818cf8', bg: 'bg-indigo-500/15', fg: 'text-indigo-300', border: 'border-indigo-400/30', borderL: 'border-l-indigo-400' },
  focus:    { label: 'Focus',    dot: '#22d3ee', bg: 'bg-cyan-500/15',   fg: 'text-cyan-300',   border: 'border-cyan-400/30',   borderL: 'border-l-cyan-400'   },
  personal: { label: 'Personal', dot: '#f472b6', bg: 'bg-pink-500/15',   fg: 'text-pink-300',   border: 'border-pink-400/30',   borderL: 'border-l-pink-400'   },
  admin:    { label: 'Admin',    dot: '#94a3b8', bg: 'bg-slate-500/15',  fg: 'text-slate-300',  border: 'border-slate-400/30',  borderL: 'border-l-slate-400'  },
  planning: { label: 'Planning', dot: '#f59e0b', bg: 'bg-amber-500/15',  fg: 'text-amber-300',  border: 'border-amber-400/30',  borderL: 'border-l-amber-400'  },
}

export function kindStyle(k: string | null | undefined): KindStyle | null {
  if (!k) return null
  return (KIND_COLORS as Record<string, KindStyle>)[k] ?? null
}
