# 32 — `dev\TRAPS.md` misattributes the PWA staleness cause

**Severity** rule challenge · **Effort** ~15min · **Approved** 2026-08-10
**Source** the run-3 review "Rule challenges" · evidence `../overnight/audits/019-service-worker.md`

## Change

Keep the advice, correct the mechanism. Rewrite `dev\TRAPS.md:220` to say the cause
is the backgrounded web view, not the service worker.

## Where

`dev\TRAPS.md:220` (cross-project traps file, outside this repo)

## Why

It says the service worker keeps serving the old bundle after a deploy. Verified:
`public/sw.js` has **one** Cache Storage call — a `caches.match` read — and **zero
writes**. No precache, no workbox. The cache is permanently empty, so both fetch
branches collapse to a passthrough, and it has never had a different body since the
initial commit. Production serves the document `no-store`.

The service worker **cannot** be the cause. The advice ("fully close and reopen") is
right; the stated mechanism sends the next debugger to the wrong layer. Likely cause
is iOS keeping the backgrounded web view alive.

## Verify

30 seconds on the device: Web Inspector → Application → Cache Storage shows **zero
caches**. Then the trap text matches what is actually there.
