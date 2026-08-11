# 14 — `MetricRow` labels clip at exactly iPad-portrait width

**Severity** risk · **Effort** ~30min · **Approved** 2026-08-10
**Source** run-3 finding 15 · evidence `../overnight/audits/020-ui-render-sweep.md`

## Change

Give the label column a `min-width` (or reflow the row) so it cannot be squeezed
below its content between 768 px and 819 px.

## Where

`MetricRow` (Bevel shared row component)

## Why

Verified by a 5 px viewport sweep: at **768–819 px inclusive** the label column
measures **57 px for a 107 px label** — "Sleepin…", "baseline 4…". The same `flex-1`
yields a 727 px label column at 1440 px.

iPad portrait is exactly 768 px, so this is a real device width, not a synthetic
one.

## Verify

Sweep 760 → 830 px; no label is truncated at any width.
