// Tasks view — Theme A
const D = window.AppData;
const { PageHeader, StatCard, Card, Section, KindChip, WeightChip, Checkbox, NavBtn, Eyebrow } = window.Theme;
const T = window.T;

function groupTasks() {
  const t = D.TODAY;
  const nextWeek = D.addDays(t, 7);
  const g = { overdue: [], today: [], thisWeek: [], later: [], completed: [] };
  for (const task of D.TASKS) {
    if (task.recurringType) continue;
    if (task.completed) { g.completed.push(task); continue; }
    if (!task.dueDate) continue;
    if (task.dueDate < t) g.overdue.push(task);
    else if (task.dueDate === t) g.today.push(task);
    else if (task.dueDate <= nextWeek) g.thisWeek.push(task);
    else g.later.push(task);
  }
  g.overdue.sort((a, b) => a.dueDate < b.dueDate ? -1 : 1);
  return g;
}

function TaskRow({ task, done, skipped, isLast }) {
  const c = D.KIND_COLORS[task.kind];
  const isOverdue = task.dueDate && task.dueDate < D.TODAY && !done;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '12px 16px 12px 0',
      borderLeft: `3px solid ${c.dot}`,
      borderBottom: isLast ? 'none' : `1px solid ${T.borderHair}`,
      background: skipped ? 'rgba(245,158,11,0.06)' : 'transparent',
    }}>
      <div style={{ width: 12 }} />
      <div style={{ marginTop: 1 }}>
        <Checkbox checked={done} skipped={skipped} kind={task.kind} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 500,
          color: skipped ? T.textMuted : done ? T.textVDim : T.text,
          textDecoration: done ? 'line-through' : 'none',
          letterSpacing: '-0.005em',
        }}>{task.title}</div>
        {task.description && (
          <div style={{ fontSize: 11.5, color: T.textDim, marginTop: 3, lineHeight: 1.4 }}>{task.description}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
          <KindChip kind={task.kind} />
          {task.dueDate && (
            <span style={{ fontSize: 11, fontWeight: 600, color: isOverdue ? '#f43f5e' : task.dueDate === D.TODAY ? T.accent : T.textMuted }}>
              {isOverdue && '⚠ '}{D.fmtDate(task.dueDate)}{isOverdue && ' · overdue'}
            </span>
          )}
          {task.time && (
            <span style={{ fontSize: 11, color: T.textMuted, fontFeatureSettings: '"tnum"' }}>
              {D.fmtTimeShort(task.time)}{task.endTime ? `–${D.fmtTimeShort(task.endTime)}` : ''}
            </span>
          )}
          <WeightChip w={task.weight} />
          {skipped && <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.15)', padding: '2px 7px', borderRadius: 999 }}>⏸ EXCUSED TODAY</span>}
        </div>
      </div>
    </div>
  );
}

function TaskRows({ tasks, recurring }) {
  return (
    <Card>
      {tasks.map((task, i) => {
        const isLast = i === tasks.length - 1;
        if (recurring) {
          const skipped = D.TASK_SKIPS_TODAY.has(task.id);
          const done = !skipped && D.isRecurringTaskDone(task, D.TODAY);
          return <TaskRow key={task.id} task={task} done={done} skipped={skipped} isLast={isLast} />;
        }
        return <TaskRow key={task.id} task={task} done={!!task.completed} isLast={isLast} />;
      })}
    </Card>
  );
}

function TasksView() {
  const groups = groupTasks();
  const recurringToday = D.TASKS.filter(t => t.recurringType && D.isRecurringActiveOnDate(t, D.TODAY));
  const recurringDoneCount = recurringToday.filter(t => !D.TASK_SKIPS_TODAY.has(t.id) && D.isRecurringTaskDone(t, D.TODAY)).length;

  const todayScore = D.scoreForDate(D.TODAY);
  const overdueCount = groups.overdue.length;
  const totalOpenWeight = D.TASKS.filter(t => !t.recurringType && !t.completed).reduce((s, t) => s + (t.weight ?? 1), 0);
  const completedThisWeek = D.TASKS.filter(t => t.completed && t.completedAt && t.completedAt >= D.addDays(D.TODAY, -6)).length;

  return (
    <div>
      <PageHeader
        eyebrow="Tasks"
        title={<>Wednesday <span style={{ color: T.textMuted }}>· May 6</span></>}
        sub="Recurring rituals plus what's on the docket. Excused items don't count against your score."
        right={
          <button style={{
            padding: '10px 18px', fontSize: 13, fontWeight: 600,
            background: T.accentGrad, color: '#fff', border: 'none',
            borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: T.accentGlow,
          }}>+ New task</button>
        }
      />

      {/* Stat strip */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <StatCard label="Today" value={todayScore?.pct ?? 0} suffix="%" sub={`${todayScore?.completed ?? 0}/${todayScore?.total ?? 0} weighted`} color={D.scoreColor(todayScore?.pct)} barPct={todayScore?.pct} />
        <StatCard label="Recurring done" value={`${recurringDoneCount}/${recurringToday.length}`} sub="rituals today" color={T.accent} barPct={recurringToday.length ? (recurringDoneCount / recurringToday.length) * 100 : 0} />
        <StatCard label="Overdue" value={overdueCount} sub={overdueCount === 0 ? 'nothing late' : 'needs triage'} color={overdueCount > 0 ? '#f43f5e' : '#10b981'} barPct={overdueCount > 0 ? 100 : 0} />
        <StatCard label="Open work" value={totalOpenWeight} sub="weighted points" color={T.accent} barPct={Math.min(100, totalOpenWeight * 4)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
        <Section dot="#a78bfa" color="#a78bfa" label="Recurring · Today" count={recurringDoneCount} total={recurringToday.length}>
          <TaskRows tasks={recurringToday} recurring />
        </Section>

        {groups.overdue.length > 0 && (
          <Section dot="#f43f5e" color="#f43f5e" label="Overdue" count={0} total={groups.overdue.length}>
            <TaskRows tasks={groups.overdue} />
          </Section>
        )}

        {groups.today.length > 0 && (
          <Section dot="#a78bfa" color="#a78bfa" label="Today" count={groups.today.filter(t => t.completed).length} total={groups.today.length}>
            <TaskRows tasks={groups.today} />
          </Section>
        )}

        {groups.thisWeek.length > 0 && (
          <Section dot="#22d3ee" color="#22d3ee" label="This Week" count={groups.thisWeek.filter(t => t.completed).length} total={groups.thisWeek.length}>
            <TaskRows tasks={groups.thisWeek} />
          </Section>
        )}

        {groups.later.length > 0 && (
          <Section dot={T.textMuted} color={T.textMuted} label="Later" count={groups.later.filter(t => t.completed).length} total={groups.later.length}>
            <TaskRows tasks={groups.later} />
          </Section>
        )}

        {groups.completed.length > 0 && (
          <Section dot="#10b981" color="#10b981" label="Recently Completed" count={groups.completed.length} total={groups.completed.length}>
            <TaskRows tasks={groups.completed} />
          </Section>
        )}
      </div>
    </div>
  );
}

window.TasksView = TasksView;
