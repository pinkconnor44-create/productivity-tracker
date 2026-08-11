# 02 — Fix month navigation off-by-one

**Severity** bug · **Effort** minutes · **Approved** 2026-08-10
**Source** run-3 finding 2 · evidence `../overnight/audits/010-calendarview.md`

## Change

Call `setDate(1)` **before** `setMonth(...)` in both the next and prev handlers.

## Where

`src/components/CalendarView.tsx:175`

## Why

Verified by executing the file's own functions under `node`:

```
2026-01-31  next → 2026-03-01   (February skipped)
2026-03-31  prev → 2026-03-01   (button animates, goes nowhere)
```

Also skips Apr, Jun, Sep and Nov. Unchanged since `a526650 Initial commit`.

## Verify

`2026-01-31` next gives `2026-02-01`; `2026-03-31` prev gives `2026-02-01`.
