# 03 — One shared, gap-tolerant `calcStreak`

**Severity** bug · **Effort** ~45min · **Approved** 2026-08-10
**Source** run-3 finding 3 · evidence `../overnight/audits/014-streak-duplication.md`

## Change

Extract one gap-tolerant streak walk into `src/lib/streak.ts` and call it from both
sites. Decide **once** what an absent day means and encode it there.

## Where

`src/components/Shell.tsx:82` and `src/components/StatsView.tsx:25`

## Why

`/api/scores` was recomputed offline from the real tables and both walks run on
identical input:

```
Shell  calcStreak        = 47
Stats  calcCurrentStreak = 22   (longest 26)
days where the two score objects differ = 0
```

Both render simultaneously — the sidebar `TodayWidget` and the mobile header chip
appear on every tab **including Stats**. The user sees a current streak of 47
beside a longest-ever of 26.

Cause: `/api/scores:85` only writes a key when `total > 0`, so unscheduled days are
*absent*, not zero. `Shell.tsx:80` steps over absences (breaking after 8);
`StatsView.tsx:23` treats absence as a break. Seven real gap days exist
(2026-04-17/18/19, 2026-07-15/17/18/19), and 14 `TaskSkip` + 133 `HabitSkip` rows
make more reachable on demand.

`tsc` cannot catch this — `noUncheckedIndexedAccess` is off, so `scores[t]` types
as present.

## Verify

Sidebar current streak ≤ Stats longest streak on the same screen, and both numbers
come from one function.
