# 011 — `TasksView.tsx` holds every rule it is subject to, does **not** duplicate the recurrence engine, and loses writes on a double-tap

**Verdict on the two questions asked:**

1. **Rules: all five hold, two vacuously.** No violation found. Details in the
   audit table below.
2. **Recurrence: no duplication.** `TasksView.tsx:3` imports
   `isTaskActiveOnDate` and `recurringLabel` from `@/lib/recurring` and uses
   them at `:216`, `:279`, `:353`. There is **no local copy of the pattern
   matcher, the start-date fallback, or the `recurringEnd` check**. It cannot
   drift from `/api/scores`, which imports the same functions. The premise of
   the item is not borne out.

The file is not clean, though — the real defects are elsewhere and none of them
are the ones the item predicted.

**Gate:** `npx tsc --noEmit` → **exit 0, 0 errors**. Not driven in a browser
(read-only; the DB is shared with production).

---

## Rule audit — the five rules, against 669 lines

| Rule | Status | Evidence |
|---|---|---|
| Optimistic writes use functional updaters | **N/A — there are no optimistic writes.** Every one of the six mutations does `await fetch` → `fetchTasks()`. The three `setState` calls that *are* functional (`:147`, `:150`, `:515`) are form state and correctly written. | see finding 3 |
| Every delete through `useConfirm()` | **Holds, 3/3.** `TaskRow:405`, `RecurringRowActions:460`, `SimpleRowActions:479`. No `window.confirm`, no inline `setConfirming`. | grep: the only `window.confirm` in `src/` is the provider-missing fallback at `ui/ConfirmDialog.tsx:24`, unreachable — `ConfirmProvider` is mounted at the root in `app/layout.tsx:47` |
| `hover:` never gates a primary action | **Holds, 3/3.** `:446`, `:470`, `:489` all carry the exact string `opacity-100 sm:opacity-0 sm:group-hover:opacity-100`. `:246` uses `group-hover:` for colour only, on a control that is always visible. | repo-wide grep for `sm:opacity-0` **not** preceded by `opacity-100` → **zero hits** |
| Outside-click needs `mousedown` + `touchstart` | **N/A.** No dropdown, popover or outside-click handler in the file. | |
| Portal `fixed` out of transformed ancestors | **N/A, and covered.** Nothing in the file is `position: fixed`. The delete dialog it opens portals to `document.body` (`ui/ConfirmDialog.tsx:66,101`), so it escapes `.tab-fade`'s `transform` (`globals.css:158-164`). | |

Git history says two of these were deliberate work, not luck: `a041334`
*"delete UX: shared confirm dialog"* and `fafe08a` *"mobile: … action
visibility"*. Last touched `66f27fa`, 2026-08-06.

---

## 1. The three toggle handlers have no re-entrancy guard, and both endpoints are non-idempotent toggles — `bug` · ~30 min · verified by reading

`TasksView.tsx:170` `toggleTask` · `:179` `toggleRecurringToday` · `:197`
`skipTask`.

`POST /api/task-completions` and `POST /api/task-skips` are **toggles**, not
setters — each does `findUnique` → `delete` if present, `create` if not
(`api/task-completions/route.ts:14-23`, `api/task-skips/route.ts:8-13`). Sending
the same request twice is a no-op *at best*.

TasksView has nothing to stop that. The checkbox at `:265` is `disabled` only
when the task is skipped; there is no in-flight state, no spinner, and — because
there is no optimistic update (finding 3) — **the checkbox does not change
appearance until the round trip to Turso and the follow-up `GET /api/tasks` both
complete.** A user who taps and sees nothing happen taps again.

Two outcomes, both wrong:

- **Serialised** (taps ~300 ms apart): create, then delete. Net zero. The first
  response fires `toast('Task complete ✓')` at `:184`, so the user is told the
  task is complete and it is not. Nothing else on screen contradicts it.
- **Concurrent** (double-tap): both handlers `findUnique` and find nothing, both
  `create`, the second violates `@@unique([taskId, date])`
  (`prisma/schema.prisma:38`, `:47`) → 500 → `toast('Failed to update task')`.

