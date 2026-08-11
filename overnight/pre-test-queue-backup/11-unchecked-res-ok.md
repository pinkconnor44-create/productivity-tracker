# 11 — Fourteen mutations ignore `res.ok`; five toast success unconditionally

**Severity** risk · **Effort** ~2h · **Approved** 2026-08-10
**Source** run-3 finding 11 · evidence `../overnight/audits/010-calendarview.md`,
`../overnight/audits/013-lifttracker.md`

## Change

Check `res.ok` on all 14 calls, move every success toast inside the success branch,
give `replaceRecurringDay` a rollback, and import `toast` into `LiftTracker` so a
failed save clears the disabled state.

## Where

`src/components/CalendarView.tsx:226-278` (9 calls),
`src/components/bevel/LiftTracker.tsx:708-729` (5 calls)

## Why

Next 16 returns a thrown handler as `500 text/plain`, and there is **no `error.tsx`
anywhere in `src/`** — so `res.ok === false` is the only signal these call sites
have, and they don't read it.

- Tap Delete → toast "Task deleted" → the task is still on screen.
- `replaceRecurringDay` does skip-then-create with no rollback: a failed second POST
  **permanently destroys that occurrence, silently**, and drops `weight`.
- `LiftTracker` never imports `toast` at all; a failed save leaves "Finish session"
  reading **"Saving…" and permanently disabled** until reload.

The 11 routes without `try/catch` are **not** the defect — reads wrapped, writes not
is a coherent asymmetry. The call sites are the defect.

## Verify

Block the endpoint in DevTools, tap Delete: an error toast appears, no success
toast, and the row stays. Repeat on Finish session: the button re-enables.
