# 21 — Three server "today" helpers return the UTC day

**Severity** risk · **Effort** ~45min · **Approved** 2026-08-10
**Source** the run-3 review action item (carried from runs 1–2); the run-3 map seam 10

## Change

Rename them so the name states what they return, or make them take an explicit day
argument. Document the invariant at each call site.

## Where

Three server-side helpers, one of them named `localDateString()`. `today()` is
redeclared in **7 files**, `addDays()` in **9**.

## Why

They compute the **UTC** day and run on Vercel, so between 00:00 and 08:00 local they
disagree with the user's day. They are safe today **only because every caller passes
an explicit browser-local date** — an unwritten convention that one new caller
breaks silently.

The name `localDateString()` actively invites that mistake.

This is the app-side counterpart to the health rule: `toLocalDay()` is
`slice(0,10)` deliberately, and that rule does **not** extend to the rest of the app.

Run 3 checked and **rejected** two suspected live instances — `aggregatePct` and the
Task DELETE stamp are both fed browser-local dates. This item is about the trap, not
a current miscount.

## Verify

No helper named `local*` returns a UTC day. Every call site passes an explicit date.