**`CalendarView.tsx:193-195` and `:208` already implement the guard** — a
`togglingIds` Set keyed `${type}-${id}-${date}`, checked on entry, cleared in a
finally-equivalent — for the *same two endpoints*. TasksView is the copy that
did not get it. This is the app's primary tab and the interaction is a phone
user ticking a checkbox, which is the whole product.

**What I tried to kill it with:**
- *"React batches the two clicks."* It does not — separate user events, separate
  handler invocations, separate `fetch` calls.
- *"The refetch will correct the display."* It corrects the *display*; it does
  not un-write the second toggle. The DB ends in the wrong state and the score
  follows it.
- *"Too fast to hit in practice."* The guard exists in CalendarView, which
  suggests it was hit there. And latency here is a Turso round trip **plus** a
  full unfiltered `GET /api/tasks` before any pixel moves.

**Fix, one line:** lift `CalendarView`'s `togglingIds` guard into TasksView (or
better, make the two endpoints idempotent with an explicit
`{ completed: boolean }` body + `upsert`/`deleteMany`, which fixes both callers).

## 2. Four of the six mutations never dispatch `score-refresh`, so the header score silently lags — `risk` · ~15 min · verified

`TasksView.tsx:176` and `:186` dispatch `score-refresh`.
**`deleteTask` (`:189`), `skipTask` (`:197`), `createTask` (`:152`) and
`saveTask` (`:205`) do not** — and all four change today's score:

| Operation | How `/api/scores` sees it |
|---|---|
| skip | `route.ts:65` `if (task.skips.some(s => s.date === date)) continue` — drops the task from the denominator, score jumps **up** |
| delete | `:63` `if (!task.active && task.deletedAt && date >= task.deletedAt) continue` — same, from today onward |
| create | a task due today, or recurring and active today, adds `weight` to the denominator — score drops |
| save | edits `weight`, `dueDate` or the recurring rule → denominator changes |

`Shell.tsx:148-166` listens for the event and refetches; `Shell.tsx:167-169` also
dispatches on every `activeTab` change. So the stale header **self-corrects the
moment you leave the tab and come back**, which is exactly why this has never
been noticed — and exactly why it is worth fixing rather than trusting.
`CalendarView` calls `fetchScores()` after all six of its equivalents
(`:206,:221,:237,:243,:249,:266`). TasksView is again the inconsistent copy.

**Defect or taste:** defect. Excusing a task is the one action whose entire
purpose is to move the score, and it is one of the four that doesn't.

**Fix, one line:** hoist the dispatch into `fetchTasks` (`:139`) so every caller
gets it, and delete the two explicit calls.

## 3. Every mutation triggers a full unfiltered refetch with no abort and no ordering guard — `risk` · hours · verified

`fetchTasks` (`:139-143`) is `fetch('/api/tasks')` → `setTasks(await res.json())`
with **no `AbortController`, no sequence token, no mounted check**. It is called
from all six mutation handlers (`:166,:175,:185,:194,:202,:209`). Two overlapping
mutations produce two overlapping refetches, and **the response that lands last
wins regardless of which was issued last** — tick a box and hit delete on another
row and the render can be either state.

`Shell.tsx:150-158` implements precisely the prescribed pattern
(`inflight?.abort()`, per-fetch `AbortController`, `if (!ctrl.signal.aborted)`)
with a comment explaining why. TasksView is 200 lines away from a working
reference and does not use it.

The payload is also unbounded: `api/tasks/route.ts:9` is
`include: { completions: true, skips: true }` with **no date filter**, so every
completion row ever recorded for every recurring task ships on every refetch —
after every checkbox tick. At the live 3 recurring tasks that is ~270 rows today
and grows ~3/day forever, with no cap.

This is where `CLAUDE.md`'s optimistic-write rule *would* apply and currently has
nothing to bind to. It is not a rule violation — the rule is conditional — but
the app's busiest tab is the one place the pattern is absent.

**Fix, one line:** give `fetchTasks` the `Shell.tsx:150` AbortController pattern;
separately, add optimistic local state to the two toggles (which also kills
finding 1).

## 4. `skipTask` toasts "Skipped for today" when you are *un*-skipping — `cleanup` · minutes · verified

