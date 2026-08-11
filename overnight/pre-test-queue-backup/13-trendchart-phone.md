# 13 — Trend charts are unreadable on a phone

**Severity** risk · **Effort** ~1h · **Approved** 2026-08-10
**Source** run-3 finding 14 · evidence `../overnight/audits/020-ui-render-sweep.md`

## Change

Scale axis text with the viewBox (or render labels outside the SVG), and add touch
handlers alongside the mouse ones.

## Where

`src/components/ui/TrendChart.tsx`

## Why

Measured: `viewBox="0 0 1000 200"` plus `w-full` scales `fontSize="10"` user units
down to **3.16 px at 390 px wide** (4.38 px at 768, 5.26 px at 1440). The whole
chart is 316×63 px on a phone.

It is also `onMouseEnter/Move/Leave` **only — no touch handler**. On the device this
app is built for, the charts convey shape and not one readable number.

## Verify

At 390 px the axis labels measure ≥ 10 px, and tapping the chart opens the tooltip.
