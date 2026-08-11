# 012 — `HabitsView.tsx`: the completion windows cap correctly on the *wrong* start, and every percentage on the page counts excused days as failures

**Verdict on the two questions asked:**

1. **Denominators: no.** `countInWindow` (`:57-72`) implements the `CLAUDE.md`
   cap, but the page feeds it **three different start dates for the same habit**
   (`startDate` at `:232`, `createdAt` UTC at `:393` and `:488`, nothing at all
   inside `calcStreak`), and **none of the four percentage sites subtract
   excused days**, which the app's own scorer and this same file's streak walk
   both do. Live: the *30-day rate* card reads **65 % (119/183)**; the same 30
   days with excused days removed is **83 % (118/143)**.
2. **Rules: four hold, one is N/A, and the one the item asked about is not
   violated.** `isHabitActiveOnDate` is **imported** (`:3`) and used at `:48`,
   `:65`, `:93`, `:219`, `:220` — there is no local copy of the pattern matcher
   or the start-date fallback. `recurringLabel`, however, *is* re-implemented
   (`scheduleLabel`, `:33-38`).

**Gate:** `npx tsc --noEmit` → **exit 0, no output.** DB read read-only
(`SELECT` only, `@libsql/client`, `.env` credentials). Nothing changed, nothing
written to Turso.

**Live shape of the data** (2026-08-10): 19 `Habit` rows, **7 active** — the
only ones this view ever renders (`api/habits/route.ts:7` `where:{active:true}`).
3 of those 7 have `startDate = NULL` (ids 7, 8, 9). The brief's "12 of 19" is
correct for the table; **9 of those 12 are soft-deleted and never fetched**, so
the NULL-`startDate` population actually on screen is 3.

---

## 1. Excused days are counted as misses in every percentage this view renders — `risk` (boundary `bug`) · ~1 h · **verified against live data**

`HabitsView.tsx:57-72` — `countInWindow` **takes no `skips` argument at all**.
Same for `getWeeklyData` (`:79-110`), `doneToday` (`:229`) and
`activeToday.length` (`:242`, `:246`).

The same file, 7 lines above, says the opposite:

```js
// :50
else if (skipDates.has(check)) { check = addDays(check, -1) } // excused — don't break streak
```

and so does the app's scorer:

```js
// api/scores/route.ts:78
if (habit.skips.some(s => s.date === date)) continue // excused for this day
```

Two explicit statements of intent in the codebase, and the four numbers the user
actually looks at ignore both. Excusing a habit is the one action whose entire
purpose is to remove a day from the denominator; here it removes nothing.

**Recomputed from the live tables, window 2026-07-12 → 2026-08-09:**

    30-day rate as shipped        119/183 = 65 %
    30-day rate, excused removed  118/143 = 83 %      (18-point error)
    excused days on active habits inside the window: 40
    HabitSkip rows total: 133

Per-row badges carry the same error — the `mo` chip at `:426`:

    id name          shipped   correct
    7  Diet           21/29     20/22
    8  Supplements    20/29     20/23
    9  Pimsluer       16/29     16/23
    13 Gym            16/24     16/17
    14 SN             15/29     15/21
    18 Hair           19/29     19/23

`doneToday`/`activeToday.length` has a second consequence: a skipped habit stays
in the denominator while its checkbox is `disabled` (`:403`), so **once anything
is excused, `doneToday === activeToday.length` at `:246` is unreachable** — the
header reads "2/3 done today" all day and the green StatCard can never fire.
Not visible on 2026-08-10 (latest skip is 2026-07-23), but it is the same bug.

**What I tried to kill it with**
- *"Skipped rows hide their badges."* Only for **today** — `:414` swaps the chips
  for the "Excused today" pill on the current day. Every *past* excused day is
  still inside the 7/30/all denominators.
- *"The card is a different quantity from the score on purpose."* Then the
  in-page explainer at `:364-365` — *"Your score is the % of weighted points
  earned vs. scheduled"* — describes a number the page does not compute (it is
  also unweighted; see § *Also noticed*). Nothing on screen distinguishes them.
- *"Maybe `/api/habits` already filters skips out of `completions`."* No —
  `route.ts:10-11` returns `completions` and `skips` as separate unfiltered arrays;
  the component receives the skips and never passes them in.

