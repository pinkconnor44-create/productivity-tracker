# 23 — `matchesPattern` swallows an unknown `recurringType`

**Severity** risk · **Effort** ~20min · **Approved** 2026-08-10
**Source** the run-3 review action item (carried from runs 1–2)

## Change

Replace the silent `default: return false` with an exhaustiveness check (`never`
assertion) so a new recurrence type fails at compile time instead of vanishing at
runtime.

## Where

`src/lib/recurring.ts` — `matchesPattern`

## Why

An unrecognised `recurringType` makes the item **inactive on every date**: it
disappears from Tasks, Habits, Calendar and `/api/scores` at once, with no error and
no log line. `recurring.ts` is shared by all four, so it is the highest-blast-radius
file in the app.

`monthly` is the live example — unimplemented, and only harmless because the UI
cannot currently produce it (run 3 rejected it as a standalone finding for that
reason). The silent default is what makes the next one dangerous.

## Verify

Adding a new value to the recurrence union fails `tsc` until it is handled.
