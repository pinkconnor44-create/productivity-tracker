# 010 — `src/components/CalendarView.tsx` (65,367 B, 1,228 lines) — first line-by-line read

_Read in full, both halves. Gate: `npx tsc --noEmit` exit 0. Date arithmetic
verified by executing the file's own functions under `node`. No browser was
opened (orrery/extension hazard). Nothing was written to the DB._

## Rule scorecard — checked, not assumed

| Rule | Verdict | Evidence |
|---|---|---|
| Every delete through `useConfirm()` | **HOLDS** | `:840` `const confirm = useConfirm()`; `:841-848` task, `:849-856` habit. No `window.confirm`, no inline `setConfirming`, in the whole file. |
| Ancestor `transform` traps `position: fixed` | **HOLDS** | `DayModal` (`:1203`, `fixed`) is a **sibling** of the `cal-slide-*` keyed div, not a child (`:336` vs `:342`). The hover popover portals to `document.body` (`:549`, `:584`). Only ancestor transform is `.tab-fade` (`globals.css:162`), a 0.22s animation with **no `forwards`** — it cannot overlap a click-opened modal. The two defensive comments (`:286-288`, `:328-330`) are accurate and load-bearing. |
| `hover:` never fires on touch | **HOLDS** | `:955` and `:998` are exactly `opacity-100 sm:opacity-0 sm:group-hover:opacity-100`. `MonthView` additionally gates the hover popover on `matchMedia('(hover: hover)')` (`:428`) and force-clears it when the modal opens (`:430`), with the reasoning written down. |
| Optimistic writes use functional updaters | **VACUOUS** | There are **no optimistic writes here**. Every mutation awaits the server then refetches. All seven `setX(prev => …)` sites (`:195,208,214,223,228,859,860`) are correctly functional. One non-functional *read*: the re-entrancy guard `togglingIds.has(key)` (`:194`, `:213`) is closure-captured — weak, React flushes between clicks. |
| Completion windows cap denominators to start date | **HOLDS — and not this file's job** | `aggregatePct` (`:96-102`) pools `completed`/`total` straight from `/api/scores`, which builds `total` from `isTaskActiveOnDate`/`isHabitActiveOnDate` (start-date aware) and **omits any day with `total === 0`** (`api/scores/route.ts:85`). So: weights already baked in, no wrong denominator, no divide-by-zero — `total===0` returns `null` and the card renders `—`. |
| DST / timezone | **HOLDS** | Every string→`Date` in the file anchors at `T12:00:00` (13 sites) and every `Date`→string goes through `localDate()` reading local fields. No `toISOString()` anywhere. Clean. |

Rejected #2 (`aggregatePct` + future dates) is **not** resurrected below — issue 4
is about the *empty* end of the window, not the future end.

---

## 1. `navigate()` skips a whole month, or dead-ends, from any 29th–31st

**Verdict: defect, real, shipped since the initial commit.**
`src/components/CalendarView.tsx:175` · **severity: high** (silent wrong
navigation) · **verified by execution** · **defect**

```js
if (view === 'month') { d.setMonth(d.getMonth()+dir); d.setDate(1) }
```

`setMonth` is applied while the day-of-month is still 29/30/31, so it overflows
before `setDate(1)` can help. Ran the file's own code:

```
2026-01-31   next-> 2026-03-01   prev-> 2025-12-01   (February skipped)
2026-01-29   next-> 2026-03-01                        (February skipped)
2026-03-31   next-> 2026-05-01   prev-> 2026-03-01   (April skipped; Prev is a no-op)
2026-05-31   next-> 2026-07-01                        (June skipped)
2026-08-31   next-> 2026-10-01   prev-> 2026-07-01   (September skipped)
2026-10-31   next-> 2026-12-01                        (November skipped)
2026-08-10   next-> 2026-09-01   prev-> 2026-07-01   (correct)
```

**Reachability** — `currentDate` is a 29th–31st whenever (a) the app is opened on
one, which is the default state (`:106` `useState(today())`), or (b) the user
uses Day/Week view to land on one and switches back to Month. After one month
click it snaps to the 1st and behaves, which is exactly why this survives casual
use. The Prev case is worse than the skip: from March 31 the ← button changes
`navKey`, plays the slide animation, and lands back on March — a button that
visibly animates and does nothing.

**What I tried to kill it with:** looked for a normalisation upstream (there is
none — `setCurrentDate(localDate(d))` at `:178` is the only writer); checked
whether `currentDate` is ever pre-snapped to the 1st on mount (it is not);
checked `git log -L 171,179` — unchanged since `a526650 Initial commit`, so it is
an original defect, not a regression someone reasoned about.

