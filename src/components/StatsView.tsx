'use client'
import { useState, useEffect } from 'react'
import { PageHeader, StatCard, Card, Section, scoreColor } from '@/components/ui'

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
function formatDateLong(s: string): string {
  return new Date(s+'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
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
    if (prev && d === addDays(prev,1)) cur++; else cur = 1
    if (cur > longest) longest = cur
    prev = d
  }
  return longest
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

type Range = '30' | '90' | '365'

// 90-day score line chart with 7-day moving avg overlay (Variation A's main chart pattern).
function TrendChart({ data, onHover }: { data: { date: string; pct: number }[]; onHover: (tip: { x: number; y: number; text: string } | null) => void }) {
  if (data.length === 0) return (
    <div className="flex flex-col items-center justify-center h-40 gap-2">
      <span className="text-2xl">📊</span>
      <p className="text-sm text-on-surface-variant">No data yet</p>
      <p className="text-xs text-on-surface-variant/30 text-center max-w-[220px]">Complete tasks and habits to start seeing your trend here.</p>
    </div>
  )

  const W = 1000, H = 200
  const PL = 36, PR = 16, PT = 16, PB = 28
  const cw = W - PL - PR, ch = H - PT - PB
  const n = data.length
  const xOf = (i: number) => PL + (n === 1 ? cw/2 : (i / (n-1)) * cw)
  const yOf = (pct: number) => PT + ch - (pct / 100) * ch

  const points = data.map((d,i) => ({ x: xOf(i), y: yOf(d.pct), pct: d.pct, date: d.date }))
  const linePath = points.map((p,i) => `${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaPath = [
    `M${points[0].x.toFixed(1)},${(PT+ch).toFixed(1)}`,
    ...points.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    `L${points[points.length-1].x.toFixed(1)},${(PT+ch).toFixed(1)}Z`,
  ].join(' ')

  // 7-day moving average
  const avg = data.map((_, i) => {
    const slice = data.slice(Math.max(0, i - 6), i + 1)
    return slice.reduce((s, d) => s + d.pct, 0) / slice.length
  })
  const avgPath = avg.map((v, i) => `${i===0?'M':'L'}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ')

  // X-axis: month tick marks
  const monthTicks: { i: number; label: string }[] = []
  let lastMonth: string | null = null
  for (let i = 0; i < n; i++) {
    const m = data[i].date.slice(5, 7)
    if (m !== lastMonth) { monthTicks.push({ i, label: MONTHS[Number(m)-1] }); lastMonth = m }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs>
        <linearGradient id="statsScoreFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--c-p-hex)" stopOpacity="0.30" />
          <stop offset="100%" stopColor="var(--c-p-hex)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0,25,50,75,100].map(pct => {
        const y = yOf(pct)
        return (
          <g key={pct}>
            <line x1={PL} y1={y} x2={W-PR} y2={y} stroke="rgba(var(--c-p),0.10)" strokeWidth="1" strokeDasharray={pct === 0 || pct === 100 ? '' : '2,4'} />
            <text x={PL-6} y={y+4} textAnchor="end" fontSize="10" fill="#6b7088" fontWeight="600">{pct}</text>
          </g>
        )
      })}
      {monthTicks.map(t => (
        <text key={t.i} x={xOf(t.i)} y={H-8} textAnchor="start" fontSize="10" fill="#8b8da3" fontWeight="700" letterSpacing="0.08em">{t.label.toUpperCase()}</text>
      ))}
      <path d={areaPath} fill="url(#statsScoreFill)" />
      <path d={linePath} fill="none" stroke="var(--c-p-hex)" strokeOpacity="0.55" strokeWidth="1.5" strokeLinejoin="round" />
      <path d={avgPath} fill="none" stroke="var(--c-p-hex)" strokeWidth="2.5" strokeLinejoin="round" />
      {points.map((p,i) => {
        const isToday = p.date === today()
        return (
          <g key={i}
            onMouseEnter={e => onHover({ x: e.clientX, y: e.clientY, text: `${formatLabel(p.date)} · ${p.pct}%` })}
            onMouseMove={e => onHover({ x: e.clientX, y: e.clientY, text: `${formatLabel(p.date)} · ${p.pct}%` })}
            onMouseLeave={() => onHover(null)}>
            <circle cx={p.x} cy={p.y} r="6" fill="transparent" />
            {isToday && <circle cx={p.x} cy={p.y} r="4" fill="var(--c-p-hex)" stroke="#0b1326" strokeWidth="2" />}
          </g>
        )
      })}
    </svg>
  )
}

