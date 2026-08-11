# 25 — The orrery's IntersectionObserver gate can never be false

**Severity** cleanup (perf risk) · **Effort** ~15min · **Approved** 2026-08-10
**Source** run-3 finding 18 · evidence `../overnight/audits/017-orrery-gating.md`

## Change

Gate on something that can actually be false — user intent (a tap to load) or a
scroll threshold below the fold — and fix the source comment's bundle figure.

## Where

`src/components/orrery/OrreryHero.tsx:36-44`; comment at `:6`

## Why

It is a real observer with correct cleanup — but `OrreryHero` is the **first element
of `CalendarView`**, `calendar` is the hard-coded default tab (`page.tsx:15`), and
`Shell.tsx:110` seeds `mounted` with the active tab. The observed node sits at
scroll-top of the landing tab, so it intersects on first observation, every time.

Measured from the existing build: the WebGL chunk is **1,174,179 B raw / 347 KB
gzip**, against 131 KB gzip of eager JS. The source comment at `:6` claims
"~170 KB gzipped" — **off by 2×**.

The dynamic-import and phone gates both work correctly. This one gates nothing, so
every desktop session pays 347 KB unprompted.

## Verify

Load the app on desktop and check the Network tab — the WebGL chunk does not appear
until the gate is deliberately tripped.
