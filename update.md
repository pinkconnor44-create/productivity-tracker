# Update log

## 2026-05-11 — UX pass + bug fixes

### Features
- **Per-habit % column** on each habit row (lifetime rate, color-coded via `scoreColor`). Renders `N/A` when nothing has been scheduled yet.
- **n-1 rule for aggregate completion %s.** Any % that aggregates more than one day excludes today, so today's in-progress score can't drag the number down. Applied in `HabitsView` (30-day rate + per-habit %), `CalendarView` Week/Month/Year cards, `StatsView` range averages, and the historical weekly chart inside the habit detail modal. Daily stats (today's score, heatmap cell coloring) are untouched. If excluding today leaves the window empty (e.g., habit created today), the UI shows `N/A`.
- **Calendar popover lingering on mobile** — fixed. The hover overlay used to stay visible behind the day modal because mobile taps fire `mouseenter` but not `mouseleave`. Now suppressed entirely on touch-primary devices (`matchMedia('(hover: hover)')`) and force-cleared when the day modal opens.
- **Mobile tab swipe.** Native document-level touch listeners with controller-style deadzone: nothing under 10px, direction locks (favoring horizontal on ties), 50px horizontal travel switches tabs. Skips `[data-no-swipe]` subtrees (timer widgets). Mobile only (`<768px`); no wrap at ends.
- **Dockable rest timer.** New right-edge vertical strip alternative to the floating draggable widget. Mode persisted to `localStorage('stopwatch-mode-v1')`. Timer state lives in a `StopwatchProvider` (page-level) so it keeps ticking across tab switches; widgets are gated to the Lifts tab so they don't show elsewhere.
- **Weekly Review tab removed** — metrics live elsewhere now. `nav-order-v1` localStorage self-heals via the existing unknown-id filter.

### Bug fixes
- **FloatingStopwatch expand → React error.** Early return for dock mode sat before three `useCallback` hooks, so flipping the mode changed the hook count between renders and React threw. Moved the early return after every hook.
- **Tab swipe ate by tappable elements.** Was using React pointer events on `<main>`; the browser dispatches `pointercancel` as soon as a gesture starts on a button, which killed the swipe whenever the user touched anything tappable. Rewrote with native `touchstart`/`touchmove`/`touchend` on `document`.
- **FloatingStopwatch invisible after cross-tab expand.** Was rendered inside `LiftTracker`, which sits in a `display:none` div when off-tab. Extracted to its own component and rendered from `Shell`.
- **Calendar popover z-index** drifted to `z-[9999]`. Pulled back to `z-[60]` (CLAUDE.md ladder).
- **Volume chart hardcoded violet.** `LiftTracker.tsx` had `#7c3aed` in the chart polyline / area fill / dot fill — wouldn't recolor with the accent theme. Now `var(--c-p-hex)`.
- **Score-refresh fetch had no `AbortController`.** Rapid tab switches could let an older request resolve over a newer one. `Shell.tsx` now aborts in-flight on each new refresh.
- **Stopwatch `start()` could spawn parallel intervals.** UI prevents it (button hidden when running), but added a defensive `clearInterval` at the top of `start()` anyway.
- **FloatingStopwatch pre-measure flash.** Used to render at `top:-9999` before its position was measured; now `visibility: hidden` until measured (no off-screen layout cost).
- **ToastContainer z-index** was `z-[100]`; now `z-[60]` per ladder.
- **`SettingsView` localStorage** wrapped in try/catch — Safari private mode throws on access and could prevent theme load.
- **`/api/lift-groups` order race.** `aggregate(_max) → create(max+1)` was two queries; a double-tap could produce duplicate orders. Wrapped in `prisma.$transaction`.

### Deferred / known issues
- **API routes don't wrap `req.json()` or Prisma mutations in try/catch.** Bad input returns 500 instead of 400; a missing row (e.g., `PATCH /api/tasks/<gone>`) returns 500 instead of 404. Personal PWA, single client, low impact — defer until it actually bites.
- **`parseInt(idStr)` on route params** silently returns `NaN` for malformed URLs, then Prisma queries with `NaN` do unexpected things. Same low-priority caveat.
- **N+1 / fat `include` on `/api/scores` and `/api/habits`.** Loads up to 400 completion records per habit. Fine at current data volume; revisit if it gets sluggish.
- **`useStopwatch().start()` re-creates the callback on every `ms` tick** (100ms) because `ms` is in its dependency array. Cheap, but means anything memoizing on `start` is busted. Could read `ms` from a ref instead. Not fixing yet.
