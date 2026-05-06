// Lifts view — Theme A. Day-grouped, click to expand.
const LD = window.AppData;
const LT = window.T;
const { PageHeader: LPageHeader, StatCard: LStatCard, Card: LCard, Section: LSection } = window.Theme;

function entriesByDate() {
  const map = {};
  for (const e of LD.LIFT_ENTRIES) {
    if (!map[e.date]) map[e.date] = [];
    map[e.date].push(e);
  }
  return map;
}

function dayName(date) {
  const dow = new Date(date+'T12:00:00').getDay();
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dow];
}

// Push (Bench, OHP, Incline, Pushdown, Lateral) / Pull (Deadlift, Pull Up, Row, Face Pull, Curl) / Legs
const PUSH = new Set(['Bench Press','Overhead Press','Incline DB Press','Tricep Pushdown','Lateral Raise']);
const PULL = new Set(['Deadlift','Pull Up','Barbell Row','Face Pull','DB Curl']);
const LEGS = new Set(['Back Squat','Romanian Deadlift','Leg Press','Walking Lunge','Calf Raise']);
function workoutLabel(entries) {
  let p=0, l=0, g=0;
  for (const e of entries) { if (PUSH.has(e.name)) p++; else if (PULL.has(e.name)) l++; else if (LEGS.has(e.name)) g++; }
  if (p >= l && p >= g) return 'Push';
  if (l >= g) return 'Pull';
  return 'Legs';
}
function workoutGroupColor(label) {
  if (label === 'Push') return '#22d3ee';
  if (label === 'Pull') return '#a78bfa';
  if (label === 'Legs') return '#ec4899';
  return LT.accent;
}

function trendForExercise(name, beforeDate, days = 56) {
  const cutoff = LD.addDays(beforeDate, -days);
  return LD.LIFT_ENTRIES
    .filter(e => e.name === name && e.date >= cutoff && e.date <= beforeDate)
    .sort((a, b) => a.date < b.date ? -1 : 1);
}

