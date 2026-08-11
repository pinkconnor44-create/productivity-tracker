# 09 — Strain's 21-day strip ignores the selected day

**Severity** risk · **Effort** ~30min · **Approved** 2026-08-10
**Source** run-3 finding 8 · evidence `../overnight/audits/020-ui-render-sweep.md`

## Change

Key the 21-day window off the selected day rather than today.

## Where

`src/components/bevel/BevelStrain.tsx:30`

## Why

Verified in the browser: with 2026-08-02 selected, the strip still reads Jul 21 →
Aug 10 — **eight days into the future relative to the selection**.

`HANDOFF.md` calls a header saying one day while the numbers come from another
"the worst failure available here", and this is exactly that.

## Verify

Select a past day; the strip's right-hand edge is that day, not today.
