# 19 — `recomputeDerived` writes one row per round trip

**Severity** risk · **Effort** ~45min · **Approved** 2026-08-10
**Source** the run-3 review action item (carried from runs 1–2). Introduced by `3d6672d`.

## Change

Batch the two unbatched loops into transactions / bulk writes.

## Where

`src/app/api/health-import/route.ts` — `recomputeDerived()`

## Why

Two loops issue one Turso round trip per row. Over a single day's import this is
tolerable; over the **2026-06-01 → 08-10 raw-sample export Connor still owes** it is
~140 sequential round trips inside a route capped at `maxDuration = 60`.

⚠️ **Do this before the big backfill, not after.** the run-3 review's project-items
table flags the same ordering.

## Verify

Time a multi-day `X-Import-Mode: replace` backfill before and after; the request
completes well inside 60 s.
