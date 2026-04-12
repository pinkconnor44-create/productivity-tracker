'use client'
import { useState, useEffect } from 'react'

function useCountUp(target: number, duration = 900): number {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (target === 0) { setVal(0); return }
    let start: number | null = null
    const tick = (ts: number) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target))
      if (p < 1) requestAnimationFrame(tick)
    }
    const id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [target, duration])
  return val
}

type DayScore = { completed: number; total: number; pct: number }
type ScoreData = Record<string, DayScore>

function today(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`
}
function addDays(s: string, n: number): string {
  const d = new Date(s+'T12:00:00'); d.setDate(d.getDate()+n)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function formatLabel(dateStr: string): string {
  const d = new Date(dateStr+'T12:00:00')
  return d.toLocaleDateString('en-US',{ month:'short', day:'numeric' })
}

function calcCurrentStreak(scores: ScoreData): number {
  const t = today()
  let check = scores[t]?.completed > 0 ? t : addDays(t,-1)
  let streak = 0
  for (let i = 0; i < 400; i++) {
    const s = scores[check]
    if (!s || s.completed === 0) break
    streak++
    check = addDays(check,-1)
  }
  return streak
}

function calcLongestStreak(scores: ScoreData): number {
  const dates = Object.keys(scores).filter(d => scores[d].completed > 0).sort()
  let longest = 0, cur = 0, prev: string|null = null
  for (const d of dates) {
    if (prev && d === addDays(prev,1)) { cur++ } else { cur = 1 }
    if (cur > longest) longest = cur
    prev = d
  }
  return longest
}

type Range = '30' | '90' | '365'

// SVG line chart — pure SVG, no library
function TrendChart({ data }: { data: { date: string; pct: number }[] }) {
  if (data.length === 0) return (
    <div className="flex flex-col items-center justify-center h-40 gap-2">
      <span className="text-2xl">📊</span>
      <p className="text-sm text-slate-600 dark:text-slate-300">No data yet</p>
      <p className="text-xs text-slate-300 dark:text-slate-600 text-center max-w-[220px]">Complete tasks and habits to start seeing your trend here.</p>
    </div>
  )

  const W = 560, H = 130
  const PL = 32, PR = 8, PT = 8, PB = 24  // padding
  const cw = W - PL - PR, ch = H - PT - PB

  const n = data.length
  const xOf = (i: number) => PL + (n === 1 ? cw/2 : (i / (n-1)) * cw)
  const yOf = (pct: number) => PT + ch - (pct / 100) * ch

  // Build path strings
  const points = data.map((d,i) => ({ x: xOf(i), y: yOf(d.pct), pct: d.pct, date: d.date }))
  const linePath = points.map((p,i) => `${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaPath = [
    `M${points[0].x.toFixed(1)},${(PT+ch).toFixed(1)}`,
    ...points.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    `L${points[points.length-1].x.toFixed(1)},${(PT+ch).toFixed(1)}Z`
  ].join(' ')

  // X-axis label step
  const step = n <= 30 ? 7 : n <= 90 ? 14 : 60

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: 'var(--c-p-hex)', stopOpacity: 0.18 }} />
          <stop offset="100%" style={{ stopColor: 'var(--c-p-hex)', stopOpacity: 0 }} />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0,25,50,75,100].map(pct => {
        const y = yOf(pct)
        return (
          <g key={pct}>
            <line x1={PL} y1={y} x2={W-PR} y2={y} stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" className="text-slate-900 dark:text-slate-300" />
            <text x={PL-4} y={y+4} textAnchor="end" fontSize="8" fill="currentColor" className="text-slate-600 dark:text-slate-300" fillOpacity="0.7">{pct}%</text>
          </g>
        )
      })}

      {/* 50% threshold line */}
      <line x1={PL} y1={yOf(50)} x2={W-PR} y2={yOf(50)} style={{ stroke: 'var(--c-p-hex)' }} strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3,3" />

      {/* Area fill */}
      <path d={areaPath} fill="url(#chartFill)" />

      {/* Line */}
      <path d={linePath} fill="none" style={{ stroke: 'var(--c-p-hex)' }} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />

      {/* Dots */}
      {points.map((p,i) => {
        const isToday = p.date === today()
        const dotStyle = p.pct >= 80
          ? { fill: '#10b981' }
          : p.pct >= 50
          ? { fill: 'var(--c-p-hex)' }
          : { fill: '#f43f5e' }
        return (
          <circle key={i} cx={p.x} cy={p.y} r={isToday ? 3.5 : n > 60 ? 1.5 : 2.5}
            style={dotStyle} stroke="white" strokeWidth={isToday ? 1.5 : 0} opacity={n > 60 ? 0.7 : 1} />
        )
      })}

      {/* X-axis labels */}
      {points.filter((_,i) => i % step === 0 || i === n-1).map((p,_,arr) => {
        // avoid overlap near end
        const isLast = p === points[n-1]
        const prevLabel = arr.find(a => a !== p && Math.abs(a.x - p.x) < 40)
        if (isLast && prevLabel) return null
        return (
          <text key={p.date} x={p.x} y={H-4} textAnchor="middle" fontSize="7.5" fill="currentColor" fillOpacity="0.55" className="text-slate-600 dark:text-slate-400">
            {formatLabel(p.date)}
          </text>
        )
      })}
    </svg>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="neon-card bg-white dark:bg-[#16161e] rounded-2xl border border-slate-100 dark:border-violet-700 p-4 shadow-sm">
      <div className="text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-2xl font-bold font-mono ${value === '—' ? 'text-slate-300 dark:text-slate-600' : 'gradient-text'}`}>{value}</div>
      {sub && <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function StatsView() {
  const [range, setRange] = useState<Range>('30')
  const [scores, setScores] = useState<ScoreData>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const t = today()
    const start = addDays(t, -(parseInt(range)-1))
    fetch(`/api/scores?startDate=${start}&endDate=${t}`)
      .then(r => r.json())
      .then(data => { setScores(data); setLoading(false) })
  }, [range])

  const t = today()
  const start = addDays(t, -(parseInt(range)-1))

  // Build chart data for every day in range (fill missing with 0 if has data, skip if nothing scheduled)
  const chartData: { date: string; pct: number }[] = []
  let cur = start
  while (cur <= t) {
    if (scores[cur]) chartData.push({ date: cur, pct: scores[cur].pct })
    cur = addDays(cur, 1)
  }

  // Stats
  const activeDays = Object.keys(scores).filter(d => d >= start && d <= t && scores[d].total > 0)
  const avgPct = activeDays.length === 0 ? null
    : Math.round(activeDays.reduce((s,d) => s + scores[d].pct, 0) / activeDays.length)
  const bestDay = activeDays.length === 0 ? null
    : activeDays.reduce((best,d) => scores[d].pct > scores[best].pct ? d : best, activeDays[0])
  const currentStreak = calcCurrentStreak(scores)
  const longestStreak = calcLongestStreak(scores)

  const animAvg    = useCountUp(avgPct ?? 0)
  const animStreak = useCountUp(currentStreak)
  const animLong   = useCountUp(longestStreak)
  const animBest   = useCountUp(bestDay ? scores[bestDay].pct : 0)

  return (
    <div className="space-y-5">
      {/* Range selector */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold gradient-text">Trends</h2>
        <div className="flex bg-slate-100/80 dark:bg-white/[0.05] rounded-xl p-0.5 gap-0.5">
          {(['30','90','365'] as Range[]).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                range===r ? 'bg-white dark:bg-white/10 text-violet-600 dark:text-violet-400 shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-200'
              }`}>{r}d</button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="neon-card bg-white dark:bg-[#16161e] rounded-2xl border border-slate-100 dark:border-violet-700 p-4 shadow-sm">
        <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-3 uppercase tracking-wide">
          Daily completion % — last {range} days
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-600 dark:text-slate-300 text-sm">Loading...</div>
        ) : (
          <TrendChart data={chartData} />
        )}
        <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-600 dark:text-slate-300">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>≥80%</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-600 inline-block"/>50–79%</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block"/>&lt;50%</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Average" value={avgPct !== null ? `${animAvg}%` : '—'} sub={`daily completion · ${activeDays.length} day${activeDays.length !== 1 ? 's' : ''}`} />
        <StatCard label="Best day" value={bestDay ? `${animBest}%` : '—'} sub={bestDay ? formatLabel(bestDay) : undefined} />
        <StatCard label="Current streak" value={currentStreak > 0 ? `${animStreak}d` : '—'} sub={currentStreak > 0 ? 'days in a row' : 'start today!'} />
        <StatCard label="Longest streak" value={longestStreak > 0 ? `${animLong}d` : '—'} sub="all time" />
      </div>

      {/* Completion breakdown */}
      {activeDays.length > 0 && (
        <div className="neon-card bg-white dark:bg-[#16161e] rounded-2xl border border-slate-100 dark:border-violet-700 p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-3">Breakdown</div>
          <div className="space-y-2">
            {(['80','50','0'] as const).map((threshold,i) => {
              const labels = ['Great days (≥80%)', 'Good days (50–79%)', 'Tough days (<50%)']
              const colors = ['bg-emerald-500','bg-violet-500','bg-rose-400']
              const count = activeDays.filter(d => {
                const p = scores[d].pct
                if (threshold==='80') return p >= 80
                if (threshold==='50') return p >= 50 && p < 80
                return p < 50
              }).length
              const pct = Math.round((count/activeDays.length)*100)
              return (
                <div key={threshold} className="flex items-center gap-3">
                  <div className="text-xs text-slate-600 dark:text-slate-300 w-36 shrink-0">{labels[i]}</div>
                  <div className="flex-1 bg-slate-100 dark:bg-white/[0.06] rounded-full h-2 overflow-hidden">
                    <div className={`h-full rounded-full ${colors[i]}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 w-8 text-right">{count}d</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