// Day-of-week breakdown bars (90d avg score by weekday)
function WeekdayBars({ data }: { data: { date: string; pct: number }[] }) {
  const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const buckets = [0,1,2,3,4,5,6].map(dow => {
    const items = data.filter(d => new Date(d.date+'T12:00:00').getDay() === dow)
    const avg = items.length ? Math.round(items.reduce((s,d) => s + d.pct, 0) / items.length) : 0
    return { dow, avg, count: items.length }
  })
  return (
    <div className="grid grid-cols-7 gap-2">
      {buckets.map(b => (
        <div key={b.dow} className="flex flex-col items-center gap-1.5">
          <div className="h-[90px] w-full flex items-end justify-center">
            <div
              className="w-full rounded-t-md min-h-[2px]"
              style={{ height: `${b.avg}%`, background: scoreColor(b.avg) }}
            />
          </div>
          <div className="font-display text-[14px] font-semibold leading-none text-on-surface tabular-nums">
            {b.avg}<span className="text-[9px] text-on-surface-variant/50 font-semibold">%</span>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant/50">{WEEKDAYS[b.dow]}</div>
        </div>
      ))}
    </div>
  )
}

// 365-day activity heatmap.
function YearHeatmap({ scores, todayStr, onHover }: {
  scores: ScoreData
  todayStr: string
  onHover: (tip: { date: string; x: number; y: number } | null) => void
}) {
  const startDate = addDays(todayStr, -364)
  const gridStartD = new Date(startDate + 'T12:00:00')
  const gridStart = addDays(startDate, -gridStartD.getDay())
  const weeks: string[][] = []
  let cur = gridStart
  while (cur <= todayStr) {
    const week: string[] = []
    for (let d = 0; d < 7; d++) { week.push(cur); cur = addDays(cur, 1) }
    weeks.push(week)
  }
  const monthLabels: { label: string; col: number }[] = []
  weeks.forEach((week, col) => {
    const m = new Date(week[0] + 'T12:00:00').getMonth()
    const prevM = col > 0 ? new Date(weeks[col-1][0] + 'T12:00:00').getMonth() : -1
    if (m !== prevM) monthLabels.push({ label: MONTHS[m], col })
  })

  function cellBg(score: DayScore | undefined, isFuture: boolean, isOutOfRange: boolean): string {
    if (isFuture || isOutOfRange) return 'bg-transparent'
    if (!score || score.total === 0) return 'bg-surface-container-low'
    const p = score.pct
    if (p === 100) return 'bg-emerald-400'
    if (p >= 75)  return 'bg-emerald-500/70'
    if (p >= 50)  return 'bg-violet-500/70'
    if (p >= 25)  return 'bg-amber-500/65'
    return 'bg-rose-500/70'
  }

  return (
    <div className="overflow-x-auto pb-1">
      <div className="inline-block min-w-max">
        <div className="flex mb-1.5 ml-7">
          {weeks.map((_, col) => {
            const ml = monthLabels.find(m => m.col === col)
            return (
              <div key={col} className="w-[14px] mr-[2px] shrink-0">
                {ml && <span className="text-[10px] font-medium text-on-surface-variant whitespace-nowrap leading-none">{ml.label}</span>}
              </div>
            )
          })}
        </div>
        <div className="flex gap-[2px]">
          <div className="flex flex-col gap-[2px] mr-1.5 shrink-0 w-5">
            {['S','M','T','W','T','F','S'].map((d, i) => (
              <div key={i} className="h-[14px] flex items-center justify-end">
                {i % 2 === 1 && <span className="text-[9px] text-on-surface-variant leading-none">{d}</span>}
              </div>
            ))}
          </div>
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
                      ${interactive ? 'hover:brightness-110 hover:scale-125' : ''}
                      ${isToday ? 'ring-2 ring-violet-500 ring-offset-1 ring-offset-surface' : ''}
                      ${score?.pct === 100 ? 'shadow-sm shadow-emerald-400/40' : ''}
                    `}
                    onMouseMove={e => { if (interactive) onHover({ date, x: e.clientX, y: e.clientY }) }}
                    onMouseLeave={() => onHover(null)}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function StatsView() {
  const [range, setRange] = useState<Range>('90')
  const [scores365, setScores365] = useState<ScoreData>({})
  const [loading, setLoading] = useState(true)
  const [chartTip, setChartTip] = useState<{ x: number; y: number; text: string } | null>(null)
  const [heatTip, setHeatTip] = useState<{ date: string; x: number; y: number } | null>(null)

  // Always fetch 365d so heatmap has full data; chart slices from this.
  useEffect(() => {
    setLoading(true)
    const t = today()
    const start = addDays(t, -364)
    fetch(`/api/scores?startDate=${start}&endDate=${t}`)
      .then(r => r.ok ? r.json() : {})
      .then(data => { setScores365(data); setLoading(false) })
  }, [])

  const t = today()
  const rangeDays = parseInt(range)
  const start = addDays(t, -(rangeDays - 1))

  // Chart data: every day in range that has a score
  const chartData: { date: string; pct: number }[] = []
  let cur = start
  while (cur <= t) {
    if (scores365[cur]) chartData.push({ date: cur, pct: scores365[cur].pct })
    cur = addDays(cur, 1)
  }

  const activeDays = Object.keys(scores365).filter(d => d >= start && d <= t && scores365[d].total > 0)
  const avgPct = activeDays.length === 0 ? null
    : Math.round(activeDays.reduce((s,d) => s + scores365[d].pct, 0) / activeDays.length)
  const last7 = chartData.slice(-7)
  const prev7 = chartData.slice(-14, -7)
  const avg7 = last7.length ? Math.round(last7.reduce((s,d) => s + d.pct, 0) / last7.length) : 0
  const prevAvg7 = prev7.length ? Math.round(prev7.reduce((s,d) => s + d.pct, 0) / prev7.length) : 0
  const delta = avg7 - prevAvg7

  const todayScore = scores365[t]
  const currentStreak = calcCurrentStreak(scores365)
  const longestStreak = calcLongestStreak(scores365)
  const perfectDays = activeDays.filter(d => scores365[d].pct === 100).length

  // Best/worst in range
  const sorted = [...activeDays].sort((a, b) => scores365[b].pct - scores365[a].pct)
  const best = sorted[0]
  const worst = sorted[sorted.length - 1]

  // Best streak ≥75% across full 365d
  let bestPctStreak = 0, runStreak = 0
  for (const d of Object.keys(scores365).sort()) {
    if (scores365[d].pct >= 75) { runStreak++; bestPctStreak = Math.max(bestPctStreak, runStreak) }
    else runStreak = 0
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Stats"
        title={<>You&apos;re at <span className="text-violet-400">{avg7}%</span> this week</>}
        right={
          <div className="flex bg-surface-container-low border border-outline-variant/40 rounded-lg p-0.5 gap-0.5">
            {(['30','90','365'] as Range[]).map(r => (
              <button key={r} onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors ${
                  range===r ? 'bg-violet-500/16 text-violet-300 border border-violet-400/30' : 'text-on-surface-variant/70 hover:text-on-surface'
                }`}>{r}d</button>
            ))}
          </div>
        }
      />

      {/* Stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <StatCard label="Today" value={todayScore?.pct ?? 0} suffix="%" sub={`${todayScore?.completed ?? 0}/${todayScore?.total ?? 0} weighted`} color={scoreColor(todayScore?.pct)} barPct={todayScore?.pct ?? 0} />
        <StatCard label="Last 7 days" value={avg7} suffix="%" sub={`${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta)} pts vs prior week`} color={delta >= 0 ? '#10b981' : '#f43f5e'} barPct={avg7} />
        <StatCard label={`Last ${range} days`} value={avgPct ?? '—'} suffix={avgPct != null ? '%' : undefined} sub="weighted average" color={avgPct != null ? scoreColor(avgPct) : undefined} barPct={avgPct ?? 0} />
        <StatCard label="Current streak" value={currentStreak} suffix="d" sub={`longest ${longestStreak}d`} color="#fb923c" barPct={Math.min(100, currentStreak * 6)} />
      </div>

      {/* 90-day trend chart */}
      <Section
        label={`Daily Score · ${range} days`}
        right={
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[11px] text-on-surface-variant/70 font-semibold">
              <span className="w-3.5 h-0.5" style={{ background: 'var(--c-p-hex)' }} /> 7d avg
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-on-surface-variant/55 font-semibold">
              <span className="w-3.5 h-0.5" style={{ background: 'var(--c-p-hex)', opacity: 0.55 }} /> daily
            </span>
          </div>
        }
      >
        <Card padding={20}>
          {loading
            ? <div className="flex items-center justify-center h-40 text-on-surface-variant text-sm">Loading…</div>
            : <TrendChart data={chartData} onHover={setChartTip} />}
        </Card>
      </Section>

      {/* By weekday + Best/Worst */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section label={`By Weekday · ${range}d avg`} color="#f59e0b" dotColor="#f59e0b">
          <Card padding={20}>
            <WeekdayBars data={chartData} />
            <div className="flex justify-between mt-5 pt-4 border-t border-outline-variant/30">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant/50 mb-1">Best day</div>
                <div className="font-display text-[16px] font-semibold text-emerald-400">{best ? `${scores365[best].pct}%` : '—'}</div>
                <div className="text-[10px] text-on-surface-variant/50 mt-0.5">{best ? formatLabel(best) : ''}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant/50 mb-1">Worst day</div>
                <div className="font-display text-[16px] font-semibold text-rose-400">{worst ? `${scores365[worst].pct}%` : '—'}</div>
                <div className="text-[10px] text-on-surface-variant/50 mt-0.5">{worst ? formatLabel(worst) : ''}</div>
              </div>
            </div>
          </Card>
        </Section>

        <Section label="Quality streak" color="#22d3ee" dotColor="#22d3ee">
          <Card padding={20}>
            <div className="flex flex-col gap-3 h-full">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant/50 mb-1">Longest run ≥ 75%</div>
                <div className="font-display text-[36px] font-semibold text-on-surface tabular-nums leading-none">{bestPctStreak}<span className="text-[14px] text-on-surface-variant/50 ml-1">days</span></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant/50 mb-1">Active days</div>
                  <div className="font-display text-[20px] font-semibold text-on-surface tabular-nums">{activeDays.length}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant/50 mb-1">Perfect days</div>
                  <div className="font-display text-[20px] font-semibold text-emerald-400 tabular-nums">{perfectDays}</div>
                </div>
              </div>
            </div>
          </Card>
        </Section>
      </div>

      {/* 365-day heatmap */}
      <Section label="365-day Activity" color="#a78bfa" dotColor="#a78bfa">
        <Card padding={20}>
          {loading
            ? <div className="h-28 flex items-center justify-center text-on-surface-variant text-sm">Loading…</div>
            : <YearHeatmap scores={scores365} todayStr={t} onHover={setHeatTip} />}
          <div className="flex items-center gap-2 mt-4">
            <span className="text-[10px] text-on-surface-variant/60">Less</span>
            {['bg-surface-container-low', 'bg-rose-500/70', 'bg-amber-500/65', 'bg-violet-500/70', 'bg-emerald-500/70', 'bg-emerald-400']
              .map((c, i) => <div key={i} className={`w-[14px] h-[14px] rounded-sm ${c}`} />)}
            <span className="text-[10px] text-on-surface-variant/60">More</span>
          </div>
        </Card>
      </Section>

      {/* Tooltips */}
      {chartTip && (
        <div className="fixed z-[60] pointer-events-none"
          style={{ left: chartTip.x, top: chartTip.y - 10, transform: 'translate(-50%, -100%)' }}>
          <div className="bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-2.5 py-1.5 shadow-xl text-xs whitespace-nowrap">
            {chartTip.text}
          </div>
        </div>
      )}
      {heatTip && (
        <div className="fixed z-[60] pointer-events-none"
          style={{ left: heatTip.x, top: heatTip.y - 8, transform: 'translate(-50%, -100%)' }}>
          <div className="bg-surface-container-high border border-outline-variant text-on-surface rounded-xl px-3 py-2 shadow-2xl text-xs whitespace-nowrap">
            <div className="font-semibold mb-0.5">{formatDateLong(heatTip.date)}</div>
            {scores365[heatTip.date]?.total > 0 ? (
              <>
                <div className="text-on-surface-variant/55">
                  {scores365[heatTip.date].pct}% · {scores365[heatTip.date].completed}/{scores365[heatTip.date].total} items
                </div>
                {scores365[heatTip.date].pct === 100 && (
                  <div className="text-emerald-400 font-semibold mt-0.5">Perfect day ✓</div>
                )}
              </>
            ) : (
              <div className="text-on-surface-variant/70">No tracked items</div>
            )}
            {heatTip.date === t && (
              <div className="text-violet-400 font-semibold mt-0.5">Today</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
