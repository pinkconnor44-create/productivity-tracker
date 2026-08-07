# Bevel — device QA checklist (Phase 7)

Run this on the iPhone PWA against the preview URL. It is the only part of
Phases 0–8 that cannot be done from this machine.

**Preview:** https://productivity-tracker-466gt6m76-pinkconnor44-creates-projects.vercel.app

> Preview deployments sit behind Vercel's deployment protection, so Safari will
> bounce to a Vercel login first. Either sign into Vercel on the phone once, or
> turn protection off at Vercel → Project → Settings → Deployment Protection.

The tab currently shows ~75 days of **demo** data seeded by
`scripts/seed-health-fixtures.mjs`. It is not real. Clear it with
`node scripts/wipe-health-fixtures.mjs --yes` before the first real backfill.

## Bevel sub-tabs

- [ ] **Dashboard** — three rings visible without horizontal scroll; on a phone
      it should be one large ring (Recovery) plus two smaller ones beside it,
      not three tiny ones.
- [ ] Tapping a ring opens that metric's sub-tab.
- [ ] Stat grid is 2 columns on the phone, 4 on desktop; no value overflows its card.
- [ ] **Sleep** — stage bar renders with four segments; the history list scrolls
      inside its own card without scrolling the page.
- [ ] **Recovery** — "How this score was reached" shows three rows; weights sum
      sensibly and a row with no data reads "Not counted".
- [ ] Both range gauges show a marker, not just an empty track.
- [ ] **Strain** — workout rows readable; the 21-day bar history fits the width.
- [ ] **Lifts** — identical to the old Lifts tab. Log a set, switch to Sleep and
      back: **the in-progress set must survive**.
- [ ] Floating stopwatch drags, and its position persists after a reload.
- [ ] **Trends** — metric picker scrolls horizontally rather than wrapping to a
      second row; picking a metric redraws the chart.
- [ ] Day-picker chips scroll; the timeline below changes with the selection.

## Cross-cutting

- [ ] **No horizontal page scroll on any sub-tab.** Charts/tables must scroll
      inside their own container, never the body.
- [ ] Nav drawer shows **Bevel** and no longer shows **Lifts**.
- [ ] Swiping horizontally between top-level tabs still works.
- [ ] Long-press-drag to reorder nav still works, and does not also swipe tabs.
- [ ] Sub-tab bar scrolls horizontally; all six reachable.
- [ ] Nothing important is invisible until hovered (the `hoverOnlyWhenSupported`
      trap — the copy button on the empty state, chart tooltips, action icons).

## Regression sweep on the rest of the app

The nav restructure touched Shell and page.tsx, so re-check:

- [ ] Calendar loads, Scratchpad checklist edit/delete buttons visible **without
      hovering** (this was the outstanding bug from the last session).
- [ ] Tasks / Habits / Stats / Projects all render.
- [ ] Today widget ring + streak still correct in the sidebar and drawer.

## Empty state

Worth seeing once, since it is what a fresh install shows:

```
node scripts/wipe-health-fixtures.mjs --yes
```

- [ ] Bevel shows the five numbered HAE setup steps.
- [ ] The endpoint URL matches the deployment you are on.
- [ ] Copy button works on the phone.
- [ ] The API key is **not** shown anywhere on the page.
