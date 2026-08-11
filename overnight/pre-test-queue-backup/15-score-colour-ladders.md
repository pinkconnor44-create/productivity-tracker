# 15 — Four score-colour ladders on identical thresholds, already drifted

**Severity** risk · **Effort** ~2h · **Approved** 2026-08-10
**Source** run-3 finding 16 · evidence `../overnight/audits/016-ui-primitives.md`,
`../overnight/audits/018-token-drift.md`

## Change

Collapse all four onto `scoreColor`, and have `scoreColor` read
`--success/--warn/--danger/--info` instead of hard-coding their hex equivalents.
Also de-fork `SegmentedControl` and `WeightPicker`.

## Where

`src/components/ui/index.ts:34-39`, `src/components/CalendarView.tsx:72`,
`src/components/StatsView.tsx:101-110`, `src/components/StatsView.tsx:257`

## Why

Drift is proven at three co-rendered pairs — `StatsView.tsx:256` and `:257` are
**adjacent StatCards in one grid** showing `#4ade80` and `#10b981`; `:287` and `:330`
paint a 60% day two different ways on one page.

`globals.css:64-68` declares `--success/--warn/--danger/--info` with **zero
consumers** while `scoreColor` hard-codes their hex equivalents as literals.

Also forked: `SegmentedControl` at `CalendarView.tsx:295-307` (drops
`role="tablist"`, `role="tab"`, `aria-selected`) and `WeightPicker` across
`TasksView`/`HabitsView`, already drifted downstream.

## Verify

Grep returns one threshold ladder. The two adjacent StatCards render the same green.