**Fix, one line:** give `countInWindow`/`getWeeklyData` a `skips: Set<string>`
and `continue` before `scheduled++`, exactly as `api/scores/route.ts:78` does;
subtract today's skips from `activeToday` for the header.

## 2. Deleting a habit rewrites every past day's score, and the deletion date is not recorded anywhere — `risk` · ~1 h · **verified against live data**

`HabitsView.tsx:196-203` → `DELETE /api/habits/[id]` (`route.ts:32-35`) is a
**soft delete**: `data: { active: false }`. `api/scores/route.ts:39` then loads
habits with `where: { active: true }` and **no date gate**, so a deleted habit
disappears from every historical day it was ever scheduled on — numerator and
denominator both.

`Task` gets this right, deliberately and with a comment
(`api/scores/route.ts:26`, `:63-64`):

```js
// Include soft-deleted tasks so their historical completions still count
if (!task.active && task.deletedAt && date >= task.deletedAt) continue
```

`prisma/schema.prisma` `model Habit` **has no `deletedAt` column**, so the
correct behaviour is not merely unimplemented — it is currently unrepresentable.

**Live:** 12 soft-deleted habits hold **59 orphaned `HabitCompletion` rows**
(ids 10/18, 17/26, 16/9, 15/5, 12/1) that no view or score can reach, and there
is no UI to reactivate a habit. Under a deliberately conservative counterfactual
(a deleted habit assumed live only from its start through its **last**
completion), **50 days** between 2026-04-13 and 2026-08-09 have a different
habit-side percentage than they did when they were lived: 2026-05-23 was
1/7 = 14 % and is now 0/6 = 0 %; 2026-05-04 was 9/10 = 90 % and is now
9/9 = 100 %. Worst swing ±14 points, mean 0.0, median 0. The true figure is
**unknowable**, which is the point — without `deletedAt` the history cannot be
reconstructed even in principle.

The confirm copy at `:385` — *"All completion history will be removed"* — is
true of the scores and false of the storage.

**What I tried to kill it with**
- *"It's a hard delete, so of course history goes."* It is not; the route
  updates `active`, and the 59 rows are still in the table.
- *"Already covered by brief finding 8."* No — finding 8 is `Task.completedAt`
  and non-recurring task scoring. Nothing in `brief.md`, `HANDOFF.md`, `TRAPS.md`
  or findings 001–017 mentions habit soft-delete or the missing `deletedAt`.
- *"Magnitude is trivial."* Measured, not asserted: ±14 points on 50 days,
  habit-side only. Modest — hence `risk`, not `bug`. The permanence is the cost.

**Fix, one line:** add `deletedAt String?` to `model Habit`, stamp it on DELETE,
and gate `api/scores` on `date >= habit.deletedAt` exactly as the task branch does.

## 3. One habit, three start dates — the badges use the UTC `createdAt` day while the engine uses `startDate` — `risk` · ~30 min · **verified against live data**

| Site | Start it uses |
|---|---|
| `lib/recurring.ts:38` (decides whether the habit is *active*) | `startDate ?? toDateStr(createdAt)` — **local** |
| `HabitsView.tsx:232` (30-day StatCard) | `startDate` only, **no fallback** (§ 4) |
| `HabitsView.tsx:393` (`w7`/`w30`/`all` chips) | `habit.createdAt.slice(0,10)` — **UTC**, `startDate` ignored |
| `HabitsView.tsx:488` (detail chart) | same |
| `HabitsView.tsx:48` (`calcStreak`) | **none** — passes `{ recurringDays }`, stripping both fields |

Two live rows already diverge, because their `startDate` is the day *before*
their UTC `createdAt` day:

    id 13 Gym  startDate 2026-04-13  createdAt 2026-04-14T06:08Z
    id 14 SN   startDate 2026-04-22  createdAt 2026-04-23T09:21Z

2026-04-13 is a Monday and Gym recurs `1,2,3,4,5,6`, so it is scheduled — and
completed. The `all` chip cannot see it:

    Gym  shipped (createdAt) 74/101 = 73 %   engine's start (startDate) 75/102 = 74 %
    SN   shipped (createdAt) 64/109 = 59 %   engine's start (startDate) 64/110 = 58 %

So the recurrence engine counts Gym as active on 2026-04-13, the row badge does
not, and a real completion is dropped from a percentage the user reads.

