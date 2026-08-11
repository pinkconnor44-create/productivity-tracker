# 06 — Re-entrancy guards on the completion toggles

**Severity** bug · **Effort** ~30min · **Approved** 2026-08-10
**Source** run-3 finding 10 · evidence `../overnight/audits/011-tasksview.md`,
`../overnight/audits/007-abortcontroller.md`

## Change

Add the `togglingIds` guard already implemented at `CalendarView.tsx:193-195` to the
TasksView and HabitsView toggles.

## Where

`src/components/TasksView.tsx:170` (also `:179`, `:197`) and
`src/components/HabitsView.tsx:188`

## Why

`/api/task-completions` and `/api/habit-completions` are **toggles** (find →
delete-or-create), so they are not idempotent. With no optimistic UI the checkbox
does not move until a round trip plus a full refetch, so a double-tap either nets
to zero while toasting "Task complete ✓", or races into a `@@unique` violation →
500.

`CalendarView` already guards the same two endpoints — this is a gap, not a
deliberate difference.

Escalation path: the unguarded post-mutation refetch means a stale snapshot can
un-tick a box, and the corrective re-click **deletes the real completion row**.

## Verify

Double-tap a task checkbox on a throttled connection — exactly one request fires,
and the final state matches the toast.
