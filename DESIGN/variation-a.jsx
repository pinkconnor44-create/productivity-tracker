// Variation A — Refined Lumina
// Same DNA as the current app, but: tighter cells, single visual signal per cell
// (a thin score bar at the bottom + accent dot for events), better type hierarchy,
// task chips use kind colors instead of all-violet, summary wheels become a
// horizontal "stat strip" instead of a sidebar.

const D = window.CalData;

function MiniBar({ pct }) {
  const color = D.scoreColor(pct);
  return (
    <div style={{ height: 3, width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2 }} />
    </div>
  );
}

function StatCard({ label, pct }) {
  const color = D.scoreColor(pct);
  return (
    <div style={{
      flex: 1, padding: '14px 16px', borderRadius: 12,
      background: 'rgba(23,31,51,0.85)',
      border: '1px solid rgba(139,92,246,0.18)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#8b8da3', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 28, fontWeight: 600, color: pct == null ? '#5c6273' : '#dae2fd', letterSpacing: '-0.02em' }}>
          {pct == null ? '—' : pct}
        </span>
        {pct != null && <span style={{ fontSize: 12, fontWeight: 600, color: '#8b8da3' }}>%</span>}
      </div>
      {pct != null && <MiniBar pct={pct} />}
    </div>
  );
}