`.slice(0,10)` is also the wrong operator here, and for the mirror image of the
reason `CLAUDE.md` mandates it in the health path: HAE timestamps are *already
local*, but a Prisma `DateTime` serialises to **UTC ISO**, so `.slice(0,10)` is
the UTC day while `recurring.ts:38`'s `toDateStr` is browser-local. The two
fallbacks disagree for any habit created 19:00–24:00 local (UTC−5). No such row
exists today — every habit was created 01:00–12:00 local — so that half is
**reasoned, not verified**.

**What I tried to kill it with**
- *"`startDate` isn't on the `Habit` type, so `:393` has no choice."* The type
  (`:8-12`) omits it, but the data is there — `/api/habits` returns whole rows,
  and `:232` reaches it with a cast. It is a missing type field, not missing data.
- *"One day out of 101 is noise."* It is the day that separates 73 % from 74 %,
  and it is the *first* day of the habit — exactly the day the `CLAUDE.md` rule
  exists to get right.

**Fix, one line:** add `startDate?: string | null` to the local `Habit` type and
replace both `habit.createdAt.slice(0,10)` sites with
`habit.startDate ?? toDateStr(habit.createdAt)` from `lib/recurring.ts`.

## 4. The 30-day StatCard has no start-date fallback at all, so a new habit with `startDate = NULL` is scored out of days before it existed — `risk`, latent · ~15 min · **verified as unreachable today, by reading + live rows**

`HabitsView.tsx:232`:

```js
countInWindow(h.completions, h.recurringDays, 30, (h as { startDate?: string }).startDate)
```

and `:61`:

```js
const start = habitStart && habitStart > windowStart ? habitStart : windowStart
```

