# 05 — Lifts "All-time" must not be a 90-day window

**Severity** bug · **Effort** minutes · **Approved** 2026-08-10
**Source** run-3 finding 5 · evidence `../overnight/audits/013-lifttracker.md`

## Change

Delete the 90-day query string from the Lifts fetch — the route already returns
everything when no date params are passed.

## Where

`src/components/bevel/LiftTracker.tsx:57` (also `:61`, `:490`, `:553`)

## Why

Verified against live data: **36 entries in the database, 7 inside the window** —
81% of history renders nowhere, under a label that says "All-time".

Worse: every exercise still visible has exactly one session, so the
`sessions.length >= 2` gate leaves **the volume chart and both delta pills blank
across the entire feature right now**.

## Verify

Lift history lists 36 entries, and at least one exercise renders a volume chart and
a delta pill.
