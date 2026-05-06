// Shared fake data for all three calendar variations.
// Real-looking productivity data for May 2026.

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const WEEKDAYS_LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// Anchor "today" to May 6 2026 to match the provided system date.
const TODAY = '2026-05-06';
const VIEW_YEAR = 2026;
const VIEW_MONTH = 4; // 0-indexed → May

function pad(n) { return String(n).padStart(2,'0'); }
function localDate(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function addDays(s, n) { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate()+n); return localDate(d); }
function startOfWeek(s) { const d = new Date(s+'T12:00:00'); d.setDate(d.getDate()-d.getDay()); return localDate(d); }
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

function getMonthDays(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();
  const days = [];
  for (let i = firstDay-1; i >= 0; i--)
    days.push({ date: localDate(new Date(year, month-1, prevMonthDays-i)), isCurrentMonth: false });
  for (let i = 1; i <= daysInMonth; i++)
    days.push({ date: localDate(new Date(year, month, i)), isCurrentMonth: true });
  while (days.length < 42) {
    const idx = days.length - firstDay - daysInMonth + 1;
    days.push({ date: localDate(new Date(year, month+1, idx)), isCurrentMonth: false });
  }
  return days;
}

// Recurring patterns
const TASKS = [
  // Daily-ish meetings
  { id: 1, title: 'Standup',                time: '09:30', endTime: '09:45', recurringDays: '1,2,3,4,5', kind: 'meeting' },
  { id: 2, title: 'Deep work block',        time: '10:00', endTime: '12:00', recurringDays: '1,2,3,4,5', kind: 'focus' },
  { id: 3, title: 'Lunch + walk',           time: '12:30', endTime: '13:15', recurringDays: '1,2,3,4,5', kind: 'personal' },
  { id: 4, title: 'Design review',          time: '14:00', endTime: '15:00', recurringDays: '2,4',       kind: 'meeting' },
  { id: 5, title: '1:1 with Maya',          time: '15:30', endTime: '16:00', recurringDays: '3',         kind: 'meeting' },
  { id: 6, title: 'Inbox zero',             time: '17:00', endTime: '17:30', recurringDays: '1,2,3,4,5', kind: 'admin' },
  // Weekly
  { id: 7, title: 'Planning',               time: '09:00', endTime: '10:00', recurringDays: '1',         kind: 'planning' },
  { id: 8, title: 'Weekly review',          time: '16:00', endTime: '17:00', recurringDays: '5',         kind: 'planning' },
  { id: 9, title: 'Long run',               time: '07:00', endTime: '08:30', recurringDays: '0,6',       kind: 'personal' },
  // One-offs
  { id: 10, title: 'Q2 roadmap draft',      dueDate: '2026-05-06', time: '13:00', endTime: '14:30', kind: 'focus' },
  { id: 11, title: 'Submit expense report', dueDate: '2026-05-04', time: '11:00', endTime: '11:30', kind: 'admin' },
  { id: 12, title: 'Birthday dinner',       dueDate: '2026-05-09', time: '19:00', endTime: '21:00', kind: 'personal' },
  { id: 13, title: 'Doctor appointment',    dueDate: '2026-05-12', time: '09:00', endTime: '10:00', kind: 'personal' },
  { id: 14, title: 'Ship onboarding v2',    dueDate: '2026-05-14', time: '17:00', endTime: '18:00', kind: 'focus' },
  { id: 15, title: 'Conference talk',       dueDate: '2026-05-21', time: '14:00', endTime: '15:30', kind: 'meeting' },
  { id: 16, title: 'Quarterly planning',    dueDate: '2026-05-28', time: '10:00', endTime: '12:00', kind: 'planning' },
];

const HABITS = [
  { id: 101, name: 'Read 30 min',    recurringDays: '0,1,2,3,4,5,6' },
  { id: 102, name: 'Meditate',       recurringDays: '0,1,2,3,4,5,6' },
  { id: 103, name: 'No phone in bed',recurringDays: '0,1,2,3,4,5,6' },
  { id: 104, name: 'Strength',       recurringDays: '1,3,5' },
  { id: 105, name: 'Mobility',       recurringDays: '2,4' },
];

// Deterministic pseudo-random: seeded by date string
function hashStr(s) { let h = 2166136261; for (let i=0;i<s.length;i++){ h = Math.imul(h ^ s.charCodeAt(i), 16777619); } return (h >>> 0); }
function rand(seed) { return (hashStr(seed) % 10000) / 10000; }

