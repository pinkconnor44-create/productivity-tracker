# 16 — `prefers-reduced-motion` was added and removed the same day

**Severity** risk · **Effort** ~1h · **Approved** 2026-08-10
**Source** run-3 finding 17 · evidence `../overnight/audits/018-token-drift.md`

## Change

Restore the `prefers-reduced-motion` block, **or** delete the comment that claims it
exists. Restoring is the better call — but per `dev\TRAPS.md`, reduced motion means
*fewer and gentler*, not zero.

## Where

`src/app/globals.css:356-357`

## Why

`git log -S` shows the block added in `a2d0da2` and removed in `ab0160f`, **both on
2026-08-06**. The comment at `:356` still says it exists, so the file asserts a
guarantee the CSS does not provide.

Three infinite animations now run with no opt-out, two of them in persistent app
chrome.

## Verify

With `prefers-reduced-motion: reduce` forced in DevTools, the three infinite
animations are gentler or stopped — and the comment matches whatever you chose.