`null` is falsy → `windowStart` → the full 30 days. This is the one call site of
the `CLAUDE.md` rule (*"completion windows cap denominators to the item's start
date"*) that does not implement it — not even the UTC `createdAt` fallback that
`:393` has.

**Affected rows today: 0.** The three active NULL-`startDate` habits (7, 8, 9)
were all created 2026-04-13, 119 days ago, so the 30-day window binds first.
It stays dormant only because the sole creation path in the app sends
`startDate: todayStr` (`:181`) — while `api/habits/route.ts:37` accepts
`startDate: startDate || null` from any caller with no default. A habit created
by a script, an import, or a future client within the last 30 days is scored
against days it did not exist.

Note the `as { startDate?: string }` cast: the local `Habit` type omits the
field, so **TypeScript is checking nothing here** and a schema rename would pass
`tsc` silently. Distinct from brief finding 10, which is about `lib/recurring.ts`
falling back to the UTC `createdAt` — this call site has no fallback whatsoever.

**Fix, one line:** `h.startDate ?? h.createdAt.slice(0,10)` at `:232`, and drop
the cast by putting `startDate` on the type (same fix as § 3).

## 5. The detail modal's only content is a chart that a phone cannot read and a screen reader cannot see — `risk` · ~1 h · verified by reading

`HabitDetailModal` (`:482-517`) renders exactly one thing: `WeeklyCompletionChart`.

- `:548` — the `<svg>` is `aria-hidden="true"` with **no text alternative**
  anywhere in the modal. The whole panel is empty to assistive tech.
- `:566-568` — `done/scheduled/pct` per week appears **only** in a tooltip driven
  by `onMouseEnter` / `onMouseMove` / `onMouseLeave`. None of those fire on
  touch, and the modal is explicitly a phone bottom sheet (`:495`
  `justify-end sm:justify-center`, `:497` `rounded-t-3xl`). On the phone the
  modal shows an unlabelled line and nothing else. `CLAUDE.md`'s *"never gate a
  primary action behind hover"* is about `hover:` classes and so is not
  literally breached, but this is the same failure in JS.
- `:88-90` correctly clamps each week to `[habitStart, yesterday]`, then `:99`
  plots any week with `scheduled > 0` at equal weight — so a habit starting
  mid-week and the truncated current week render as full-week points, and a
  1-day week reads 0 % or 100 %. Today is a **Monday**, so `currentMonday`
  (2026-08-10) > yesterday (2026-08-09) and `:90` skips the current week; on the
  other six weekdays the last point is a partial week drawn as a full one.

**What I tried to kill it with**
- *"The tooltip is `position: fixed` inside `.tab-fade`, which has a
  `transform`."* **Killed** — `globals.css:158-164` is a 0.22 s animation with no
  `forwards` fill, so the transform is gone long before a tooltip can exist. The
  `fixed` modal and the `fixed` tooltip are both fine.
- *"`aria-hidden` is right because a chart is decorative."* It is the sole
  content of a modal the user deliberately opened.

**Fix, one line:** add a `<caption>`-equivalent list or `<title>`/`<desc>` +
`role="img"` with the week figures, and drive the tooltip from
`onPointerDown`/`onPointerMove` instead of the mouse trio.

---

## Rule audit — the five rules the item named

| Rule | Status | Evidence |
|---|---|---|
| Completion windows cap to the item's start date | **Violated at 1 of 4 sites, wrong start at 2 more** | § 1, § 3, § 4 |
| Optimistic writes use functional updaters | **N/A — there are no optimistic writes.** All five mutations (`:176`, `:188`, `:196`, `:204`, `:211`) are `await fetch` → `fetchHabits()`. The four `setState` calls that exist (`:166`, `:169`, `:605`) are form state and **are** functional. | |
| Every delete through `useConfirm()` | **Holds, 2/2.** `HabitRow:381-389`, `AllHabitsRowActions:465-473`. No `window.confirm`, no inline toggle. | |
| Hover reveals touch-safe | **Holds, 2/2.** `:451` and `:475` both carry exactly `opacity-100 sm:opacity-0 sm:group-hover:opacity-100`. | |
| Outside-click `mousedown` + `touchstart` | **N/A.** No document-level handler in the file. The modal closes via a backdrop element `onClick` (`:496`), which touch does synthesise. | |
| Duplicates `isHabitActiveOnDate`? | **No.** Imported at `:3`, used at `:48`, `:65`, `:93`, `:219`, `:220`. No local pattern matcher. | the item's premise is not borne out |

## Checked and deliberately **not** raised

- **The unguarded refetch and the toggle-endpoint escalation** (`:158-163`,
  `:188-195`) — already **findings/007 § 3**, which names these exact lines.
  Confirmed unchanged; `api/habit-completions/route.ts:13-27` is still a toggle.
- **`today()` / `addDays()` duplicated at `:25` and `:29`** — already
  **findings/011 § Also noticed** (7 and 9 copies respectively).
- **`calcStreak` is a third streak walk** — findings/014 covers the Shell/Stats
  pair; this one operates on habit completions, not `/api/scores`, so it is a
  different quantity, not a fourth disagreeing copy.

## Also noticed

- **`skipHabit` (`:204`), `deleteHabit` (`:196`), `createHabit` (`:176`) and
  `saveHabit` (`:211`) never dispatch `score-refresh`; only `toggleToday`
  (`:193`) does.** All four change today's score — excusing removes a habit from
  the denominator (`api/scores:78`), deleting removes it from *all* denominators
  (§ 2). Same shape as findings/011 § 2, in a second file. Fix: hoist the
  dispatch into `fetchHabits`.
- **`calcStreak:48` passes `{ recurringDays }`**, so `isHabitActiveOnDate`'s
  start guard is inert inside the streak. Benign today (no completion predates a
  habit's start), but a `HabitSkip` dated before the start would walk the streak
  backwards to the 400-iteration cap.
- **`api/habits/route.ts:10` caps `completions` at `take: 400`** while `:397`
  asks `countInWindow` for a 10 000-day window — the `all` chip silently
  truncates past 400 completions. Largest today is 100 (habit 8), so ~4 years of
  headroom on a daily habit. `skips: true` (`:11`) is uncapped: 133 rows ship on
  every refetch.
- **`scheduleLabel` (`:33-38`) re-implements `recurringLabel`
  (`lib/recurring.ts:61-73`)** for the `weekly` case. One import removes it.
- **The explainer at `:364-365` describes a weighted score**; `weight` is read
  at `:391` for the border colour and the "Important/Critical" chip only —
  every count and percentage on the page is unweighted.
- **`HabitDetailModal` has no Escape handler and no focus trap**, and locks
  `document.body.style.overflow` (`:483-486`) with no restore on route change.
- `habits.filter` runs twice per render (`:219`, `:220`) and `calcStreak` runs
  once per habit outside any memo (`:230`, `:390`) while `rowStats` beside it
  **is** memoised (`:392`). 7 habits × ~120 iterations — irrelevant today, listed
  only because the inconsistency reads as an oversight.
