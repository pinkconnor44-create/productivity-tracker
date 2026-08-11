# 08 — Deleting a habit rewrites all of its history

**Severity** risk · **Effort** ~1h · **Approved** 2026-08-10
**Source** run-3 finding 7 · evidence `../overnight/audits/012-habitsview.md`

## Change

Add `deletedAt DateTime?` to `model Habit` (hand-written `ALTER TABLE` — `db:push`
only emits `CREATE TABLE`), set it on `DELETE /api/habits/[id]`, and date-gate it
in `/api/scores` the way `Task` is gated at `:63-64`.

## Where

`prisma/schema.prisma`, `src/app/api/habits/[id]/route.ts`,
`src/app/api/scores/route.ts:39`

## Why

`DELETE /api/habits/[id]` sets `active:false`; `/api/scores:39` filters
`active:true` with **no date gate**. So deleting a habit today retroactively
removes it from every past day's denominator. `Task` already does this correctly
via `deletedAt` — **`model Habit` has no `deletedAt` column at all**, so the
correct behaviour is currently unrepresentable.

Live data: 12 deleted habits hold **59 orphaned completions**; ~50 days shifted,
worst case ±14 points.

## Verify

Delete a habit, then confirm a past day's percentage is unchanged and today's
denominator drops by one.
