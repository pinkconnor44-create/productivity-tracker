// Stats view — Theme A
const SD = window.AppData;
const ST = window.T;
const { PageHeader: SPageHeader, StatCard: SStatCard, Card: SCard, Section: SSection } = window.Theme;

// 90-day score line chart
function ScoreChart({ data, height = 200 }) {
  if (data.length < 2) return null;
  const W = 1000;
  const H = height;
  const pad = { l: 40, r: 16, t: 16, b: 28 };
  const min = 0, max = 100;
  const xStep = (W - pad.l - pad.r) / (data.length - 1);
  const yFor = v => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
  const xFor = i => pad.l + i * xStep;
  const linePts = data.map((d, i) => `${xFor(i)},${yFor(d.pct)}`).join(' ');
  const areaPts = `${pad.l},${H - pad.b} ${linePts} ${xFor(data.length - 1)},${H - pad.b}`;

  // 7-day rolling avg
  const avg = data.map((_, i) => {
    const slice = data.slice(Math.max(0, i - 6), i + 1);
    return slice.reduce((s, d) => s + d.pct, 0) / slice.length;
  });
  const avgPts = avg.map((v, i) => `${xFor(i)},${yFor(v)}`).join(' ');

  // Month tick marks
  const monthTicks = [];
  let lastMonth = null;
  for (let i = 0; i < data.length; i++) {
    const m = data[i].date.slice(5, 7);
    if (m !== lastMonth) { monthTicks.push({ i, label: SD.MONTHS[Number(m) - 1].slice(0, 3) }); lastMonth = m; }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.30" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="scoreLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      {/* Y-axis lines */}
      {[0, 25, 50, 75, 100].map(v => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={yFor(v)} y2={yFor(v)} stroke="rgba(139,92,246,0.10)" strokeWidth="1" strokeDasharray={v === 0 || v === 100 ? '' : '2,4'} />
          <text x={pad.l - 8} y={yFor(v) + 4} textAnchor="end" fontSize="10" fill="#6b7088" fontFamily="Manrope" fontWeight="600">{v}</text>
        </g>
      ))}
      {/* Month ticks */}
      {monthTicks.map(t => (
        <text key={t.i} x={xFor(t.i)} y={H - 8} textAnchor="start" fontSize="10" fill="#8b8da3" fontFamily="Manrope" fontWeight="700" letterSpacing="0.08em">{t.label.toUpperCase()}</text>
      ))}
      {/* Area + line */}
      <polygon points={areaPts} fill="url(#scoreFill)" />
      <polyline points={linePts} fill="none" stroke="url(#scoreLine)" strokeWidth="1.5" strokeLinejoin="round" opacity="0.55" />
      {/* 7-day avg */}
      <polyline points={avgPts} fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Last point */}
      <circle cx={xFor(data.length - 1)} cy={yFor(avg[avg.length - 1])} r="4" fill="#a78bfa" stroke="#0b1326" strokeWidth="2" />
    </svg>
  );
}

// Heatmap: 90 days as a 13×7 grid (weeks × days)
function YearHeatmap({ data }) {
  const start = SD.addDays(SD.TODAY, -89);
  const startDow = new Date(start + 'T12:00:00').getDay();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push({ pad: true });
  for (const d of data) cells.push(d);
  const cell = 16, gap = 3;
  const cols = Math.ceil(cells.length / 7);
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: gap, fontSize: 10, color: ST.textDim, paddingTop: 2 }}>
        {['Sun','','Tue','','Thu','','Sat'].map((l, i) => (
          <div key={i} style={{ height: cell, lineHeight: `${cell}px`, fontWeight: 600 }}>{l}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridAutoFlow: 'column', gridTemplateRows: `repeat(7, ${cell}px)`, gap }}>
        {cells.map((c, i) => {
          if (c.pad) return <div key={i} />;
          const color = SD.scoreColor(c.pct);
          return (
            <div key={i} title={`${c.date} · ${c.pct}%`} style={{
              width: cell, height: cell, borderRadius: 4,
              background: color,
              opacity: 0.25 + (c.pct / 100) * 0.75,
            }} />
          );
        })}
      </div>
    </div>
  );
}

