// Habits view — Theme A
const HD = window.AppData;
const HT = window.T;
const { PageHeader: HPageHeader, StatCard: HStatCard, Card: HCard, Section: HSection, Checkbox: HCheckbox, WeightChip: HWeightChip } = window.Theme;

function scheduleLabel(r) {
  if (!r) return 'Every day';
  if (r === '1,2,3,4,5') return 'Weekdays';
  if (r === '0,6') return 'Weekends';
  return r.split(',').map(Number).map(d => HD.WEEKDAYS[d]).join(', ');
}

// 30-day mini heatmap as a strip of squares
function Heatmap30({ habit }) {
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const date = HD.addDays(HD.TODAY, -i);
    const active = HD.isHabitActiveOnDate(habit, date);
    const done = active && HD.isHabitDone(habit, date);
    days.push({ date, active, done });
  }
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {days.map(d => (
        <div key={d.date} title={`${d.date}${d.done ? ' · done' : d.active ? ' · missed' : ' · off'}`} style={{
          width: 8, height: 16, borderRadius: 2,
          background: !d.active ? 'rgba(255,255,255,0.04)'
            : d.done ? '#10b981'
            : 'rgba(244,63,94,0.25)',
          opacity: !d.active ? 0.4 : 1,
        }} />
      ))}
    </div>
  );
}

function HabitRow({ habit, isLast }) {
  const today = HD.TODAY;
  const done = HD.isHabitDone(habit, today);
  const skipped = HD.isHabitSkipped(habit, today);
  const streak = HD.habitStreak(habit);
  const w7 = HD.habitWindow(habit, 7);
  const w30 = HD.habitWindow(habit, 30);
  const w7pct = w7.scheduled ? Math.round((w7.done / w7.scheduled) * 100) : 0;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '40px minmax(180px, 1fr) auto auto',
      alignItems: 'center', gap: 16,
      padding: '14px 16px',
      borderBottom: isLast ? 'none' : `1px solid ${HT.borderHair}`,
      borderLeft: `3px solid #a78bfa`,
    }}>
      <HCheckbox checked={done} skipped={skipped} color="#10b981" />

      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: done ? HT.textMuted : HT.text, textDecoration: done ? 'line-through' : 'none' }}>
            {habit.name}
          </span>
          <HWeightChip w={habit.weight} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
          <span style={{ fontSize: 11, color: HT.textDim }}>{scheduleLabel(habit.recurringDays)}</span>
          {habit.description && <span style={{ fontSize: 11, color: HT.textDim }}>· {habit.description}</span>}
        </div>
      </div>

      {/* Stats cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ textAlign: 'center', minWidth: 56 }}>
          <div style={{ fontFamily: HT.display, fontSize: 18, fontWeight: 600, color: streak > 0 ? '#fb923c' : HT.textVDim, lineHeight: 1 }}>
            {streak > 0 ? `🔥${streak}` : '—'}
          </div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: HT.textDim, textTransform: 'uppercase', marginTop: 4 }}>Streak</div>
        </div>
        <div style={{ textAlign: 'center', minWidth: 56 }}>
          <div style={{ fontFamily: HT.display, fontSize: 18, fontWeight: 600, color: HD.scoreColor(w7pct), lineHeight: 1 }}>
            {w7pct}%
          </div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: HT.textDim, textTransform: 'uppercase', marginTop: 4 }}>7d</div>
        </div>
        <div style={{ textAlign: 'center', minWidth: 64 }}>
          <div style={{ fontFamily: HT.display, fontSize: 18, fontWeight: 600, color: HT.text, lineHeight: 1, fontFeatureSettings: '"tnum"' }}>
            {w30.done}<span style={{ color: HT.textDim, fontSize: 13 }}>/{w30.scheduled}</span>
          </div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: HT.textDim, textTransform: 'uppercase', marginTop: 4 }}>30d</div>
        </div>
      </div>

      <Heatmap30 habit={habit} />
    </div>
  );
}

function HabitsView() {
  const today = HD.TODAY;
  const active = HD.HABITS.filter(h => HD.isHabitActiveOnDate(h, today));
  const inactive = HD.HABITS.filter(h => !HD.isHabitActiveOnDate(h, today));
  const doneCount = active.filter(h => HD.isHabitDone(h, today)).length;

  // Aggregate stats
  const totalStreaks = HD.HABITS.map(h => HD.habitStreak(h));
  const longestStreak = Math.max(...totalStreaks);
  const totalThisMonth = HD.HABITS.reduce((s, h) => s + HD.habitWindow(h, 30).done, 0);
  const w30 = HD.HABITS.reduce((acc, h) => {
    const w = HD.habitWindow(h, 30);
    return { done: acc.done + w.done, scheduled: acc.scheduled + w.scheduled };
  }, { done: 0, scheduled: 0 });
  const w30pct = w30.scheduled ? Math.round((w30.done / w30.scheduled) * 100) : 0;

  return (
    <div>
      <HPageHeader
        eyebrow="Habits"
        title={<>{doneCount}<span style={{ color: HT.textMuted }}>/{active.length}</span> done today</>}
        sub="Daily rituals you're working to make automatic. Heatmap shows the last 30 days — green is done, faded red is missed."
        right={
          <button style={{
            padding: '10px 18px', fontSize: 13, fontWeight: 600,
            background: HT.accentGrad, color: '#fff', border: 'none',
            borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: HT.accentGlow,
          }}>+ New habit</button>
        }
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <HStatCard label="Today" value={`${doneCount}/${active.length}`} sub="scheduled habits" color={doneCount === active.length ? '#10b981' : HT.accent} barPct={active.length ? (doneCount / active.length) * 100 : 0} />
        <HStatCard label="30-day rate" value={w30pct} suffix="%" sub={`${w30.done} of ${w30.scheduled} scheduled`} color={HD.scoreColor(w30pct)} barPct={w30pct} />
        <HStatCard label="Longest streak" value={longestStreak} suffix="d" sub="meditate · still going" color="#fb923c" barPct={Math.min(100, longestStreak * 1.5)} />
        <HStatCard label="Completions" value={totalThisMonth} sub="last 30 days" color={HT.accent} barPct={Math.min(100, totalThisMonth)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
        <HSection dot="#10b981" color="#10b981" label="Today's Habits" count={doneCount} total={active.length}>
          <HCard>
            {active.map((h, i) => <HabitRow key={h.id} habit={h} isLast={i === active.length - 1} />)}
          </HCard>
        </HSection>

        {inactive.length > 0 && (
          <HSection dot={HT.textMuted} color={HT.textMuted} label="Not Today" total={inactive.length}>
            <HCard style={{ opacity: 0.55 }}>
              {inactive.map((h, i) => (
                <div key={h.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px',
                  borderBottom: i === inactive.length - 1 ? 'none' : `1px solid ${HT.borderHair}`,
                  borderLeft: `3px solid transparent`,
                }}>
                  <span style={{ width: 18, height: 18, borderRadius: 6, border: `2px solid ${HT.borderHair}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: HT.textVDim, fontSize: 10 }}>—</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: HT.textMuted, flex: 1 }}>{h.name}</span>
                  <span style={{ fontSize: 11, color: HT.textDim }}>{scheduleLabel(h.recurringDays)}</span>
                </div>
              ))}
            </HCard>
          </HSection>
        )}
      </div>
    </div>
  );
}

window.HabitsView = HabitsView;
