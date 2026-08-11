# 10 — CalendarView's refetch has no `AbortController`

**Severity** risk · **Effort** ~30min · **Approved** 2026-08-10
**Source** run-3 finding 9 · evidence `../overnight/audits/007-abortcontroller.md`,
`../overnight/audits/008-effect-cleanup.md`

## Change

Add the abort-and-key-check guard already implemented at `Shell.tsx:146` and
`bevel/shared.tsx:58` — both carry a comment explaining this exact hazard.

## Where

`src/components/CalendarView.tsx:144-164` (the effect at `:161`)

## Why

`fetchScores` is keyed on `(currentDate, view)` and re-runs on every month/week/day
arrow. The effect has **no cleanup, no signal, no key check**. Both `/api/scores`
and `/api/notes` filter to the requested range, so a late response *replaces*
state: a stale August payload leaves every June cell `undefined`, i.e. a
populated-looking month reporting **0% everywhere** — and it does not self-heal.

Two agents reached this independently from different starting points. Calendar is
the heaviest navigator in the app and the only one of the three without the guard.

## Verify

Throttle to Slow 3G, arrow forward four months quickly — the rendered month matches
the header and shows real percentages.
