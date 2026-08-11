# 31 — Two docs list a fixed Scratchpad item as outstanding

**Severity** cleanup · **Effort** minutes · **Approved** 2026-08-10
**Source** the run-3 review action item (carried from runs 1–2); closed by run 3

## Change

Delete the stale claim from both files. Delete it — do not strike it through.

## Where

`HANDOFF.md:206` and `docs/BEVEL-QA.md:52`

## Why

Run 3 verified the Scratchpad hover buttons behave correctly, so the item is closed —
but two documents still list it as an open bug, and `BEVEL-QA.md:52` also refers to
it as "the outstanding bug from the last session", violating the absolute-dates rule.

⚠️ Unrelated and still open: the Scratchpad **autosave** defect is real and is item
04. Do not read this closure as clearing that one.

## Verify

Neither file mentions an outstanding Scratchpad hover bug; no relative dates remain
on that line.
