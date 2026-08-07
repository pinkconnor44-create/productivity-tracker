'use client'
import { useId } from 'react'

export type TrendPoint = { date: string; value: number }
export type TrendTip = { x: number; y: number; text: string }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function today(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`
}
function formatLabel(dateStr: string): string {
  return new Date(dateStr+'T12:00:00').toLocaleDateString('en-US',{ month:'short', day:'numeric' })
}

type Props = {
  data: TrendPoint[]
  onHover: (tip: TrendTip | null) => void
  /** y-axis bounds. Omit to auto-fit with 10% headroom — needed for HRV (ms),
   *  RHR (bpm), wrist temp (°F) etc., which are nowhere near a 0-100 scale. */
  domain?: [number, number]
  /** Gridline values in data units. Defaults to five even steps across the domain. */
  gridValues?: number[]
  /** Trailing moving-average overlay. null disables it. */
  movingAvgWindow?: number | null
  /** Line/fill colour. Defaults to the accent. */
  color?: string
  /** Tooltip value formatting. Defaults to a bare percentage. */
  format?: (v: number) => string
  emptyMessage?: string
}

// Score line chart with an optional moving-average overlay.
// Extracted from StatsView so BevelView's Trends tab consumes it rather than
// forking a copy (plan.md:73 originally called for a copy).
export function TrendChart({
  data,
  onHover,
  domain,
  gridValues,
  movingAvgWindow = 7,
  color = 'var(--c-p-hex)',
  format = v => `${v}%`,
  emptyMessage = 'Complete tasks and habits to start seeing your trend here.',
}: Props) {
  // Unique per instance — the Trends tab renders several of these on one page,
  // and a shared gradient id would make every chart after the first reference
  // the wrong <defs>. Colons from useId are stripped: legal in an HTML id but
  // they break any CSS selector that later needs to reach this element.
  const fillId = `trendFill-${useId().replace(/:/g, '')}`

  if (data.length === 0) return (
    <div className="flex flex-col items-center justify-center h-40 gap-2">
      <span className="text-2xl">📊</span>
      <p className="text-sm text-on-surface-variant">No data yet</p>
      <p className="text-xs text-on-surface-variant/30 text-center max-w-[220px]">{emptyMessage}</p>
    </div>
  )

  const W = 1000, H = 200
  const PL = 36, PR = 16, PT = 16, PB = 28
  const cw = W - PL - PR, ch = H - PT - PB
  const n = data.length

  const values = data.map(d => d.value)
  const [lo, hi] = domain ?? (() => {
    const min = Math.min(...values), max = Math.max(...values)
    if (min === max) return [min - 1, max + 1] as [number, number]
    const pad = (max - min) * 0.1
    return [min - pad, max + pad] as [number, number]
  })()
  const span = hi - lo || 1

  const xOf = (i: number) => PL + (n === 1 ? cw/2 : (i / (n-1)) * cw)
  const yOf = (v: number) => PT + ch - ((v - lo) / span) * ch

  const grid = gridValues ?? Array.from({ length: 5 }, (_, i) => lo + (span * i) / 4)

  const points = data.map((d,i) => ({ x: xOf(i), y: yOf(d.value), value: d.value, date: d.date }))
  const linePath = points.map((p,i) => `${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaPath = [
    `M${points[0].x.toFixed(1)},${(PT+ch).toFixed(1)}`,
    ...points.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    `L${points[points.length-1].x.toFixed(1)},${(PT+ch).toFixed(1)}Z`,
  ].join(' ')

  const avgPath = movingAvgWindow
    ? data.map((_, i) => {
        const slice = values.slice(Math.max(0, i - (movingAvgWindow - 1)), i + 1)
        return slice.reduce((s, v) => s + v, 0) / slice.length
      }).map((v, i) => `${i===0?'M':'L'}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ')
    : null

  // X-axis: one tick per month change
  const monthTicks: { i: number; label: string }[] = []
  let lastMonth: string | null = null
  for (let i = 0; i < n; i++) {
    const m = data[i].date.slice(5, 7)
    if (m !== lastMonth) { monthTicks.push({ i, label: MONTHS[Number(m)-1] }); lastMonth = m }
  }

  const tipFor = (p: typeof points[number], e: { clientX: number; clientY: number }) =>
    ({ x: e.clientX, y: e.clientY, text: `${formatLabel(p.date)} · ${format(p.value)}` })

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.30" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {grid.map((v, i) => {
        const y = yOf(v)
        const edge = i === 0 || i === grid.length - 1
        return (
          <g key={i}>
            <line x1={PL} y1={y} x2={W-PR} y2={y} stroke="rgba(var(--c-p),0.10)" strokeWidth="1" strokeDasharray={edge ? '' : '2,4'} />
            <text x={PL-6} y={y+4} textAnchor="end" fontSize="10" fill="#6b7088" fontWeight="600">{Math.round(v)}</text>
          </g>
        )
      })}
      {monthTicks.map(t => (
        <text key={t.i} x={xOf(t.i)} y={H-8} textAnchor="start" fontSize="10" fill="#8b8da3" fontWeight="700" letterSpacing="0.08em">{t.label.toUpperCase()}</text>
      ))}
      <path d={areaPath} fill={`url(#${fillId})`} />
      <path d={linePath} fill="none" stroke={color} strokeOpacity="0.55" strokeWidth="1.5" strokeLinejoin="round" />
      {avgPath && <path d={avgPath} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />}
      {points.map((p,i) => (
        <g key={i}
          onMouseEnter={e => onHover(tipFor(p, e))}
          onMouseMove={e => onHover(tipFor(p, e))}
          onMouseLeave={() => onHover(null)}>
          {/* transparent hit area — see CLAUDE.md "SVG chart tooltips" */}
          <circle cx={p.x} cy={p.y} r="6" fill="transparent" />
          {/* stroke tracks the page canvas; was a hardcoded #0b1326, which
              would have rendered as a navy halo once the surface goes black */}
          {p.date === today() && <circle cx={p.x} cy={p.y} r="4" fill={color} stroke="var(--surface)" strokeWidth="2" />}
        </g>
      ))}
    </svg>
  )
}