function CalendarA() {
  const days = D.getMonthDays(D.VIEW_YEAR, D.VIEW_MONTH);
  const [selected, setSelected] = React.useState(D.TODAY);
  const [view, setView] = React.useState('month');

  return (
    <div style={{
      width: 1180, padding: 32,
      background: 'radial-gradient(ellipse at top left, rgba(139,92,246,0.10) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(6,182,212,0.08) 0%, transparent 50%), #0b1326',
      fontFamily: 'Manrope, sans-serif',
      color: '#dae2fd',
      borderRadius: 16,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', color: '#8b5cf6', textTransform: 'uppercase', marginBottom: 6 }}>Calendar</div>
          <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 36, fontWeight: 600, letterSpacing: '-0.025em', margin: 0, color: '#dae2fd' }}>
            May <span style={{ color: '#8b8da3' }}>2026</span>
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'rgba(23,31,51,0.85)', border: '1px solid rgba(139,92,246,0.18)', borderRadius: 10, padding: 3 }}>
            {['month','week','day'].map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '6px 14px', fontSize: 13, fontWeight: 600, textTransform: 'capitalize',
                background: view === v ? 'linear-gradient(135deg, #7c3aed, #06b6d4)' : 'transparent',
                color: view === v ? '#fff' : '#8b8da3',
                border: 'none', borderRadius: 7, cursor: 'pointer',
                boxShadow: view === v ? '0 0 12px rgba(139,92,246,0.4)' : 'none',
              }}>{v}</button>
            ))}
          </div>
          <NavBtn>←</NavBtn>
          <NavBtn>Today</NavBtn>
          <NavBtn>→</NavBtn>
        </div>
      </div>

      {/* Stat strip */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <StatCard label="Today" pct={D.SUMMARY.day} />
        <StatCard label="This week" pct={D.SUMMARY.week} />
        <StatCard label="This month" pct={D.SUMMARY.month} />
        <StatCard label="This year" pct={D.SUMMARY.year} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
        {/* Month grid */}
        <div style={{
          background: 'rgba(23,31,51,0.85)',
          border: '1px solid rgba(139,92,246,0.18)',
          borderRadius: 16, overflow: 'hidden',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid rgba(139,92,246,0.12)' }}>
            {D.WEEKDAYS.map(wd => (
              <div key={wd} style={{ padding: '12px 0', textAlign: 'center', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#6b7088', textTransform: 'uppercase' }}>{wd}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {days.map(({ date, isCurrentMonth }, i) => {
              const score = D.scoreForDate(date);
              const dayTasks = D.tasksForDate(date);
              const dayHabits = D.habitsForDate(date);
              const habitsDone = dayHabits.filter(h => D.isHabitDone(h, date)).length;
              const isToday = date === D.TODAY;
              const isFuture = date > D.TODAY;
              const isSelected = date === selected;
              const dayNum = new Date(date+'T12:00:00').getDate();
              const timed = dayTasks.filter(t => t.time).slice(0, 2);
              const overflow = dayTasks.filter(t => t.time).length - timed.length;
              const hasNote = !!D.NOTES[date];

              return (
                <button key={i} onClick={() => setSelected(date)} style={{
                  height: 100, padding: 8, textAlign: 'left', cursor: 'pointer',
                  background: isSelected ? 'rgba(139,92,246,0.10)' : 'transparent',
                  border: 'none',
                  borderBottom: '1px solid rgba(139,92,246,0.10)',
                  borderRight: (i % 7 !== 6) ? '1px solid rgba(139,92,246,0.10)' : 'none',
                  display: 'flex', flexDirection: 'column', gap: 4, position: 'relative',
                  opacity: isCurrentMonth ? 1 : 0.32,
                  fontFamily: 'inherit', color: 'inherit',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, fontWeight: 600,
                      width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '50%',
                      background: isToday ? 'linear-gradient(135deg, #7c3aed, #06b6d4)' : 'transparent',
                      color: isToday ? '#fff' : isCurrentMonth ? '#dae2fd' : '#5c6273',
                      boxShadow: isToday ? '0 0 12px rgba(139,92,246,0.5)' : 'none',
                    }}>{dayNum}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {hasNote && <span title="Note" style={{ width: 4, height: 4, borderRadius: '50%', background: '#f59e0b' }} />}
                      {dayHabits.length > 0 && isCurrentMonth && !isFuture && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: habitsDone === dayHabits.length ? '#10b981' : '#6b7088', fontFeatureSettings: '"tnum"' }}>
                          {habitsDone}/{dayHabits.length}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0, flex: 1 }}>
                    {timed.map(task => {
                      const done = D.isTaskDone(task, date);
                      const c = D.KIND_COLORS[task.kind];
                      return (
                        <div key={task.id} style={{
                          fontSize: 9.5, lineHeight: 1.2, padding: '2px 5px', borderRadius: 4,
                          background: done ? 'rgba(255,255,255,0.03)' : c.bg,
                          color: done ? '#5c6273' : c.fg,
                          textDecoration: done ? 'line-through' : 'none',
                          fontWeight: 600, fontFeatureSettings: '"tnum"',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {D.fmtTimeShort(task.time)} {task.title}
                        </div>
                      );
                    })}
                    {overflow > 0 && (
                      <div style={{ fontSize: 9, fontWeight: 600, color: '#6b7088', paddingLeft: 5 }}>+{overflow} more</div>
                    )}
                  </div>
                  {score && !isFuture && (
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'rgba(0,0,0,0.2)' }}>
                      <div style={{ height: '100%', width: `${score.pct}%`, background: D.scoreColor(score.pct) }} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right rail: selected day */}
        <SelectedDayRail date={selected} onClose={() => setSelected(null)} />
      </div>
    </div>
  );
}

function NavBtn({ children }) {
  return (
    <button style={{
      padding: '6px 12px', fontSize: 13, fontWeight: 600,
      background: 'rgba(23,31,51,0.85)', border: '1px solid rgba(139,92,246,0.18)',
      color: '#8b8da3', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
      minWidth: children === '←' || children === '→' ? 32 : 'auto',
    }}>{children}</button>
  );
}

function SelectedDayRail({ date }) {
  if (!date) return null;
  const d = new Date(date+'T12:00:00');
  const score = D.scoreForDate(date);
  const tasks = D.tasksForDate(date);
  const habits = D.habitsForDate(date);
  const note = D.NOTES[date];
  const isToday = date === D.TODAY;

  return (
    <div style={{
      background: 'rgba(23,31,51,0.85)',
      border: '1px solid rgba(139,92,246,0.18)',
      borderRadius: 16, padding: 20,
      display: 'flex', flexDirection: 'column', gap: 16,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#8b8da3', textTransform: 'uppercase', marginBottom: 4 }}>
            {D.WEEKDAYS_LONG[d.getDay()]}
          </div>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }}>
            {D.MONTHS[d.getMonth()].slice(0,3)} {d.getDate()}
          </div>
          {isToday && <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginTop: 4 }}>● Today</div>}
        </div>
        {score && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 28, fontWeight: 600, color: D.scoreColor(score.pct), letterSpacing: '-0.02em', lineHeight: 1 }}>
              {score.pct}<span style={{ fontSize: 14, color: D.scoreColor(score.pct), opacity: 0.6 }}>%</span>
            </div>
            <div style={{ fontSize: 10, color: '#8b8da3', marginTop: 4, fontFeatureSettings: '"tnum"' }}>{score.completed}/{score.total} done</div>
          </div>
        )}
      </div>

      {/* Tasks */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#6b7088', textTransform: 'uppercase', marginBottom: 8 }}>
          Tasks · {tasks.length}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tasks.map(task => {
            const done = D.isTaskDone(task, date);
            const c = D.KIND_COLORS[task.kind];
            return (
              <div key={task.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8,
                background: 'rgba(255,255,255,0.02)',
                opacity: done ? 0.55 : 1,
              }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: done ? 'none' : `1.5px solid ${c.dot}`, background: done ? '#10b981' : 'transparent', flexShrink: 0 }}>
                  {done && <span style={{ fontSize: 9, color: '#fff', fontWeight: 900 }}>✓</span>}
                </span>
                {task.time && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#8b8da3', fontFeatureSettings: '"tnum"', minWidth: 44, textDecoration: done ? 'line-through' : 'none' }}>
                    {D.fmtTimeShort(task.time)}
                  </span>
                )}
                <span style={{ fontSize: 13, fontWeight: 500, color: done ? '#5c6273' : '#dae2fd', textDecoration: done ? 'line-through' : 'none', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {task.title}
                </span>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Habits */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#6b7088', textTransform: 'uppercase', marginBottom: 8 }}>
          Habits · {habits.filter(h => D.isHabitDone(h, date)).length}/{habits.length}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {habits.map(habit => {
            const done = D.isHabitDone(habit, date);
            return (
              <div key={habit.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: done ? 'none' : '1.5px solid #6b7088', background: done ? '#10b981' : 'transparent', flexShrink: 0 }}>
                  {done && <span style={{ fontSize: 9, color: '#fff', fontWeight: 900 }}>✓</span>}
                </span>
                <span style={{ fontSize: 13, fontWeight: 500, color: done ? '#5c6273' : '#dae2fd', textDecoration: done ? 'line-through' : 'none' }}>
                  {habit.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {note && (
        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: '#f59e0b', textTransform: 'uppercase', marginBottom: 4 }}>Note</div>
          <div style={{ fontSize: 12, lineHeight: 1.5, color: '#fcd34d' }}>{note}</div>
        </div>
      )}
    </div>
  );
}

window.CalendarA = CalendarA;
