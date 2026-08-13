# Component notes

> Moved out of `CLAUDE.md` on 2026-08-07 when a 100-line cap was imposed.
> Implementation detail, recoverable by reading the component — the *invariants*
> stayed in `CLAUDE.md`.

## Shell (`src/components/Shell.tsx`)
- Desktop: 240px fixed sidebar (`md:+`) — logo + Today widget (score Ring + 🔥 streak) + flat draggable nav + footer (Settings + Power)
- Mobile: hamburger drawer; top bar shows greeting + streak chip; backdrop / Esc closes; body-scroll-locks while open
- Single flat nav list (no section labels). Order persists to `localStorage('nav-order-v1')`; `loadOrder()` filters saved ids against `NAV_ITEMS`, so adding/removing a tab needs no migration. Settings + Power anchored in footer, not draggable.
- **Reorder gesture** (`NavItem`): pointer-event long-press (300ms) → drag, hit-tested via `document.elementFromPoint` on `[data-tab]`. Three things it is easy to break:
  - `PRESS_MOVE_CANCEL` (14px) abandons the long-press, but must **not** clear `pid` — otherwise `pointerup` bails early and the press registers as neither drag nor tap. Tap fires on release when travel ≤ `TAP_SLOP` (24px), regardless of whether the drag was abandoned.
  - `setPointerCapture` must use an element grabbed synchronously in `pointerdown` — React nulls `e.currentTarget` before the long-press timer fires.
  - The mobile drawer carries `data-no-swipe`. The document-level tab-swipe listener is `passive` and ignores `touch-action`, so without it a horizontal reorder drag also switches tabs.
- Tabs: `tasks | habits | bevel | stats | calendar | projects | settings`
- The rest-timer stopwatch (floating + docked) was **removed entirely on 2026-08-12** (Connor's call) — components, `lib/stopwatch.tsx` and the provider are gone.
- **Lazy-mount + keep-mounted**: views render in `<div className={tab===activeTab ? '' : 'hidden'}>` once visited and never unmount on tab switch. State survives nav (scratchpad drafts, in-progress edits, lift set drafts). Cost: concurrent fetches once a view's been opened.
- **Z-index ladder**: aurora `-10` / content `0` / sidebar `30` / mobile drawer `40` / modals (createPortal at body) `50` / toasts + portal tooltips `60`
- `score-refresh` window event dispatched on every tab change so any view listening to it refetches


## Component-specific notes

### CalendarView
- **Layout is a 3-column flex** (`flex flex-col lg:flex-row`): YearSpine (`xl:` only) │ calendar grid │ Scratchpad (`lg:w-[280px] xl:w-[340px]`, `lg:sticky`). Below `lg` it's a column, so Scratchpad falls under the grid. One Scratchpad instance, reflowed by CSS — do **not** render two breakpoint-gated copies: `/api/scratchpad` is a singleton row (`id: 1`) and two mounted instances silently clobber each other's debounced saves.
- The Scratchpad column needs `lg:max-h-[calc(100vh-2.5rem)] lg:overflow-y-auto` — its notes textarea auto-grows with no max-height and would otherwise defeat the sticky.
- **Never put a `transform`/`filter` on the 3-column container**: `DayModal` is `position: fixed` and rendered *inside* the calendar column (not portalled), so a transformed ancestor becomes its containing block and breaks it.
- Month + week cells show kind-colored task pills. Mobile (`<sm`): up to 3 pills, start time only via `shortTime()` helper (e.g., `9a`, `9:30a`, `12p`, `2:30p`), untimed tasks show a tiny kind dot. Tablet+ (`sm:`): same pill plus truncated title. `+N more` footer when length > 3.
- Pill must be a `<div>` (not `<span>`) with `overflow-hidden` so `truncate` clips against the column. Use `max-w-full sm:w-full` so pills size to content on mobile but stretch on desktop. Parent column uses `items-start`.
- Pill text scales with breakpoint: `text-[7px] sm:text-[10px]` with `px-0.5 sm:px-1 py-px`.
- 4-card stat strip (Day / Week / Month / Year) at top. YearSpine only on `xl:+`.
- `shortTime(t)` is the canonical compact time format for narrow contexts (<50px). `formatTime()` is for day-detail and tooltips where space isn't constrained.

### LiftTracker
- 2-layer navigation: `activeGroupId === null` = Layer 1 (workout day cards), `number` = Layer 2 (exercises in that day), `'ungrouped'` = Layer 2 ungrouped list. `AddExerciseToGroup` handles autocomplete add at the bottom of Layer 2.
- Lift session drafts: stacked-set inputs in `InlineLogForm` auto-save to `localStorage('lift-draft-{date}-{exerciseName}')` per keystroke. "Finish session" groups consecutive same-weight rows into single `LiftEntry` POSTs (schema is one weight per entry, JSON `[reps]` per set). Always clear the draft after successful submit.

### ProjectsView
List shows project name + N/M checklist progress only. Click card → opens modal (`createPortal` to `document.body`) containing title / notes / checklist / delete. Pattern: any "tab switcher + always-visible detail panel" UI in this repo should be a list-of-cards + modal instead.


### Deferred / known issues (rescued from `update.md`, 2026-05-11, still true 2026-08-12)
- **API routes don't wrap `req.json()` or Prisma mutations in try/catch.** Bad
  input returns 500 instead of 400; a missing row (e.g., `PATCH
  /api/tasks/<gone>`) returns 500 instead of 404. 16 bare `await req.json()`
  sites. Personal PWA, single client, low impact — defer until it bites.
  (Reads wrapped / writes not is a deliberate asymmetry; the CALL SITES now
  check `res.ok` — that was work order 11.)
- **`parseInt(idStr)` on route params** silently returns `NaN` for malformed
  URLs (5 sites, zero guards), and Prisma queries with `NaN` do unexpected
  things. Same low-priority caveat.
- **N+1 / fat `include` on `/api/scores` and `/api/habits`** — `take: 400`
  with an unbounded include. Fine at current volume; revisit if sluggish.