function tasksForDate(date) {
  const d = new Date(date+'T12:00:00');
  const dow = d.getDay();
  const out = [];
  for (const t of TASKS) {
    if (t.dueDate === date) out.push(t);
    else if (t.recurringDays && t.recurringDays.split(',').map(Number).includes(dow)) out.push(t);
  }
  return out.sort((a,b) => (a.time||'99') < (b.time||'99') ? -1 : 1);
}
function habitsForDate(date) {
  const d = new Date(date+'T12:00:00');
  const dow = d.getDay();
  return HABITS.filter(h => h.recurringDays.split(',').map(Number).includes(dow));
}

// Completion state — past dates have realistic completion percentages
function isTaskDone(task, date) {
  if (date > TODAY) return false;
  const r = rand(`task-${task.id}-${date}`);
  // weekly review and planning items: highly completed
  if (task.kind === 'planning') return r < 0.92;
  if (task.kind === 'admin') return r < 0.78;
  if (task.kind === 'focus') return r < 0.7;
  if (task.kind === 'personal') return r < 0.85;
  return r < 0.82;
}
function isTaskSkipped(task, date) {
  if (date > TODAY) return false;
  return rand(`skip-${task.id}-${date}`) < 0.04;
}
function isHabitDone(habit, date) {
  if (date > TODAY) return false;
  const r = rand(`habit-${habit.id}-${date}`);
  if (habit.id === 102) return r < 0.95; // meditation streak
  if (habit.id === 101) return r < 0.78;
  if (habit.id === 104) return r < 0.88;
  return r < 0.7;
}

function scoreForDate(date) {
  if (date > TODAY) return null;
  const tasks = tasksForDate(date);
  const habits = habitsForDate(date);
  let done = 0, total = 0;
  for (const t of tasks) {
    if (isTaskSkipped(t, date)) continue;
    total++;
    if (isTaskDone(t, date)) done++;
  }
  for (const h of habits) {
    total++;
    if (isHabitDone(h, date)) done++;
  }
  if (total === 0) return null;
  const pct = Math.round((done/total)*100);
  return { completed: done, total, pct };
}

const NOTES = {
  '2026-05-04': 'Pushed roadmap v1 — Maya wants more risk on infra.',
  '2026-05-05': 'Solid focus day. 3 hours uninterrupted.',
  '2026-05-08': 'Mom flying in tonight ✈️',
  '2026-05-15': 'Off — beach trip 🌊',
  '2026-05-25': 'Memorial Day',
};

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

const TODAY_DATE_OBJ = new Date(TODAY+'T12:00:00');
const SUMMARY = {
  day:   scoreForDate(TODAY)?.pct ?? null,
  week:  aggregatePct(startOfWeek(TODAY), addDays(startOfWeek(TODAY), 6)),
  month: aggregatePct(`2026-${pad(VIEW_MONTH+1)}-01`, TODAY),
  year:  aggregatePct('2026-01-01', TODAY),
};

// Color helpers
function scoreColor(pct) {
  if (pct == null) return '#94a3b8';
  if (pct >= 75) return '#10b981';
  if (pct >= 50) return '#f59e0b';
  return '#f43f5e';
}
function scoreColorSoft(pct) {
  if (pct == null) return 'rgba(148,163,184,0.10)';
  if (pct >= 75) return 'rgba(16,185,129,0.12)';
  if (pct >= 50) return 'rgba(245,158,11,0.12)';
  return 'rgba(244,63,94,0.12)';
}

// Task kind → soft color
const KIND_COLORS = {
  meeting:  { bg: 'rgba(139,92,246,0.16)',  fg: '#c4b5fd', dot: '#a78bfa' },
  focus:    { bg: 'rgba(6,182,212,0.16)',   fg: '#67e8f9', dot: '#22d3ee' },
  personal: { bg: 'rgba(236,72,153,0.16)',  fg: '#f9a8d4', dot: '#ec4899' },
  admin:    { bg: 'rgba(148,163,184,0.16)', fg: '#cbd5e1', dot: '#94a3b8' },
  planning: { bg: 'rgba(245,158,11,0.16)',  fg: '#fcd34d', dot: '#f59e0b' },
};

window.CalData = {
  MONTHS, WEEKDAYS, WEEKDAYS_LONG, TODAY, VIEW_YEAR, VIEW_MONTH,
  pad, localDate, addDays, startOfWeek, fmtTime, fmtTimeShort, getMonthDays,
  TASKS, HABITS, NOTES, SUMMARY,
  tasksForDate, habitsForDate, isTaskDone, isTaskSkipped, isHabitDone, scoreForDate,
  scoreColor, scoreColorSoft, KIND_COLORS, rand,
};