`TasksView.tsx:197-204`. The endpoint toggles and returns `{ skipped: false }`
on removal (`api/task-skips/route.ts:11`); TasksView discards the response and
unconditionally toasts `'Skipped for today'`. The button that calls it knows
better — its own `title` is `skipped ? 'Undo excuse' : 'Excuse for today'`
(`:448`, `:471`). Un-excusing a task tells you it was excused.

`CalendarView.tsx:242` has the identical bug; fix both together.

**Fix, one line:** `const { skipped } = await res.json()` and branch the toast.

## 5. `recurringType` reaches the DB as an unvalidated free string, while `kind` and `weight` beside it are validated — `risk` · ~30 min · verified

`TasksView.tsx:18-23` defines a local `RECURRING_TYPES` array. `Task.recurringType`
is typed `string` (`:11`). The exported union
`RecurringType` (`lib/recurring.ts:1`) is imported by **nobody** — grep across
`src/` and `prisma/` returns only its own declaration.

So the valid set is written down four times (the union, `matchesPattern`'s switch
at `recurring.ts:50-58`, `RECURRING_TYPES` here, and the schema comment at
`prisma/schema.prisma:20`) and enforced **zero** times. `api/tasks/route.ts:35`
stores `recurringType: recurringType || null` with no check — two lines below
`weight: weight && [1,2,3].includes(weight) ? weight : 1` (`:38`) and
`kind: kind && VALID_KINDS.includes(kind) ? kind : null` (`:39`). Same route,
same object literal, three fields, two validated.

**This is the mechanism that makes brief finding 9 reachable, not a re-raise of
it.** Finding 9 says `matchesPattern`'s silent `default: return false` makes an
unknown type vanish from every day; this is the answer to "how would an unknown
type ever get in". The one-line server-side guard is cheaper than implementing
`monthly`, and closes the hole from the other end.

**Fix, one line:** add `const VALID_RECURRING = [...] as const` next to
`VALID_KINDS` and filter `recurringType` through it in POST and PATCH; type the
component's `Task.recurringType` as `RecurringType | null`.

---

## Checked and deliberately not raised

- **The DELETE `?date=` parameter** (`:191`) — `## Rejected` #3. Confirmed still
  passing an explicit local date.
- **`completedAt` unused in this file** (`:11`, declared and never read) —
  that is brief finding 8, which already established there is no consumer
  anywhere. TasksView is one of the "carries it in its type" sites named there.
- **`groupTasks` (`:86-101`) classifies non-recurring tasks by `dueDate` and
  keeps overdue ones visible today, while `isTaskActiveOnDate` says a
  non-recurring task is active only on `dueDate === date`.** This looks like a
  divergence and is not one: carrying overdue work forward in a list is correct
  product behaviour, and the scoring consequence is already brief finding 8.
- **`parseTimeInput` (`:52-67`)** — traced `9a / 930p / 14 / 230 / 9:30am /
  12am / 12p / 0930p / 9m`, all correct. The `&& !s.endsWith('mp')` guard in
  `isPM` is dead (any such input fails the digit test anyway). Nit, not raised.
- **A backslashed URL in `CalendarView.tsx:235`** — a Grep-tool display artifact.
  `cat -A` shows `/api/tasks` with forward slashes. Killed.

## Also noticed

- `today()` is redeclared in **7** files (`api/health:25`, `CalendarView:32`,
  `HabitsView:25`, `LiftTracker:21`, `StatsView:8`, `TasksView:30`,
  `ui/TrendChart:9`) and `addDays()` in **9** (add `api/scores:5`,
  `Shell:76`, and `bevel/shared.tsx:14` — which already **exports** one that
  nobody imports). TasksView carries copies at `:30` and `:34`. Cheap to
  consolidate into `lib/date.ts`, and it is the same class of drift that
  produced brief finding 7's three "today" helpers.
- `TaskRow` passes `onSkip` only when `key === 'today'` (`:307`), so an
  **overdue** task cannot be excused from this view. Taste, possibly deliberate.
- `todayStr` is computed once per render (`:213`) with nothing forcing a
  re-render at midnight. An installed PWA left open overnight shows yesterday's
  "Recurring · Today" until the user interacts. App-wide, not TasksView-specific.
