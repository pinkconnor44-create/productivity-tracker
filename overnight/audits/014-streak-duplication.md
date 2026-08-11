# 014 — Two streak walks, two different numbers on the same screen

**Verdict: they already disagree. Right now, on live data, the sidebar says
`🔥 47d` and the Stats tab says `Current streak 22d`.**

- **Severity:** `bug` — not cleanup, not taste. Two visible numbers, same
  quantity, same moment, both wrong-looking.
- **Copies:** `src/components/Shell.tsx:80` (`calcStreak`) ·
  `src/components/StatsView.tsx:23` (`calcCurrentStreak`)
- **Status:** **verified** — recomputed `/api/scores` offline against the live
  Turso DB (read-only `SELECT`) and ran both walks on the result.
- **Defect or taste:** defect. The starting conditions are byte-identical; the
  loop bodies are not.
- **Effort:** ~45 min (one shared helper + one decision about semantics).

## The numbers

Recomputed `/api/scores` from the real `Task`/`Habit`/`*Completion`/`*Skip`
tables for 2026-08-10, then ran each function verbatim:

    today               = 2026-08-10
    tasks/habits        = 283 / 7

    Shell  calcStreak        = 47
    Stats  calcCurrentStreak = 22
    Stats  calcLongestStreak = 26

    --- both walks fed the IDENTICAL scores object (365d) ---
    Shell walk  = 47
    Stats walk  = 22

    days where the two components' score objects differ over the shared
    window = 0

Same input, different output. It is the code, not the fetch.

Note the third number: Shell claims a **47-day current** streak while Stats
claims the **longest streak ever recorded is 26**. Both are on screen together —
the desktop sidebar is `sticky` and `TodayWidget` (`Shell.tsx:262`) renders on
every tab including Stats; on mobile the same value sits in the sticky header
chip (`Shell.tsx:322`). The user does not have to navigate to see the
contradiction.

## Line-by-line

| | `Shell.tsx:80` | `StatsView.tsx:23` |
|---|---|---|
| Start | `scores[t]?.completed > 0 ? t : addDays(t,-1)` | **identical** |
| Loop cap | `i < 400` | `i < 400` (Shell's budget is also consumed by gap days) |
| Threshold | `completed > 0` | `completed > 0` — **agree** |
| Zero-completed day | `break` | `break` — **agree** |
| Weight | reads `completed`, the weighted sum from `/api/scores`; `> 0` is weight-insensitive either way — **agree** | same |
| **Absent day (`!s`)** | **`emptyRun++`, continue; break only after 8 consecutive absences** | **`break` immediately** |
| Fetch window | `?startDate=${YYYY}-01-01` (`Shell.tsx:155`) — **year to date** | `addDays(today,-364)` (`StatsView.tsx:175`) — **trailing 365** |

Two divergences, one live and one latent.

### 1. Gap handling — this is what produces 47 vs 22 today

`/api/scores/route.ts:85` writes a key only `if (total > 0)`, so a day with
nothing scheduled is **absent**, not zero. Seven such days exist in the live
data between the first scored day (2026-04-13) and today:

    2026-04-17 2026-04-18 2026-04-19 2026-07-15 2026-07-17 2026-07-18 2026-07-19

Stats hits 2026-07-19, sees `undefined`, breaks → **22** (2026-08-10 back to
2026-07-20). Shell steps over the 1-day and 3-day gaps — neither run exceeds 7 —
and walks back to 2026-06-21, the day after the last `completed === 0` day
(2026-06-20), counting 51 calendar days minus the 4 absent ones → **47**.

Gap days are also *reachable on demand*, not just historical: the skip check in
`/api/scores` sits **before** `total += w`, so excusing every scheduled item for
a day drives `total` to 0 and deletes the day from the object. There are already
14 `TaskSkip` and 133 `HabitSkip` rows.

### 2. Window — latent, fires every January

Shell fetches from **Jan 1 of the current year**. On 2027-01-03 its walk runs
out of data after three days and its `emptyRun > 7` guard terminates it, so the
header can never show more than the year-to-date length while Stats keeps
counting across the boundary. Not visible today (first scored day 2026-04-13 is
inside both windows — `Shell walk` returns 47 on either window, confirmed
above), so this one is **reasoned, not verified**.

## Which one is right

Shell's. A day with nothing scheduled is not a failed day, and
`HabitsView.tsx:50` already encodes exactly that intent for skips — *"excused —
don't break streak"*. Stats is the outlier, and `calcLongestStreak`
(`StatsView.tsx:35`) shares its gap-breaking rule via `d === addDays(prev,1)`,
so **fixing only `calcCurrentStreak` leaves "current 47d, longest 26d"**. Both
Stats functions have to move together.

Shell's `emptyRun > 7` is itself arbitrary — an 8-day holiday silently ends the
streak while a 7-day one does not. Worth replacing with "stop at the first day
before any data exists" while the logic is being moved.

## What I tried to kill it with

- **"They're fed different data."** No — recomputed both fetch windows; the two
  score objects differ on **0** days over their shared range, and feeding the
  *identical* object to both walks still gives 47 and 22.
- **"The threshold differs, so one is stricter on purpose."** No — both use
  `completed > 0`. 2026-08-08 scored 1/12 (8%) and counts as a streak day in
  both. That is a shared quirk, not a disagreement.
- **"Weight makes them differ."** No — both read the same weighted `completed`
  and only test `> 0`.
- **"Shell's number isn't visible next to Stats'."** No — sticky sidebar and
  sticky mobile header both render on the Stats tab.
- **"`tsc` would have caught it."** It cannot. `tsconfig.json` has `strict: true`
  but not `noUncheckedIndexedAccess`, so `scores[t]` is typed `DayScore`, the
  `?.` in `scores[t]?.completed > 0` is invisible to the type system, and the
  comparison compiles. The whole gap case is untypeable here.

## Fix

Extract one `calcStreak(scores, today)` into `src/lib/streak.ts` with the
gap-tolerant rule, import it in `Shell.tsx` and `StatsView.tsx`, make
`calcLongestStreak` skip absent days by the same rule, and align Shell's fetch
to the trailing 365 days.
