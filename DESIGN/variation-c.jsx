// Variation C — Bold Data-dense
// Linear / Notion Calendar feel: tight grid, hairline borders, no glass.
// Tasks render as full-width colored bars (not chips). Score = sparkbar at top.
// Sidebar replaced with a horizontal "weekstream" showing this week's hours
// as a grid of busy/free blocks. High information density.

const D = window.CalData;

function CalendarC() {
  const days = D.getMonthDays(D.VIEW_YEAR, D.VIEW_MONTH);
  const [selected, setSelected] = React.useState(D.TODAY);

  // Build week rows for sparkbars
  const weekRows = [];
  for (let r = 0; r < 6; r++) {
    const slice = days.slice(r*7, r*7+7);
    let done = 0, total = 0;
    for (const { date } of slice) {
      const s = D.scoreForDate(date);
      if (s) { done += s.completed; total += s.total; }
    }
    weekRows.push({ pct: total === 0 ? null : Math.round((done/total)*100), label: `W${18+r}` });
  }

  return (
    <div style={{
      width: 1180, padding: 0,
      background: '#08090c',
      fontFamily: 'Manrope, sans-serif',
      color: '#d4d6dc',
      borderRadius: 16, overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: '#0c0e13',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>P</div>
            <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, fontWeight: 600, color: '#f0f2f5', letterSpacing: '-0.01em' }}>Productivity</span>
          </div>
          <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.1)' }} />
          <span style={{ fontSize: 13, fontWeight: 500, color: '#9098a8' }}>Calendar</span>
          <span style={{ fontSize: 11, color: '#5a6170' }}>›</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#f0f2f5' }}>May 2026</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', background: '#15171c', borderRadius: 6, padding: 2, border: '1px solid rgba(255,255,255,0.06)' }}>
            {['M','W','D'].map((v, i) => (
              <button key={v} style={{
                padding: '4px 10px', fontSize: 11, fontWeight: 600,
                background: i === 0 ? '#22252c' : 'transparent',
                color: i === 0 ? '#f0f2f5' : '#7a8290',
                border: 'none', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
              }}>{v}</button>
            ))}
          </div>
          <button style={{ padding: '5px 10px', fontSize: 11, fontWeight: 600, background: '#15171c', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, color: '#9098a8', cursor: 'pointer', fontFamily: 'inherit' }}>← Prev</button>
          <button style={{ padding: '5px 10px', fontSize: 11, fontWeight: 600, background: '#15171c', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, color: '#f0f2f5', cursor: 'pointer', fontFamily: 'inherit' }}>Today</button>
          <button style={{ padding: '5px 10px', fontSize: 11, fontWeight: 600, background: '#15171c', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, color: '#9098a8', cursor: 'pointer', fontFamily: 'inherit' }}>Next →</button>
          <button style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 0 12px rgba(139,92,246,0.3)' }}>+ New task</button>
        </div>
      </div>

      {/* Stat row */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {[
          { label: 'Day', pct: D.SUMMARY.day, sub: 'Today' },
          { label: 'Week', pct: D.SUMMARY.week, sub: 'May 3 – 9' },
          { label: 'Month', pct: D.SUMMARY.month, sub: 'May 2026' },
          { label: 'Year', pct: D.SUMMARY.year, sub: '2026 YTD' },
        ].map((s, i) => (
          <div key={s.label} style={{
            flex: 1, padding: '14px 20px',
            borderRight: i < 3 ? '1px solid rgba(255,255,255,0.06)' : 'none',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#7a8290', textTransform: 'uppercase' }}>{s.label}</span>
              <span style={{ fontSize: 10, color: '#5a6170' }}>{s.sub}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
              <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 24, fontWeight: 600, color: s.pct == null ? '#5a6170' : '#f0f2f5', letterSpacing: '-0.025em', lineHeight: 1, fontFeatureSettings: '"tnum"' }}>
                {s.pct == null ? '—' : s.pct}
              </span>
              {s.pct != null && <span style={{ fontSize: 11, color: '#7a8290', fontWeight: 600 }}>%</span>}
              <span style={{ fontSize: 10, color: '#10b981', marginLeft: 8 }}>↑ 3.2</span>
            </div>
            <div style={{ height: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 1, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${s.pct || 0}%`, background: D.scoreColor(s.pct), borderRadius: 1 }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 280px' }}>
        {/* Week-number gutter with sparkbar */}
        <div style={{ borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: 28, borderBottom: '1px solid rgba(255,255,255,0.06)' }} />
          {weekRows.map((w, i) => (
            <div key={i} style={{
              flex: 1, minHeight: 116, borderBottom: i < 5 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '8px 0',
            }}>
              <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 10, fontWeight: 600, color: '#5a6170', letterSpacing: '0.05em' }}>{w.label}</span>
              <div style={{ width: 4, flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
                {w.pct != null && (
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${w.pct}%`, background: D.scoreColor(w.pct), borderRadius: 2 }} />
                )}
              </div>
              <span style={{ fontSize: 9, color: w.pct == null ? '#3a3f4a' : D.scoreColor(w.pct), fontFeatureSettings: '"tnum"', fontWeight: 600 }}>{w.pct == null ? '—' : w.pct}</span>
            </div>
          ))}
        </div>

        {/* Main grid */}
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.06)', height: 28 }}>
            {D.WEEKDAYS.map((wd, i) => (
              <div key={wd} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
                color: (i === 0 || i === 6) ? '#5a6170' : '#7a8290',
                textTransform: 'uppercase',
                borderRight: i < 6 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}>{wd}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {days.map(({ date, isCurrentMonth }, i) => {
              const score = D.scoreForDate(date);
              const dayTasks = D.tasksForDate(date);
              const isToday = date === D.TODAY;
              const isFuture = date > D.TODAY;
              const isSelected = date === selected;
              const isWeekend = i % 7 === 0 || i % 7 === 6;
              const dayNum = new Date(date+'T12:00:00').getDate();
              const visible = dayTasks.slice(0, 4);
              const overflow = dayTasks.length - visible.length;

              return (
                <button key={i} onClick={() => setSelected(date)} style={{
                  height: 116, padding: 0, cursor: 'pointer',
                  background: isSelected ? '#101218' : isWeekend && isCurrentMonth ? '#0a0b0f' : '#08090c',
                  border: 'none',
                  borderRight: i % 7 !== 6 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', flexDirection: 'column',
                  opacity: isCurrentMonth ? 1 : 0.35,
                  fontFamily: 'inherit', color: 'inherit', textAlign: 'left',
                  position: 'relative',
                  outline: isSelected ? '1px solid rgba(139,92,246,0.5)' : 'none',
                  outlineOffset: -1,
                }}>
                  {/* Sparkbar at top */}
                  {score && !isFuture && (
                    <div style={{ height: 2, background: 'rgba(255,255,255,0.03)' }}>
                      <div style={{ height: '100%', width: `${score.pct}%`, background: D.scoreColor(score.pct) }} />
                    </div>
                  )}
                  {/* Date number */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 8px 4px',
                  }}>
                    <span style={{
                      fontFamily: 'Space Grotesk, sans-serif', fontSize: 12, fontWeight: 600,
                      color: isToday ? '#08090c' : isCurrentMonth ? (isWeekend ? '#5a6170' : '#d4d6dc') : '#3a3f4a',
                      background: isToday ? '#06b6d4' : 'transparent',
                      padding: isToday ? '1px 6px' : 0, borderRadius: 4,
                      fontFeatureSettings: '"tnum"',
                    }}>{dayNum}</span>
                    {score && !isFuture && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: D.scoreColor(score.pct), fontFeatureSettings: '"tnum"' }}>
                        {score.pct}%
                      </span>
                    )}
                  </div>
                  {/* Task bars — full-width */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1.5, padding: '0 4px' }}>
                    {visible.map((task, j) => {
                      const done = D.isTaskDone(task, date);
                      const c = D.KIND_COLORS[task.kind];
                      return (
                        <div key={j} style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          fontSize: 9.5, lineHeight: 1.1, padding: '2px 5px', borderRadius: 2,
                          background: done ? 'transparent' : c.bg,
                          color: done ? '#5a6170' : c.fg,
                          textDecoration: done ? 'line-through' : 'none',
                          fontWeight: 600, fontFeatureSettings: '"tnum"',
                          borderLeft: `2px solid ${done ? '#3a3f4a' : c.dot}`,
                          whiteSpace: 'nowrap', overflow: 'hidden',
                        }}>
                          {task.time && <span style={{ opacity: 0.7 }}>{D.fmtTimeShort(task.time)}</span>}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</span>
                        </div>
                      );
                    })}
                    {overflow > 0 && (
                      <div style={{ fontSize: 9, fontWeight: 600, color: '#5a6170', padding: '1px 7px' }}>+{overflow}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: agenda + legend */}
        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column' }}>
          <SelectedDayC date={selected} />
        </div>
      </div>
    </div>
  );
}

