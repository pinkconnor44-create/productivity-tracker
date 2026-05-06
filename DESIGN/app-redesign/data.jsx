// Realistic fake data for productivity-tracker, matching the Prisma schema.
// Anchor "today" to May 6 2026.

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const TODAY = '2026-05-06';

function pad(n) { return String(n).padStart(2,'0'); }
function localDate(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function addDays(s, n) { const d = new Date(s+'T12:00:00'); d.setDate(d.getDate()+n); return localDate(d); }

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h%12||12}:${pad(m)} ${h>=12?'PM':'AM'}`;
}
function fmtTimeShort(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h>=12 ? 'p' : 'a';
  return m === 0 ? `${h%12||12}${ap}` : `${h%12||12}:${pad(m)}${ap}`;
}
function fmtDate(s) {
  const t = TODAY;
  if (s === t) return 'Today';
  if (s === addDays(t, 1)) return 'Tomorrow';
  if (s === addDays(t, -1)) return 'Yesterday';
  const d = new Date(s+'T12:00:00');
  return d.toLocaleDateString('en-US',{ month:'short', day:'numeric', year: d.getFullYear() !== 2026 ? 'numeric' : undefined });
}

function hashStr(s) { let h = 2166136261; for (let i=0;i<s.length;i++){ h = Math.imul(h ^ s.charCodeAt(i), 16777619); } return (h >>> 0); }
function rand(seed) { return (hashStr(seed) % 10000) / 10000; }

// ── TASKS ────────────────────────────────────────────────────────────
// Matches Task schema. Mix of recurring + one-offs, with weights.
// Kind is a UI tag (not in real schema) — we use it for color stripes.
const TASKS = [
  // Recurring
  { id: 1, title: 'Standup',                  recurringType: 'weekdays',                                time: '09:30', endTime: '09:45', weight: 1, kind: 'meeting',  description: '15-min sync with the design pod' },
  { id: 2, title: 'Deep work block',          recurringType: 'weekdays',                                time: '10:00', endTime: '12:00', weight: 2, kind: 'focus' },
  { id: 3, title: 'Lunch + walk',             recurringType: 'weekdays',                                time: '12:30', endTime: '13:15', weight: 1, kind: 'personal' },
  { id: 4, title: 'Inbox zero',               recurringType: 'weekdays',                                time: '17:00', endTime: '17:30', weight: 1, kind: 'admin' },
  { id: 5, title: 'Design review',            recurringType: 'weekly',  recurringDays: '2,4',           time: '14:00', endTime: '15:00', weight: 2, kind: 'meeting' },
  { id: 6, title: '1:1 with Maya',            recurringType: 'weekly',  recurringDays: '3',             time: '15:30', endTime: '16:00', weight: 2, kind: 'meeting' },
  { id: 7, title: 'Weekly planning',          recurringType: 'weekly',  recurringDays: '1',             time: '09:00', endTime: '10:00', weight: 3, kind: 'planning' },
  { id: 8, title: 'Weekly review',            recurringType: 'weekly',  recurringDays: '5',             time: '16:00', endTime: '17:00', weight: 3, kind: 'planning' },
  { id: 9, title: 'Long run',                 recurringType: 'weekends',                                time: '07:00', endTime: '08:30', weight: 1, kind: 'personal' },
  // One-offs (some past, some today, some future)
  { id: 20, title: 'Submit expense report',   dueDate: '2026-05-04',                                     time: '11:00', endTime: '11:30', weight: 1, kind: 'admin',  completed: true,  completedAt: '2026-05-04' },
  { id: 21, title: 'Reply to Stripe security', dueDate: '2026-05-05',                                                                       weight: 2, kind: 'admin' },
  { id: 22, title: 'Q2 roadmap draft',        dueDate: '2026-05-06',                                     time: '13:00', endTime: '14:30', weight: 3, kind: 'focus',   description: 'Get Maya & Owen aligned before Friday' },
  { id: 23, title: 'Review PR #1284',         dueDate: '2026-05-06',                                                                        weight: 2, kind: 'admin' },
  { id: 24, title: 'Fix onboarding bug',      dueDate: '2026-05-06',                                                                        weight: 2, kind: 'focus' },
  { id: 25, title: 'Birthday dinner',         dueDate: '2026-05-09',                                     time: '19:00', endTime: '21:00', weight: 1, kind: 'personal', description: 'Reservation @ Gjusta, 7pm' },
  { id: 26, title: 'Doctor appointment',      dueDate: '2026-05-12',                                     time: '09:00', endTime: '10:00', weight: 1, kind: 'personal' },
  { id: 27, title: 'Ship onboarding v2',      dueDate: '2026-05-14',                                                                        weight: 3, kind: 'focus' },
  { id: 28, title: 'Conference talk dry run', dueDate: '2026-05-19',                                     time: '15:00',                     weight: 2, kind: 'planning' },
  { id: 29, title: 'Plan summer trip',        dueDate: '2026-05-30',                                                                        weight: 1, kind: 'personal' },
  { id: 30, title: 'File taxes',              dueDate: '2026-04-14',                                                                        weight: 3, kind: 'admin' }, // overdue
];

// Excused-today set (matches the "skip" model)
const TASK_SKIPS_TODAY = new Set([3]); // skipped lunch+walk today

function isRecurringActiveOnDate(task, date) {
  if (!task.recurringType) return false;
  const d = new Date(date+'T12:00:00');
  const dow = d.getDay();
  switch (task.recurringType) {
    case 'daily':    return true;
    case 'weekdays': return dow >= 1 && dow <= 5;
    case 'weekends': return dow === 0 || dow === 6;
    case 'weekly':   return task.recurringDays?.split(',').map(Number).includes(dow);
    default: return false;
  }
}
function isHabitActiveOnDate(habit, date) {
  if (!habit.recurringDays) return true;
  const dow = new Date(date+'T12:00:00').getDay();
  return habit.recurringDays.split(',').map(Number).includes(dow);
}

function tasksForDate(date) {
  const out = [];
  for (const t of TASKS) {
    if (t.recurringType) { if (isRecurringActiveOnDate(t, date)) out.push(t); }
    else if (t.dueDate === date) out.push(t);
  }
  return out.sort((a,b) => (a.time||'99') < (b.time||'99') ? -1 : 1);
}

// ── HABITS ───────────────────────────────────────────────────────────
const HABITS = [
  { id: 101, name: 'Read 30 min',     description: 'Fiction or long-form, no work',     recurringDays: null,        weight: 1, createdAt: '2026-01-08T07:00:00Z' },
  { id: 102, name: 'Meditate',        description: '10 min, Waking Up app',             recurringDays: null,        weight: 2, createdAt: '2025-11-02T07:00:00Z' },
  { id: 103, name: 'No phone in bed', description: 'Phone in kitchen after 10pm',       recurringDays: null,        weight: 3, createdAt: '2026-02-15T07:00:00Z' },
  { id: 104, name: 'Strength',        description: '45 min lift session',                recurringDays: '1,3,5',     weight: 2, createdAt: '2025-09-12T07:00:00Z' },
  { id: 105, name: 'Mobility',        description: 'Hips + shoulders, 15 min',           recurringDays: '2,4',       weight: 1, createdAt: '2026-03-01T07:00:00Z' },
  { id: 106, name: 'Journal',         description: 'Three lines, anything goes',         recurringDays: null,        weight: 1, createdAt: '2026-04-20T07:00:00Z' },
];

function habitsForDate(date) {
  return HABITS.filter(h => isHabitActiveOnDate(h, date));
}
function isHabitDone(habit, date) {
  if (date > TODAY) return false;
  const r = rand(`habit-${habit.id}-${date}`);
  if (habit.id === 102) return r < 0.96; // meditate — long streak
  if (habit.id === 103) return r < 0.92;
  if (habit.id === 101) return r < 0.78;
  if (habit.id === 104) return r < 0.85;
  if (habit.id === 105) return r < 0.7;
  return r < 0.65;
}
function isHabitSkipped(habit, date) {
  return rand(`hskip-${habit.id}-${date}`) < 0.03;
}

// Stats per habit
function habitStreak(habit) {
  let cur = TODAY;
  let streak = 0;
  // include today if done; else start yesterday
  if (!isHabitActiveOnDate(habit, cur)) cur = addDays(cur, -1);
  if (!isHabitDone(habit, cur) && !isHabitSkipped(habit, cur)) cur = addDays(cur, -1);
  for (let i = 0; i < 365; i++) {
    if (!isHabitActiveOnDate(habit, cur)) { cur = addDays(cur, -1); continue; }
    if (isHabitDone(habit, cur) || isHabitSkipped(habit, cur)) { if (isHabitDone(habit, cur)) streak++; cur = addDays(cur, -1); }
    else break;
  }
  return streak;
}
function habitWindow(habit, days) {
  let done = 0, scheduled = 0;
  let cur = addDays(TODAY, -(days-1));
  while (cur <= TODAY) {
    if (isHabitActiveOnDate(habit, cur)) {
      scheduled++;
      if (isHabitDone(habit, cur)) done++;
    }
    cur = addDays(cur, 1);
  }
  return { done, scheduled };
}

// ── TASK COMPLETION (recurring) ──────────────────────────────────────
function isRecurringTaskDone(task, date) {
  if (date > TODAY) return false;
  if (date === TODAY && TASK_SKIPS_TODAY.has(task.id)) return false;
  const r = rand(`task-${task.id}-${date}`);
  if (task.kind === 'planning') return r < 0.92;
  if (task.kind === 'admin')    return r < 0.78;
  if (task.kind === 'meeting')  return r < 0.95; // meetings usually happen
  if (task.kind === 'focus')    return r < 0.7;
  if (task.kind === 'personal') return r < 0.85;
  return r < 0.82;
}
function isOneOffTaskDone(task) {
  return !!task.completed;
}

// ── DAILY SCORE ──────────────────────────────────────────────────────
function scoreForDate(date) {
  if (date > TODAY) return null;
  const tasks = tasksForDate(date);
  const habits = habitsForDate(date);
  let done = 0, total = 0;
  for (const t of tasks) {
    if (date === TODAY && t.recurringType && TASK_SKIPS_TODAY.has(t.id)) continue;
    const w = t.weight ?? 1;
    total += w;
    const isDone = t.recurringType ? isRecurringTaskDone(t, date) : isOneOffTaskDone(t) && t.completedAt === date;
    if (isDone) done += w;
  }
  for (const h of habits) {
    const w = h.weight ?? 1;
    total += w;
    if (isHabitDone(h, date)) done += w;
  }
  if (total === 0) return null;
  return { completed: done, total, pct: Math.round((done/total)*100) };
}

function aggregatePct(start, end) {
  let done = 0, total = 0;
  let cursor = start;
  while (cursor <= end && cursor <= TODAY) {
    const s = scoreForDate(cursor);
    if (s) { done += s.completed; total += s.total; }
    cursor = addDays(cursor, 1);
  }
  return total === 0 ? null : Math.round((done/total)*100);
}

// 90 days of scores for the trend chart
function scoresWindow(days) {
  const out = [];
  for (let i = days-1; i >= 0; i--) {
    const date = addDays(TODAY, -i);
    const s = scoreForDate(date);
    if (s) out.push({ date, ...s });
  }
  return out;
}

// ── LIFTS ────────────────────────────────────────────────────────────
const LIFT_GROUPS = [
  { id: 1, name: 'Push',  exercises: ['Bench Press', 'Overhead Press', 'Incline DB Press', 'Tricep Pushdown', 'Lateral Raise'], order: 0 },
  { id: 2, name: 'Pull',  exercises: ['Deadlift', 'Pull Up', 'Barbell Row', 'Face Pull', 'DB Curl'],                              order: 1 },
  { id: 3, name: 'Legs',  exercises: ['Back Squat', 'Romanian Deadlift', 'Leg Press', 'Walking Lunge', 'Calf Raise'],             order: 2 },
];

// Synthesize lift sessions over the last 90 days
const LIFT_ENTRIES = (() => {
  const out = [];
  let id = 1000;
  // Push days roughly Mon, Pull Wed, Legs Fri — but realistic gaps
  const schedule = { 1: 'Push', 3: 'Pull', 5: 'Legs' };
  for (let i = 89; i >= 0; i--) {
    const date = addDays(TODAY, -i);
    const dow = new Date(date+'T12:00:00').getDay();
    const dayName = schedule[dow];
    if (!dayName) continue;
    if (rand(`liftday-${date}`) < 0.18) continue; // 18% miss rate
    const grp = LIFT_GROUPS.find(g => g.name === dayName);
    for (const ex of grp.exercises) {
      // Skip an exercise sometimes
      if (rand(`liftex-${date}-${ex}`) < 0.15) continue;
      // Progressive overload — base weights with tiny upward drift
      const baseW = baseWeightFor(ex);
      const drift = Math.floor((90 - i) / 14) * 5;
      const noise = Math.round(rand(`weight-${date}-${ex}`) * 10) - 5;
      const weight = baseW + drift + noise;
      const setCount = ex.includes('Lateral') || ex.includes('Calf') || ex.includes('Curl') || ex.includes('Pushdown') ? 4 : 3;
      const sets = Array.from({ length: setCount }, (_, s) => Math.max(4, Math.round(8 + rand(`reps-${date}-${ex}-${s}`)*4 - 2)));
      const totalReps = sets.reduce((a,b) => a+b, 0);
      out.push({ id: id++, date, name: ex, weight, sets: JSON.stringify(sets), totalReps });
    }
  }
  return out;
})();

function baseWeightFor(ex) {
  if (ex === 'Bench Press') return 185;
  if (ex === 'Overhead Press') return 115;
  if (ex === 'Incline DB Press') return 65;
  if (ex === 'Tricep Pushdown') return 50;
  if (ex === 'Lateral Raise') return 20;
  if (ex === 'Deadlift') return 285;
  if (ex === 'Pull Up') return 0;
  if (ex === 'Barbell Row') return 155;
  if (ex === 'Face Pull') return 40;
  if (ex === 'DB Curl') return 30;
  if (ex === 'Back Squat') return 235;
  if (ex === 'Romanian Deadlift') return 195;
  if (ex === 'Leg Press') return 360;
  if (ex === 'Walking Lunge') return 40;
  if (ex === 'Calf Raise') return 90;
  return 50;
}

// ── COLOR HELPERS ────────────────────────────────────────────────────
function scoreColor(pct) {
  if (pct == null) return '#94a3b8';
  if (pct >= 75) return '#10b981';
  if (pct >= 50) return '#f59e0b';
  return '#f43f5e';
}
function scoreColorBg(pct, alpha = 0.16) {
  if (pct == null) return `rgba(148,163,184,${alpha})`;
  if (pct >= 75) return `rgba(16,185,129,${alpha})`;
  if (pct >= 50) return `rgba(245,158,11,${alpha})`;
  return `rgba(244,63,94,${alpha})`;
}

const KIND_COLORS = {
  meeting:  { bg: 'rgba(139,92,246,0.16)',  fg: '#c4b5fd', dot: '#a78bfa', label: 'Meeting' },
  focus:    { bg: 'rgba(6,182,212,0.16)',   fg: '#67e8f9', dot: '#22d3ee', label: 'Focus' },
  personal: { bg: 'rgba(236,72,153,0.16)',  fg: '#f9a8d4', dot: '#ec4899', label: 'Personal' },
  admin:    { bg: 'rgba(148,163,184,0.16)', fg: '#cbd5e1', dot: '#94a3b8', label: 'Admin' },
  planning: { bg: 'rgba(245,158,11,0.16)',  fg: '#fcd34d', dot: '#f59e0b', label: 'Planning' },
};

// Weight UI labels
const W_LABEL = ['','Normal','Important','Critical'];
const W_COLOR = ['','#8b8da3','#60a5fa','#fb923c']; // text
const W_BG    = ['','rgba(139,141,163,0.10)','rgba(96,165,250,0.16)','rgba(251,146,60,0.16)'];

window.AppData = {
  MONTHS, WEEKDAYS, TODAY,
  pad, localDate, addDays, fmtTime, fmtTimeShort, fmtDate, rand,
  TASKS, TASK_SKIPS_TODAY, tasksForDate, isRecurringActiveOnDate, isRecurringTaskDone, isOneOffTaskDone,
  HABITS, habitsForDate, isHabitActiveOnDate, isHabitDone, isHabitSkipped, habitStreak, habitWindow,
  scoreForDate, aggregatePct, scoresWindow,
  LIFT_GROUPS, LIFT_ENTRIES,
  scoreColor, scoreColorBg, KIND_COLORS, W_LABEL, W_COLOR, W_BG,
};
