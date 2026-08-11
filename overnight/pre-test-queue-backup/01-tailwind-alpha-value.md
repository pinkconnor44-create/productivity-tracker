# 01 — Add `<alpha-value>` to `on-surface-variant`

**Severity** bug · **Effort** minutes · **Approved** 2026-08-10
**Source** run-3 finding 1 · evidence `../overnight/audits/018-token-drift.md`,
`../overnight/audits/020-ui-render-sweep.md`

## Change

Declare the token so Tailwind can emit its `/NN` variants — match the form used by
`outline` and `outline-variant` two lines below. Audit every sibling token in the
same file for the same omission while you are there.

## Where

`tailwind.config.ts:23`

## Why

Declared as a bare `var(--on-surface-variant)` with **no `<alpha-value>`**, so
Tailwind emits no `/NN` variants at all. `outline` and `outline-variant` do carry
it and work correctly — that is the control that proves the mechanism.

**227 uses across 37 files** are dead classes; the elements inherit pure white. An
agent walked every `CSSRule` in every stylesheet and found **2 matches, both the
bare class**, then measured `color: rgb(255,255,255)` on "Locked at wake…",
"baseline 68ms", "41.0bpm vs 45.1bpm baseline" and the import status line.

Two functional casualties beyond the flattened hierarchy:

- The DayScroller presence dot measures `rgba(0,0,0,0)` on every unselected chip —
  no chip has a dot, so `HANDOFF.md`'s "a day with no data is already a chip with
  no dot" is not true on screen.
- The sidebar and mobile-header plates (`bg-surface/65`, `/75`) have no background.

Single highest-leverage item in the review: one missing token, whole-app contrast.

## Verify

Computed `color` on a `text-on-surface-variant/70` element is a grey, not
`rgb(255,255,255)`. DayScroller unselected chips show a presence dot.