// Day-of-week breakdown (avg score by weekday)
function WeekdayBars({ data }) {
  const buckets = [0,1,2,3,4,5,6].map(dow => {
    const items = data.filter(d => new Date(d.date+'T12:00:00').getDay() === dow);
    const avg = items.length ? Math.round(items.reduce((s,d) => s + d.pct, 0) / items.length) : 0;
    return { dow, avg, count: items.length };
  });
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
      {buckets.map(b => (
        <div key={b.dow} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ height: 90, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <div style={{
              width: '100%', height: `${b.avg}%`,
              background: SD.scoreColor(b.avg),
              borderRadius: '4px 4px 0 0',
              minHeight: 2,
            }} />
          </div>
          <div style={{ fontFamily: ST.display, fontSize: 14, fontWeight: 600, color: ST.text, lineHeight: 1 }}>{b.avg}<span style={{ fontSize: 9, color: ST.textDim, fontWeight: 600 }}>%</span></div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: ST.textDim, textTransform: 'uppercase' }}>{SD.WEEKDAYS[b.dow]}</div>
        </div>
      ))}
    </div>
  );
}

// Habit performance ranking
function HabitRanking() {
  const rows = SD.HABITS.map(h => {
    const w = SD.habitWindow(h, 30);
    const pct = w.scheduled ? Math.round((w.done / w.scheduled) * 100) : 0;
    return { habit: h, pct, ...w, streak: SD.habitStreak(h) };
  }).sort((a, b) => b.pct - a.pct);
  return (
    <SCard>
      {rows.map((r, i) => (
        <div key={r.habit.id} style={{
          display: 'grid', gridTemplateColumns: '24px 1fr 80px 60px 60px',
          alignItems: 'center', gap: 16,
          padding: '12px 16px',
          borderBottom: i === rows.length - 1 ? 'none' : `1px solid ${ST.borderHair}`,
        }}>
          <span style={{ fontFamily: ST.display, fontSize: 13, fontWeight: 600, color: ST.textDim, textAlign: 'center' }}>{i+1}</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: ST.text }}>{r.habit.name}</span>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${r.pct}%`, background: SD.scoreColor(r.pct), borderRadius: 3 }} />
          </div>
          <span style={{ fontFamily: ST.display, fontSize: 14, fontWeight: 600, color: SD.scoreColor(r.pct), textAlign: 'right', fontFeatureSettings: '"tnum"' }}>{r.pct}%</span>
          <span style={{ fontSize: 12, color: r.streak > 0 ? '#fb923c' : ST.textDim, fontWeight: 600, textAlign: 'right', fontFeatureSettings: '"tnum"' }}>
            {r.streak > 0 ? `🔥${r.streak}` : '—'}
          </span>
        </div>
      ))}
    </SCard>
  );
}

function StatsView() {
  const data90 = SD.scoresWindow(90);
  const data30 = data90.slice(-30);
  const todayScore = data90[data90.length - 1];

  const avg30 = Math.round(data30.reduce((s, d) => s + d.pct, 0) / data30.length);
  const avg7 = Math.round(data30.slice(-7).reduce((s, d) => s + d.pct, 0) / 7);
  const prev7 = Math.round(data30.slice(-14, -7).reduce((s, d) => s + d.pct, 0) / 7);
  const delta = avg7 - prev7;

  const best = [...data30].sort((a, b) => b.pct - a.pct)[0];
  const worst = [...data30].sort((a, b) => a.pct - b.pct)[0];

  // Best streak ≥75%
  let bestStreak = 0, currentStreak = 0;
  for (const d of data90) {
    if (d.pct >= 75) { currentStreak++; bestStreak = Math.max(bestStreak, currentStreak); }
    else currentStreak = 0;
  }

  return (
    <div>
      <SPageHeader
        eyebrow="Stats"
        title={<>You're at <span style={{ color: ST.accent }}>{avg7}%</span> this week</>}
        sub={`90-day rolling view of your weighted completion score. The bold line is a 7-day moving average — smoothed to show direction, not noise.`}
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <SStatCard label="Today" value={todayScore?.pct ?? 0} suffix="%" sub={`${todayScore?.completed ?? 0}/${todayScore?.total ?? 0} weighted`} color={SD.scoreColor(todayScore?.pct)} barPct={todayScore?.pct} />
        <SStatCard label="Last 7 days" value={avg7} suffix="%" sub={`${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta)} pts vs prior week`} color={delta >= 0 ? '#10b981' : '#f43f5e'} barPct={avg7} />
        <SStatCard label="Last 30 days" value={avg30} suffix="%" sub="weighted average" color={SD.scoreColor(avg30)} barPct={avg30} />
        <SStatCard label="Best streak" value={bestStreak} suffix="d" sub="consecutive ≥75% days" color="#fb923c" barPct={Math.min(100, bestStreak * 6)} />
      </div>

      {/* 90-day trend chart */}
      <SSection dot="#a78bfa" color="#a78bfa" label="Daily Score · 90 days" right={
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: ST.textMuted, fontWeight: 600 }}>
            <span style={{ width: 14, height: 2, background: '#a78bfa' }} /> 7d avg
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: ST.textDim, fontWeight: 600 }}>
            <span style={{ width: 14, height: 2, background: 'rgba(167,139,250,0.55)' }} /> daily
          </span>
        </div>
      }>
        <SCard padding={20}>
          <ScoreChart data={data90} />
        </SCard>
      </SSection>

      <div style={{ height: 24 }} />

      {/* Bottom row: heatmap + weekday + best/worst */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
        <SSection dot="#22d3ee" color="#22d3ee" label="Heatmap · 90 days">
          <SCard padding={20}>
            <YearHeatmap data={data90} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 10, color: ST.textDim, fontWeight: 600 }}>
              <span>Less</span>
              <span style={{ width: 12, height: 12, background: SD.scoreColor(20), opacity: 0.35, borderRadius: 3 }} />
              <span style={{ width: 12, height: 12, background: SD.scoreColor(50), opacity: 0.55, borderRadius: 3 }} />
              <span style={{ width: 12, height: 12, background: SD.scoreColor(75), opacity: 0.75, borderRadius: 3 }} />
              <span style={{ width: 12, height: 12, background: SD.scoreColor(95), opacity: 1, borderRadius: 3 }} />
              <span>More</span>
            </div>
          </SCard>
        </SSection>

        <SSection dot="#f59e0b" color="#f59e0b" label="By Weekday · 90d avg">
          <SCard padding={20} style={{ height: 'calc(100% - 28px)' }}>
            <WeekdayBars data={data90} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, paddingTop: 16, borderTop: `1px solid ${ST.borderHair}` }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: ST.textDim, textTransform: 'uppercase', marginBottom: 4 }}>Best day</div>
                <div style={{ fontFamily: ST.display, fontSize: 16, fontWeight: 600, color: '#10b981' }}>{best?.pct}%</div>
                <div style={{ fontSize: 10, color: ST.textDim, marginTop: 2 }}>{SD.fmtDate(best?.date)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: ST.textDim, textTransform: 'uppercase', marginBottom: 4 }}>Worst day</div>
                <div style={{ fontFamily: ST.display, fontSize: 16, fontWeight: 600, color: '#f43f5e' }}>{worst?.pct}%</div>
                <div style={{ fontSize: 10, color: ST.textDim, marginTop: 2 }}>{SD.fmtDate(worst?.date)}</div>
              </div>
            </div>
          </SCard>
        </SSection>
      </div>

      <div style={{ height: 24 }} />

      <SSection dot="#10b981" color="#10b981" label="Habit Performance · 30d">
        <HabitRanking />
      </SSection>
    </div>
  );
}

window.StatsView = StatsView;
