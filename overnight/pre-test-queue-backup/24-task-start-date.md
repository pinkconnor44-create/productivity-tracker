# 24 — `Task` never got the `startDate` fix `Habit` has

**Severity** risk · **Effort** ~45min · **Approved** 2026-08-10
**Source** the run-3 review action item (carried from runs 1–2)

## Change

Add `startDate` to `model Task` (hand-written `ALTER TABLE`) and cap task completion
windows to it, matching `Habit`.

## Where

`prisma/schema.prisma` — `model Task`; the completion-window maths in
`src/app/api/scores/route.ts` and `TasksView`

## Why

`CLAUDE.md` requires completion windows to cap denominators to **the item's start
date**. `Habit` has `startDate`; `Task` does not, so task windows fall back to
`createdAt`, whose UTC day is the wrong boundary for an evening-created task.

**0 rows are affected today** — this is a latent boundary, not a live miscount, which
is why it sits below the bugs.

Related: 12 habits have NULL `startDate`, of which **9 are soft-deleted** (an agent
corrected the run-3 enumeration on this). Item 08 covers the deleted ones.

## Verify

Create a task after 19:00 local; its completion window starts that same local day.