**Fix (one line):** `if (view === 'month') { d.setDate(1); d.setMonth(d.getMonth()+dir) }`
**Effort:** minutes.

---

## 2. Five fetch call sites, zero `AbortController` — fast navigation blanks the grid

**Verdict: defect, and the codebase already knows the pattern.**
`:129-159` (`fetchScores`, `fetchSummary`, `fetchData`) · **severity: medium** ·
**verified by reading** · **defect**

`fetchScores` (`:144-159`) fires two unabortable requests and unconditionally
`setScores(await res.json())` / `setNotes(...)`, replacing the whole map. It is
re-created on every `[currentDate, view]` change and run by the effect at
`:161-164`. Click ← or → twice quickly and two `/api/scores` requests are in
flight for different months; if the first resolves last, the state holds the
**previous** month's map. Because lookups are by date string, October's cells
then find nothing and every score hairline and note dot disappears — and stays
gone until the user navigates again. Not wrong numbers; a stuck-empty grid.

The same file's toggles make it worse: `toggleTask`/`toggleHabit` end with
`fetchData(); fetchScores(); fetchSummary()` un-awaited (`:206`, `:221`, and in
seven more helpers), so two quick check-offs put six unordered responses in
flight over the same three state atoms.

`Shell.tsx:146` carries the comment *"AbortController per fetch so an older
in-flight request can't overwrite newer data"* and implements it;
`bevel/shared.tsx:55` does the same for its range picker. CalendarView — the
view with the most range-changing controls in the app — has neither.

**What I tried to kill it with:** checked for a request-id/epoch guard (none);
checked whether `scores` is merged rather than replaced (it is replaced, `:157`);
checked whether navigation is debounced or the buttons disabled while loading
(they are not — `loading` is only used for the initial mount, `:280`).

**Fix (one line):** give `fetchScores` an `inflight = useRef<AbortController>()`
that aborts the previous request, as `Shell.tsx:150-153` already does.
**Effort:** ~1h including the toggle refetch path.

---

## 3. Nine mutation helpers ignore the response and toast success anyway

**Verdict: defect. One of them can silently destroy a recurring occurrence.**
`:226-278` · **severity: medium** · **verified by reading** · **defect**

`saveNote` `:226`, `addTask` `:234`, `skipTask` `:240`, `deleteTask` `:246`,
`deleteHabit` `:252`, `skipHabit` `:258`, `updateTask` `:264`,
`replaceRecurringDay` `:269`, `updateHabit` `:275` — none checks `res.ok`, none
has a `catch`. `deleteTask` fires `toast('Task deleted', 'warning')` on a 500 and
the row reappears on the refetch a moment later. Only `toggleTask`/`toggleHabit`
(`:204`, `:219`) do it properly, so the pattern exists in the same file and was
simply not applied to the rest.

The sharp one is `replaceRecurringDay` (`:269-273`) — the "edit just this day"
path:

```js
await fetch('/api/task-skips', { … })          // 1. excuse this occurrence
await fetch('/api/tasks', { … dueDate: date }) // 2. create the replacement
```

Two unchecked writes, no transaction, no rollback. If step 2 fails (or the tab
is closed between them) the occurrence is permanently skipped with nothing put
in its place, and the UI reports nothing. This is the only place in the file that
performs a destructive step before a creative one.

**What I tried to kill it with:** checked whether `/api/tasks` POST could reject
the payload it is handed — it accepts `title, description, dueDate, time,
endTime, kind` (`api/tasks/route.ts:21`) and only 400s on a blank title, which
the form already prevents (`:790` `disabled={!title.trim()}`). So the *common*
path is safe; the failure mode is network/500, not a schema mismatch. Also
noted: the replacement does not carry `weight`, so replacing a weight-3
occurrence silently rewrites that day's denominator to weight 1.

**Fix (one line):** wrap the nine in the `if (!res.ok) throw` + `catch → toast`
shape `toggleTask` already uses, and reverse `replaceRecurringDay`'s order
(create, then skip).
**Effort:** ~1h.

---

## 4. Every aggregate card goes blank on the first day of its own period, and "Week" is mislabelled

**Verdict: defect (label) + deliberate-but-unhandled edge (blank).**
`:119-127` and `:319-322` · **severity: medium-low** · **verified by execution** ·
**half defect, half taste**

The n-1 rule at `:124` ends every window at `yesterday`. On the first day of a
period, `start > end`, `aggregatePct` matches nothing, returns `null`, and the
card renders `—`:

```
2026-08-09 (Sunday)  week window 2026-08-09 -> 2026-08-08   EMPTY
2026-08-01           month window 2026-08-01 -> 2026-07-31   EMPTY
2026-01-01           year window  2026-01-01 -> 2025-12-31   EMPTY
```

