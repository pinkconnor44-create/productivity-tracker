// Variation B — Editorial Calm
// Quiet, magazine-like layout. Drops aurora + per-cell color tints.
// Cells are minimal: just date + a small ribbon of dots showing each event,
// colored by completion. Score lives in a year-strip "spine" on the left.
// Typography does the heavy lifting.

const D = window.CalData;

function CalendarB() {
  const days = D.getMonthDays(D.VIEW_YEAR, D.VIEW_MONTH);
  const [selected, setSelected] = React.useState(D.TODAY);

  // Build a year-strip — one mark per day Jan 1 → today
  const yearMarks = [];
  let cur = '2026-01-01';
  while (cur <= D.TODAY) {
    yearMarks.push({ date: cur, score: D.scoreForDate(cur) });
    cur = D.addDays(cur, 1);
  }

  return (
    <div style={{
      width: 1180, padding: 40,
      background: '#0e1117',
      fontFamily: 'Manrope, sans-serif',
      color: '#e4e6eb',
      borderRadius: 16,
    }}>
      {/* Editorial header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8, paddingBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', color: '#7a8290', textTransform: 'uppercase', marginBottom: 12 }}>
            ⎯⎯ The Calendar ⎯⎯
          </div>
          <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 64, fontWeight: 500, letterSpacing: '-0.04em', margin: 0, lineHeight: 0.95, color: '#f0f2f5' }}>
            May
          </h1>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 18, fontWeight: 400, color: '#7a8290', marginTop: 4, letterSpacing: '0.02em' }}>
            Two thousand twenty-six · Week 19
          </div>
        </div>
        <div style={{ display: 'flex', gap: 32, alignItems: 'flex-end' }}>
          <BigStat label="day" pct={D.SUMMARY.day} />
          <BigStat label="week" pct={D.SUMMARY.week} />
          <BigStat label="month" pct={D.SUMMARY.month} />
          <BigStat label="year" pct={D.SUMMARY.year} />
        </div>
      </div>

      {/* View switcher (subtle, underline-style) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0 24px' }}>
        <div style={{ display: 'flex', gap: 24 }}>
          {['Month','Week','Day'].map((v, i) => (
            <button key={v} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: 600, padding: '4px 0',
              color: i === 0 ? '#f0f2f5' : '#7a8290',
              borderBottom: i === 0 ? '1.5px solid #f0f2f5' : '1.5px solid transparent',
              letterSpacing: '0.02em',
            }}>{v}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 13, color: '#7a8290' }}>
          <span style={{ cursor: 'pointer' }}>← April</span>
          <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.1)' }} />
          <span style={{ cursor: 'pointer', color: '#f0f2f5', fontWeight: 600 }}>Today</span>
          <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.1)' }} />
          <span style={{ cursor: 'pointer' }}>June →</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 320px', gap: 24, alignItems: 'flex-start' }}>
        {/* Year spine — vertical heatmap */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 0' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: '#7a8290', textTransform: 'uppercase', marginBottom: 8, writingMode: 'vertical-rl', transform: 'rotate(180deg)', alignSelf: 'center' }}>
            year so far
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2 }}>
            {yearMarks.map(({ date, score }, i) => {
              const isToday = date === D.TODAY;
              const opacity = score == null ? 0.08 : Math.max(0.15, score.pct/100);
              const color = score == null ? '#7a8290' : D.scoreColor(score.pct);
              return (
                <div key={i} title={date}
                  style={{
                    aspectRatio: '1',
                    background: color, opacity,
                    borderRadius: 1.5,
                    outline: isToday ? '1.5px solid #f0f2f5' : 'none',
                    outlineOffset: 1,
                  }} />
              );
            })}
          </div>
        </div>

        {/* Month grid */}
        <div>
          {/* Weekday letters */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 12 }}>
            {['S','M','T','W','T','F','S'].map((wd, i) => (
              <div key={i} style={{ textAlign: 'center', fontFamily: 'Space Grotesk, sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '0.2em', color: '#5a6170', textTransform: 'uppercase' }}>{wd}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
            {days.map(({ date, isCurrentMonth }, i) => {
              const score = D.scoreForDate(date);
              const dayTasks = D.tasksForDate(date);
              const isToday = date === D.TODAY;
              const isFuture = date > D.TODAY;
              const isSelected = date === selected;
              const isWeekend = i % 7 === 0 || i % 7 === 6;
              const dayNum = new Date(date+'T12:00:00').getDate();
              const hasNote = !!D.NOTES[date];

              // Show first event title if present (one-liner italic)
              const firstEvent = dayTasks.find(t => t.time);

              return (
                <button key={i} onClick={() => setSelected(date)} style={{
                  height: 110, padding: '10px 12px', textAlign: 'left', cursor: 'pointer',
                  background: isSelected ? 'rgba(255,255,255,0.04)' : 'transparent',
                  border: '1px solid ' + (isSelected ? 'rgba(255,255,255,0.12)' : 'transparent'),
                  borderRadius: 8,
                  display: 'flex', flexDirection: 'column', gap: 6, position: 'relative',
                  opacity: isCurrentMonth ? 1 : 0.25,
                  fontFamily: 'inherit', color: 'inherit',
                  transition: 'background 150ms, border-color 150ms',
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <span style={{
                      fontFamily: 'Space Grotesk, sans-serif',
                      fontSize: isToday ? 22 : 18, fontWeight: isToday ? 600 : 400,
                      letterSpacing: '-0.02em', lineHeight: 1,
                      color: isToday ? '#f0f2f5' : isWeekend ? '#5a6170' : '#9098a8',
                    }}>{dayNum}</span>
                    {hasNote && <span style={{ fontSize: 10, color: '#d6a23a' }}>✦</span>}
                  </div>
                  {/* Event ribbon — small dots */}
                  {dayTasks.length > 0 && (
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      {dayTasks.slice(0, 8).map((t, j) => {
                        const done = D.isTaskDone(t, date);
                        const c = D.KIND_COLORS[t.kind];
                        return (
                          <span key={j} style={{
                            width: 5, height: 5, borderRadius: '50%',
                            background: done ? 'transparent' : c.dot,
                            border: done ? `1px solid ${c.dot}` : 'none',
                            opacity: done ? 0.45 : 1,
                          }} />
                        );
                      })}
                    </div>
                  )}
                  {firstEvent && (
                    <div style={{
                      fontSize: 10, fontStyle: 'italic', color: '#7a8290',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '0.01em',
                    }}>
                      {firstEvent.title}
                    </div>
                  )}
                  {/* Score line — bottom hairline */}
                  {score && !isFuture && (
                    <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1, height: 1.5, background: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${score.pct}%`, background: D.scoreColor(score.pct) }} />
                      </div>
                      <span style={{ fontSize: 9, color: '#5a6170', fontFeatureSettings: '"tnum"', fontWeight: 500 }}>
                        {score.pct}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected day — editorial style */}
        <SelectedDayB date={selected} />
      </div>
    </div>
  );
}

function BigStat({ label, pct }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 32, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1, color: pct == null ? '#5a6170' : '#f0f2f5' }}>
        {pct == null ? '—' : pct}
        {pct != null && <span style={{ fontSize: 14, color: '#7a8290', marginLeft: 1 }}>%</span>}
      </div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.15em', color: '#7a8290', textTransform: 'uppercase', marginTop: 6 }}>{label}</div>
    </div>
  );
}

function SelectedDayB({ date }) {
  if (!date) return null;
  const d = new Date(date+'T12:00:00');
  const score = D.scoreForDate(date);
  const tasks = D.tasksForDate(date);
  const habits = D.habitsForDate(date);
  const note = D.NOTES[date];
  const isToday = date === D.TODAY;

  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: '#7a8290', textTransform: 'uppercase', marginBottom: 8 }}>
        {isToday ? 'Today' : D.WEEKDAYS_LONG[d.getDay()]}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 56, fontWeight: 500, letterSpacing: '-0.04em', lineHeight: 0.9, color: '#f0f2f5' }}>
          {d.getDate()}
        </div>
        <div>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 16, color: '#9098a8' }}>{D.MONTHS[d.getMonth()]}</div>
          {score && (
            <div style={{ fontSize: 11, color: '#7a8290', marginTop: 2, fontFeatureSettings: '"tnum"' }}>
              <span style={{ color: D.scoreColor(score.pct), fontWeight: 700 }}>{score.pct}%</span> · {score.completed} of {score.total}
            </div>
          )}
        </div>
      </div>

      {/* Schedule timeline — show tasks as a vertical timeline */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', color: '#7a8290', textTransform: 'uppercase', marginBottom: 12 }}>Schedule</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tasks.map(task => {
            const done = D.isTaskDone(task, date);
            const c = D.KIND_COLORS[task.kind];
            return (
              <div key={task.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{
                  fontFamily: 'Space Grotesk, sans-serif', fontSize: 10, fontWeight: 600,
                  color: done ? '#5a6170' : '#9098a8', minWidth: 36, paddingTop: 2,
                  fontFeatureSettings: '"tnum"', letterSpacing: '0.02em',
                }}>{task.time ? D.fmtTimeShort(task.time) : '—'}</div>
                <div style={{ width: 2, alignSelf: 'stretch', background: c.dot, opacity: done ? 0.3 : 0.6, borderRadius: 1, marginTop: 2, marginBottom: 2 }} />
                <div style={{ flex: 1, paddingTop: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 500,
                    color: done ? '#5a6170' : '#e4e6eb',
                    textDecoration: done ? 'line-through' : 'none',
                  }}>{task.title}</div>
                  <div style={{ fontSize: 10, color: '#7a8290', marginTop: 1, textTransform: 'capitalize' }}>{task.kind}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Habits */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', color: '#7a8290', textTransform: 'uppercase', marginBottom: 12 }}>
          Habits
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {habits.map(habit => {
            const done = D.isHabitDone(habit, date);
            return (
              <span key={habit.id} style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 99,
                fontWeight: 500,
                background: done ? 'rgba(16,185,129,0.10)' : 'transparent',
                border: '1px solid ' + (done ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'),
                color: done ? '#34d399' : '#9098a8',
              }}>
                {done && '✓ '}{habit.name}
              </span>
            );
          })}
        </div>
      </div>

      {note && (
        <div style={{ paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', color: '#d6a23a', textTransform: 'uppercase', marginBottom: 8 }}>✦ Note</div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: '#c8b078', fontStyle: 'italic', fontFamily: 'Space Grotesk, sans-serif' }}>"{note}"</div>
        </div>
      )}
    </div>
  );
}

window.CalendarB = CalendarB;