function SelectedDayC({ date }) {
  if (!date) return null;
  const d = new Date(date+'T12:00:00');
  const score = D.scoreForDate(date);
  const tasks = D.tasksForDate(date);
  const habits = D.habitsForDate(date);
  const note = D.NOTES[date];
  const isToday = date === D.TODAY;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#7a8290', textTransform: 'uppercase' }}>
            {isToday ? 'Today' : D.WEEKDAYS_LONG[d.getDay()]}
          </div>
          {score && (
            <div style={{ fontSize: 10, fontWeight: 700, color: D.scoreColor(score.pct), fontFeatureSettings: '"tnum"' }}>
              {score.completed}/{score.total} · {score.pct}%
            </div>
          )}
        </div>
        <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 18, fontWeight: 600, color: '#f0f2f5', letterSpacing: '-0.02em' }}>
          {D.MONTHS[d.getMonth()]} {d.getDate()}
        </div>
        {score && (
          <div style={{ marginTop: 10, height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${score.pct}%`, background: D.scoreColor(score.pct), borderRadius: 2 }} />
          </div>
        )}
      </div>

      {/* Agenda */}
      <div style={{ padding: 16, flex: 1, overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#7a8290', textTransform: 'uppercase' }}>Schedule</span>
          <span style={{ fontSize: 10, color: '#5a6170', fontFeatureSettings: '"tnum"' }}>{tasks.length} items</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {tasks.map(task => {
            const done = D.isTaskDone(task, date);
            const c = D.KIND_COLORS[task.kind];
            return (
              <div key={task.id} style={{
                display: 'grid', gridTemplateColumns: '40px 1fr',
                padding: '6px 0', borderBottom: '1px dashed rgba(255,255,255,0.04)',
                gap: 8, alignItems: 'center',
              }}>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 10, fontWeight: 600, color: done ? '#5a6170' : '#9098a8', fontFeatureSettings: '"tnum"' }}>
                  {task.time ? D.fmtTimeShort(task.time) : '—'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 1.5, background: done ? '#3a3f4a' : c.dot, flexShrink: 0 }} />
                  <span style={{
                    fontSize: 12, fontWeight: 500,
                    color: done ? '#5a6170' : '#d4d6dc',
                    textDecoration: done ? 'line-through' : 'none',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{task.title}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 20, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#7a8290', textTransform: 'uppercase' }}>Habits</span>
          <span style={{ fontSize: 10, color: '#5a6170', fontFeatureSettings: '"tnum"' }}>{habits.filter(h => D.isHabitDone(h, date)).length}/{habits.length}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {habits.map(habit => {
            const done = D.isHabitDone(habit, date);
            return (
              <div key={habit.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px dashed rgba(255,255,255,0.04)' }}>
                <span style={{
                  width: 12, height: 12, borderRadius: 3,
                  background: done ? '#10b981' : 'transparent',
                  border: done ? 'none' : '1px solid #3a3f4a',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 900, color: '#08090c',
                }}>{done ? '✓' : ''}</span>
                <span style={{ fontSize: 12, color: done ? '#7a8290' : '#d4d6dc', textDecoration: done ? 'line-through' : 'none' }}>
                  {habit.name}
                </span>
              </div>
            );
          })}
        </div>

        {note && (
          <div style={{ marginTop: 20, padding: 10, background: 'rgba(245,158,11,0.06)', borderLeft: '2px solid #f59e0b', borderRadius: '0 4px 4px 0' }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: '#f59e0b', textTransform: 'uppercase', marginBottom: 4 }}>Note</div>
            <div style={{ fontSize: 11, lineHeight: 1.5, color: '#d6a23a' }}>{note}</div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: '#7a8290', textTransform: 'uppercase', marginBottom: 8 }}>Legend</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Object.entries(D.KIND_COLORS).map(([k, c]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#9098a8' }}>
              <span style={{ width: 8, height: 8, background: c.dot, borderRadius: 1.5 }} />
              <span style={{ textTransform: 'capitalize' }}>{k}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

window.CalendarC = CalendarC;
