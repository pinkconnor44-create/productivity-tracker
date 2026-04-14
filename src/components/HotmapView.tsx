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
function formatDate(s: string): string {
  return new Date(s+'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}
function calcStreak(scores: ScoreData, todayStr: string): { current: number; longest: number } {
  const dates = Object.keys(scores).filter(d => scores[d].completed > 0).sort()
  let longest = 0, cur = 0, prev: string|null = null
  for (const d of dates) {
    if (prev && d === addDays(prev, 1)) cur++; else cur = 1
    if (cur > longest) longest = cur
    prev = d
  }
  let check = scores[todayStr]?.completed > 0 ? todayStr : addDays(todayStr, -1)
  let current = 0
  for (let i = 0; i < 400; i++) {
    const s = scores[check]
    if (!s || s.completed === 0) break
    current++; check = addDays(check, -1)
  }
  return { current, longest }
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function cellBg(score: DayScore | undefined, isFuture: boolean, isOutOfRange: boolean): string {
  if (isFuture || isOutOfRange) return 'bg-transparent'
  if (!score || score.total === 0) return 'bg-slate-100 dark:bg-white/[0.05]'
  const p = score.pct
  if (p === 100) return 'bg-emerald-500 dark:bg-emerald-400'
  if (p >= 75)  return 'bg-emerald-300 dark:bg-emerald-600/80'
  if (p >= 50)  return 'bg-violet-400 dark:bg-violet-500/80'
  if (p >= 25)  return 'bg-amber-300 dark:bg-amber-500/70'
  return 'bg-rose-400 dark:bg-rose-600/70'
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="neon-card bg-white dark:bg-[#16161e] rounded-2xl border border-slate-100 dark:border-violet-700 p-4 shadow-sm">
      <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-2xl font-bold font-mono ${value === '—' ? 'text-slate-300 dark:text-slate-600' : 'gradient-text'}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-600 dark:text-slate-300 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function HotmapView() {
  const [scores, setScores] = useState<ScoreData>({})
  const [loading, setLoading] = useState(true)
  const [tooltip, setTooltip] = useState<{ date: string; x: number; y: number } | null>(null)
  function handleMouseMove(date: string, e: React.MouseEvent) {
    setTooltip({ date, x: e.clientX, y: e.clientY })
  }

  const todayStr = today()
  const startDate = addDays(todayStr, -364)

  useEffect(() => {
    fetch(`/api/scores?startDate=${startDate}&endDate=${todayStr}`)
      .then(r => r.ok ? r.json() : {})
      .then(d => { setScores(d); setLoading(false) })
  }, [])

  // Build weeks grid: columns = weeks, rows = Sun(0)–Sat(6)
  const gridStartD = new Date(startDate + 'T12:00:00')
  const gridStart = addDays(startDate, -gridStartD.getDay()) // rewind to Sunday

  const weeks: string[][] = []
  let cur = gridStart
  while (cur <= todayStr) {
    const week: string[] = []
    for (let d = 0; d < 7; d++) { week.push(cur); cur = addDays(cur, 1) }
    weeks.push(week)
  }

  // Month labels: one per first column of each new month
  const monthLabels: { label: string; col: number }[] = []
  weeks.forEach((week, col) => {
    const m = new Date(week[0] + 'T12:00:00').getMonth()
    const prevM = col > 0 ? new Date(weeks[col-1][0] + 'T12:00:00').getMonth() : -1
    if (m !== prevM) monthLabels.push({ label: MONTHS[m], col })
  })

  // Stats
  const activeDays = Object.keys(scores).filter(d => scores[d].total > 0 && d >= startDate && d <= todayStr)
  const perfectDays = activeDays.filter(d => scores[d].pct === 100)
  const avgPct = activeDays.length > 0
    ? Math.round(activeDays.reduce((s, d) => s + scores[d].pct, 0) / activeDays.length)
    : null
  const { current: curStreak, longest: longestStreak } = calcStreak(scores, todayStr)

  const animActive  = useCountUp(activeDays.length)
  const animPerfect = useCountUp(perfectDays.length)
  const animStreak  = useCountUp(curStreak)
  const animAvg     = useCountUp(avgPct ?? 0)

  // Monthly averages for breakdown bar
  const monthlyMap: Record<string, { total: number; count: number }> = {}
  activeDays.forEach(d => {
    const key = d.slice(0, 7)
    if (!monthlyMap[key]) monthlyMap[key] = { total: 0, count: 0 }
    monthlyMap[key].total += scores[d].pct
    monthlyMap[key].count++
  })
  const monthlyAvgs = Object.entries(monthlyMap)
    .map(([k, v]) => ({ month: k, avg: Math.round(v.total / v.count) }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12)

  return (
    <div className="space-y-5">

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Active days" value={String(animActive)} sub="in last 365 days" />
        <StatCard label="Perfect days" value={String(animPerfect)} sub="100% completion" />
        <StatCard label="Current streak" value={curStreak > 0 ? `${animStreak}d` : '—'} sub="days in a row" />
        <StatCard label="Average score" value={avgPct !== null ? `${animAvg}%` : '—'} sub={`over ${activeDays.length} days`} />
      </div>

      {/* Heatmap */}
      <div className="neon-card bg-white dark:bg-[#16161e] rounded-2xl border border-slate-100 dark:border-violet-700 p-5 shadow-sm">
        <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-4">
          365-day activity
        </div>

        {loading ? (
          <div className="h-28 flex items-center justify-center text-slate-600 dark:text-slate-300 text-sm">Loading…</div>
        ) : (
          <div className="overflow-x-auto pb-1">
            <div className="inline-block min-w-max">

              {/* Month labels row */}
              <div className="flex mb-1.5 ml-7">
                {weeks.map((_, col) => {
                  const ml = monthLabels.find(m => m.col === col)
                  return (
                    <div key={col} className="w-[14px] mr-[2px] shrink-0">
                      {ml && (
                        <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap leading-none">
                          {ml.label}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="flex gap-[2px]">
                {/* Day-of-week labels */}
                <div className="flex flex-col gap-[2px] mr-1.5 shrink-0 w-5">
                  {['S','M','T','W','T','F','S'].map((d, i) => (
                    <div key={i} className="h-[14px] flex items-center justify-end">
                      {i % 2 === 1 && (
                        <span className="text-[9px] text-slate-600 dark:text-slate-300 leading-none">{d}</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Week columns */}
                {weeks.map((week, col) => (
                  <div key={col} className="flex flex-col gap-[2px]">
                    {week.map(date => {
                      const isFuture = date > todayStr
                      const isOutOfRange = date < startDate
                      const score = scores[date]
                      const isToday = date === todayStr
                      const bg = cellBg(score, isFuture, isOutOfRange)
                      const interactive = !isFuture && !isOutOfRange

                      return (
                        <div
                          key={date}
                          className={`w-[14px] h-[14px] rounded-sm transition-all duration-150 ${bg}
                            ${interactive ? 'cursor-default hover:brightness-110 hover:scale-125' : 'cursor-default'}
                            ${isToday ? 'ring-2 ring-violet-500 ring-offset-1 ring-offset-white dark:ring-offset-[#16161e]' : ''}
                            ${score?.pct === 100 ? 'shadow-sm shadow-emerald-400/40' : ''}
                          `}
                          onMouseMove={e => { if (interactive) handleMouseMove(date, e) }}
                          onMouseLeave={() => setTooltip(null)}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-2 mt-4 ml-7">
                <span className="text-[10px] text-slate-600 dark:text-slate-300">Less</span>
                <div className="flex items-center gap-1">
                  {[
                    'bg-slate-100 dark:bg-white/[0.05]',
                    'bg-rose-400 dark:bg-rose-600/70',
                    'bg-amber-300 dark:bg-amber-500/70',
                    'bg-violet-400 dark:bg-violet-500/80',
                    'bg-emerald-300 dark:bg-emerald-600/80',
                    'bg-emerald-500 dark:bg-emerald-400',
                  ].map((c, i) => (
                    <div key={i} className={`w-[14px] h-[14px] rounded-sm ${c}`} />
                  ))}
                </div>
                <span className="text-[10px] text-slate-600 dark:text-slate-300">More</span>
                <span className="ml-4 text-[10px] text-slate-300 dark:text-slate-600">
                  No data · &lt;25% · 25–49% · 50–74% · 75–99% · 100%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Monthly breakdown */}
      {monthlyAvgs.length > 0 && (
        <div className="neon-card bg-white dark:bg-[#16161e] rounded-2xl border border-slate-100 dark:border-violet-700 p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-4">Monthly average</div>
          <div className="space-y-2">
            {monthlyAvgs.map(({ month, avg }) => {
              const d = new Date(month + '-01T12:00:00')
              const label = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
              const color = avg >= 75 ? 'bg-emerald-500' : avg >= 50 ? 'bg-violet-500' : avg >= 25 ? 'bg-amber-400' : 'bg-rose-400'
              const textColor = avg >= 75 ? 'text-emerald-600 dark:text-emerald-400' : avg >= 50 ? 'text-violet-600 dark:text-violet-400' : avg >= 25 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-500'
              return (
                <div key={month} className="flex items-center gap-3">
                  <span className="text-xs text-slate-600 dark:text-slate-300 w-16 shrink-0">{label}</span>
                  <div className="flex-1 h-2 bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${avg}%` }} />
                  </div>
                  <span className={`text-xs font-semibold w-9 text-right tabular-nums ${textColor}`}>{avg}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tooltip (fixed, follows hover) */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y - 8, transform: 'translate(-50%, -100%)' }}
        >
          <div className="bg-slate-900 dark:bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 shadow-2xl text-xs whitespace-nowrap">
            <div className="font-semibold mb-0.5">{formatDate(tooltip.date)}</div>
            {scores[tooltip.date]?.total > 0 ? (
              <>
                <div className="text-slate-300">
                  {scores[tooltip.date].pct}% · {scores[tooltip.date].completed}/{scores[tooltip.date].total} items
                </div>
                {scores[tooltip.date].pct === 100 && (
                  <div className="text-emerald-400 font-semibold mt-0.5">Perfect day ✓</div>
                )}
              </>
            ) : (
              <div className="text-slate-500">No tracked items</div>
            )}
            {tooltip.date === todayStr && (
              <div className="text-violet-400 font-semibold mt-0.5">Today</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