So **Week reads `—` all day every Sunday** (1 day in 7 — including 2026-08-09,
the day of the last big session), **Month reads `—` all day on the 1st**, and
**Year reads `—` on Jan 1**. Three of the four hero stats, dark on a schedule.

Separately, `:320` labels the Week card **`sub="rolling 7d avg"`**. It is not
rolling and it is not 7 days: it is `startOfWeek(today)` → `yesterday`, i.e. 0–6
days. On a Monday that card shows **Sunday's single score** captioned "rolling
7d avg". The label predates the n-1 change (`git log -L 318,323` — the sub
strings come from `2dce5ba`/`a526650`; the n-1 windows from `1e97be7 ux: … n-1
aggregates`), so this is drift, not a decision.

**What I tried to kill it with:** confirmed `/api/scores` omits zero-total days
(`route.ts:85`) so the blank is genuinely the window and not missing data;
confirmed `aggregatePct`'s `total === 0 → null` is the *correct* guard against
divide-by-zero and should not be changed. This is not Rejected #2 — that was
about future dates at the far end of the window.

**Fix (one line):** fall back to today's own window when `start > end`
(`const end = yesterday < start ? t : yesterday`), and change the Week sub to
`"week to date"`.
**Effort:** ~30 min.

---

## 5. `NoteEditor` reverts characters typed during its own save round-trip

**Verdict: defect, narrow window, real data loss when hit.**
`:1014-1042` (esp. `:1020`) with `saveNote` `:226-232` · **severity: low-medium**
· **reasoned from the code path, not observed** · **defect**

`useEffect(() => { setValue(note); savedValue.current = note }, [note])` at
`:1020` re-syncs the textarea from the prop. The prop is `notes[date]`, which
`saveNote` updates **after** its `await` (`:227-231`). Sequence:

1. type `hello`, pause 800 ms → `doSave('hello')` starts.
2. during the round trip, type ` world` → `value = 'hello world'`, new timer armed.
3. POST resolves → parent `setNotes` → prop becomes `'hello'` → effect fires →
   **textarea snaps back to `hello`**, caret to the end.
4. the user keeps typing on the reverted text; 800 ms later the stale timer
   fires with its captured `'hello world'` and overwrites whatever they wrote.

Reachable only when typing resumes inside the round trip after an 800 ms pause —
uncommon, not exotic. Also missing, against the rule in `CLAUDE.md`: no
`AbortController` and **no unmount `keepalive` flush**, while its structural twin
`Scratchpad.tsx:168-182` has exactly that flush with a comment explaining why.
`ProjectsView.tsx:179-218` has both. `NoteEditor` has neither.

**What I tried to kill it with:** checked whether closing the modal loses a
pending note — it does not; the ✕ button steals focus, `handleBlur` (`:1039`)
fires first and flushes. Checked whether the un-cleared 800 ms timer leaks a
write after unmount — it fires, but `onSave` belongs to the still-mounted parent,
so the write lands. The clobber is the only live consequence.

**Fix (one line):** guard the sync effect with
`if (note !== savedValue.current) { setValue(note); savedValue.current = note }`
— or drop the effect and key the editor on `date`.
**Effort:** ~30 min (plus ~15 min to copy Scratchpad's keepalive flush).

---

## Also noticed — not worth a slot

- **`getMonthDays` always emits 42 cells** (`:60`). February 2026 starts on a
  Sunday with 28 days, so the grid renders **14 trailing March cells — two
  entire greyed-out rows**. Verified: `Feb 2026 → first=2026-02-01
  last=2026-03-14, trailing=14`. Cosmetic, but a third of the grid is filler.
- **Adjacent-month cells never get data.** `fetchScores` requests only the 1st→
  last of the current month (`:148-149`) while the grid shows 5–14 neighbouring
  days, so those cells have no score hairline and no note dot even when the data
  exists. Consistent, just silently incomplete.
- **Delete has no scope choice.** Editing a recurring task carefully offers "All
  occurrences / Just Aug 5" (`:899-919`); deleting one kills the whole series
  with a confirm that says only *"Permanently delete `<title>`?"* — while the
  habit confirm does spell out *"All completion history will be removed."*
  Asymmetric. Taste.
- **Hover popover position is frozen at `mouseenter`.** `getBoundingClientRect()`
  is captured into state (`:461`) and rendered `fixed` (`:551`); scrolling with
  the pointer held still leaves it behind. `pointer-events-none` limits the
  damage.
- `:447` `new Date(date + 'T12:00:00').getDate()` re-parses a string it could
  slice; 42 parses per month render, plus ~365 in `YearSpine`'s `addDays` loop
  (`:369-372`) on every score change.