function MiniSpark({ values, color = '#a78bfa', width = 60, height = 18 }) {
  if (values.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

function SetsViz({ sets }) {
  const arr = JSON.parse(sets);
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {arr.map((reps, i) => (
        <div key={i} style={{
          minWidth: 26, padding: '3px 6px',
          background: 'rgba(139,92,246,0.10)',
          border: `1px solid rgba(139,92,246,0.20)`,
          borderRadius: 6,
          fontSize: 11, fontWeight: 600, color: LT.text,
          fontFeatureSettings: '"tnum"',
          textAlign: 'center',
        }}>{reps}</div>
      ))}
    </div>
  );
}

// Collapsed row — day, group, exercise count, total volume
function DayRow({ date, entries, expanded, onToggle, isLast }) {
  const label = workoutLabel(entries);
  const color = workoutGroupColor(label);
  const totalVolume = entries.reduce((s, e) => s + e.weight * e.totalReps, 0);
  const heaviest = entries.reduce((m, e) => e.weight > m.weight ? e : m, entries[0]);

  return (
    <div style={{ borderBottom: isLast && !expanded ? 'none' : `1px solid ${LT.borderHair}` }}>
      <button onClick={onToggle} style={{
        all: 'unset', cursor: 'pointer', display: 'block', width: '100%',
        padding: '14px 18px',
        borderLeft: `3px solid ${color}`,
        background: expanded ? 'rgba(139,92,246,0.06)' : 'transparent',
        transition: 'background .15s',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 70px minmax(160px, 1fr) auto auto auto', alignItems: 'center', gap: 16 }}>
          {/* Chevron */}
          <span style={{ width: 16, color: LT.textMuted, transition: 'transform .2s', transform: expanded ? 'rotate(90deg)' : 'rotate(0)', display: 'inline-flex' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </span>
          {/* Group badge */}
          <span style={{
            padding: '3px 9px', borderRadius: 999,
            background: color + '26',
            color, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
            textAlign: 'center',
          }}>{label}</span>
          {/* Date */}
          <span style={{ fontFamily: LT.display, fontSize: 14, fontWeight: 600, color: LT.text }}>
            {dayName(date)} <span style={{ color: LT.textMuted, fontWeight: 500 }}>· {LD.fmtDate(date)}</span>
          </span>
          {/* Exercise count */}
          <span style={{ fontSize: 11, color: LT.textMuted, fontFeatureSettings: '"tnum"' }}>
            {entries.length} exercises
          </span>
          {/* Top set */}
          <span style={{ fontSize: 11, color: LT.textDim, fontFeatureSettings: '"tnum"' }}>
            top: <span style={{ color: LT.text, fontWeight: 600 }}>{heaviest.name} {heaviest.weight}lb</span>
          </span>
          {/* Volume */}
          <span style={{ fontFamily: LT.display, fontSize: 13, fontWeight: 600, color: LT.text, fontFeatureSettings: '"tnum"', textAlign: 'right' }}>
            {(totalVolume / 1000).toFixed(1)}<span style={{ color: LT.textDim, fontSize: 10, fontWeight: 600, marginLeft: 2 }}>k lb</span>
          </span>
        </div>
      </button>

      {expanded && <DayDetail date={date} entries={entries} color={color} />}
    </div>
  );
}

// Expanded detail — analytics + per-exercise rows with mini trends
function DayDetail({ date, entries, color }) {
  const totalVolume = entries.reduce((s, e) => s + e.weight * e.totalReps, 0);
  const totalSets = entries.reduce((s, e) => s + JSON.parse(e.sets).length, 0);
  const totalReps = entries.reduce((s, e) => s + e.totalReps, 0);

  // Compare to prior session of same group
  const sortedDates = [...new Set(LD.LIFT_ENTRIES.map(e => e.date))].sort();
  const idx = sortedDates.indexOf(date);
  let priorVol = null;
  for (let i = idx - 1; i >= 0; i--) {
    const prior = LD.LIFT_ENTRIES.filter(e => e.date === sortedDates[i]);
    const lbl = workoutLabel(prior);
    const ours = workoutLabel(entries);
    if (lbl === ours) { priorVol = prior.reduce((s, e) => s + e.weight * e.totalReps, 0); break; }
  }
  const volDelta = priorVol != null ? totalVolume - priorVol : null;
  const volPct = priorVol != null && priorVol > 0 ? Math.round((volDelta / priorVol) * 100) : null;

  return (
    <div style={{
      padding: '0 18px 18px 18px',
      background: 'rgba(15,21,38,0.4)',
      borderLeft: `3px solid ${color}`,
    }}>
      {/* Mini stat row */}
      <div style={{ display: 'flex', gap: 24, padding: '14px 0', borderBottom: `1px solid ${LT.borderHair}`, marginBottom: 14 }}>
        <Mini label="Volume" value={`${(totalVolume/1000).toFixed(1)}k`} suffix="lb" />
        <Mini label="Sets" value={totalSets} />
        <Mini label="Reps" value={totalReps} />
        <Mini label="Exercises" value={entries.length} />
        {volPct != null && (
          <Mini
            label={`vs prior ${workoutLabel(entries)}`}
            value={`${volPct >= 0 ? '+' : ''}${volPct}`}
            suffix="%"
            color={volPct >= 0 ? '#10b981' : '#f43f5e'}
          />
        )}
      </div>

      {/* Per-exercise rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {entries.map(e => {
          const trend = trendForExercise(e.name, date);
          const weights = trend.map(t => t.weight);
          const isPR = e.weight === Math.max(...weights);
          const prior = trend.length >= 2 ? trend[trend.length - 2] : null;
          const delta = prior ? e.weight - prior.weight : 0;
          return (
            <div key={e.id} style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(140px,1fr) auto auto 60px 70px 50px',
              alignItems: 'center', gap: 14,
              padding: '10px 12px',
              background: 'rgba(15,21,38,0.6)',
              borderRadius: 8,
            }}>
              <span style={{ fontSize: 13, color: LT.text, fontWeight: 500 }}>
                {e.name}
                {isPR && weights.length > 1 && <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: '#fcd34d', background: 'rgba(245,158,11,0.16)', padding: '2px 6px', borderRadius: 999 }}>PR</span>}
              </span>
              <SetsViz sets={e.sets} />
              <span style={{ fontSize: 11, color: LT.textDim, fontFeatureSettings: '"tnum"', textAlign: 'right' }}>
                {e.totalReps} reps
              </span>
              <MiniSpark values={weights} color={delta > 0 ? '#10b981' : delta < 0 ? '#f43f5e' : LT.accent} />
              <span style={{ fontFamily: LT.display, fontSize: 14, fontWeight: 600, color: LT.text, fontFeatureSettings: '"tnum"', textAlign: 'right' }}>
                {e.weight}<span style={{ color: LT.textDim, fontSize: 10, fontWeight: 600, marginLeft: 2 }}>lb</span>
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: delta > 0 ? '#10b981' : delta < 0 ? '#f43f5e' : LT.textDim, fontFeatureSettings: '"tnum"', textAlign: 'right' }}>
                {delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${delta}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Mini({ label, value, suffix, color }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: LT.textDim, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{ fontFamily: LT.display, fontSize: 18, fontWeight: 600, color: color ?? LT.text, letterSpacing: '-0.01em', fontFeatureSettings: '"tnum"', lineHeight: 1 }}>{value}</span>
        {suffix && <span style={{ fontSize: 10, color: LT.textMuted, fontWeight: 600 }}>{suffix}</span>}
      </div>
    </div>
  );
}

// Group sessions by week for visual rhythm
function groupByWeek(dates) {
  const out = [];
  let curWeekStart = null;
  let curGroup = null;
  for (const d of dates) {
    const dt = new Date(d + 'T12:00:00');
    const sun = new Date(dt); sun.setDate(dt.getDate() - dt.getDay());
    const ws = LD.localDate(sun);
    if (ws !== curWeekStart) {
      curWeekStart = ws;
      curGroup = { weekStart: ws, dates: [] };
      out.push(curGroup);
    }
    curGroup.dates.push(d);
  }
  return out;
}

function weekLabel(weekStart) {
  if (weekStart === LD.localDate(new (function(){ const d=new Date(LD.TODAY+'T12:00:00'); d.setDate(d.getDate()-d.getDay()); return d; })())) return 'This week';
  const d = new Date(weekStart + 'T12:00:00');
  const end = new Date(d); end.setDate(d.getDate() + 6);
  return `Week of ${d.toLocaleDateString('en-US',{ month:'short', day:'numeric' })}`;
}

function LiftsView() {
  const byDate = entriesByDate();
  const sortedDates = Object.keys(byDate).sort((a, b) => a < b ? 1 : -1);
  const recent = sortedDates.slice(0, 16);

  // Default-expand the most recent session
  const [expanded, setExpanded] = React.useState(new Set([recent[0]]));
  function toggle(date) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  }

  // Top-line stats only
  const last30Days = sortedDates.filter(d => d >= LD.addDays(LD.TODAY, -30));
  const last7Days = sortedDates.filter(d => d >= LD.addDays(LD.TODAY, -7));
  const totalVolume30 = last30Days.reduce((s, d) => s + byDate[d].reduce((ss, e) => ss + e.weight * e.totalReps, 0), 0);

  // Group by week
  const weeks = groupByWeek(recent);

  return (
    <div>
      <LPageHeader
        eyebrow="Lifts"
        title={<>{last7Days.length}<span style={{ color: LT.textMuted }}> sessions</span> this week</>}
        sub="Push / pull / legs split. Click any day to see exercise breakdown and trends."
        right={
          <button style={{
            padding: '10px 18px', fontSize: 13, fontWeight: 600,
            background: LT.accentGrad, color: '#fff', border: 'none',
            borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: LT.accentGlow,
          }}>+ Log session</button>
        }
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <LStatCard label="Sessions / 7d" value={last7Days.length} sub="target: 3" color={last7Days.length >= 3 ? '#10b981' : LT.accent} barPct={Math.min(100, (last7Days.length/3)*100)} />
        <LStatCard label="Sessions / 30d" value={last30Days.length} sub="3-day split" color={LT.accent} barPct={Math.min(100, last30Days.length * 8)} />
        <LStatCard label="Volume / 30d" value={Math.round(totalVolume30 / 1000)} suffix="k lb" sub="weight × reps" color="#22d3ee" barPct={Math.min(100, totalVolume30 / 2000)} />
        <LStatCard label="Last session" value={recent[0] ? LD.fmtDate(recent[0]) : '—'} sub={recent[0] ? `${workoutLabel(byDate[recent[0]])} day` : ''} color={recent[0] ? workoutGroupColor(workoutLabel(byDate[recent[0]])) : LT.accent} barPct={recent[0] ? 100 : 0} />
      </div>

      {/* Day-grouped sessions, organized by week */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {weeks.map(w => {
          const weekVol = w.dates.reduce((s, d) => s + byDate[d].reduce((ss, e) => ss + e.weight * e.totalReps, 0), 0);
          return (
            <LSection
              key={w.weekStart}
              dot="#a78bfa"
              color="#a78bfa"
              label={weekLabel(w.weekStart)}
              right={
                <span style={{ fontSize: 11, color: LT.textMuted, fontFeatureSettings: '"tnum"', fontWeight: 600 }}>
                  {w.dates.length} session{w.dates.length === 1 ? '' : 's'} · {(weekVol/1000).toFixed(1)}k lb
                </span>
              }
            >
              <LCard>
                {w.dates.map((d, i) => (
                  <DayRow
                    key={d}
                    date={d}
                    entries={byDate[d]}
                    expanded={expanded.has(d)}
                    onToggle={() => toggle(d)}
                    isLast={i === w.dates.length - 1}
                  />
                ))}
              </LCard>
            </LSection>
          );
        })}
      </div>
    </div>
  );
}

window.LiftsView = LiftsView;
