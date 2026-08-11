# 009 — the `keepalive` unmount flush exists, fires on the wrong event, and one copy destroys its own debounce

**Verdict:** the rule is **implemented in 2 of 3 debounced writers** — and the
implementations are inert, because in a one-route app whose tab shell never
unmounts a view, *unmount is not an event that happens*. Separately, the
Scratchpad copy has a dependency-array defect that turns an 800 ms debounce
into a write-per-keystroke that is permanently **one keystroke stale**.

**Severity: `bug`** for the Scratchpad defect (silent, reproducible data loss
today) · **`risk`** for the missing `pagehide`/`visibilitychange` hook.
**Verified by reading** — deterministic React effect semantics, traced
keystroke by keystroke below. `npx tsc --noEmit` clean, 0 errors. Not driven in
a browser (read-only, and the DB is shared with production).

## Inventory — every debounced write in `src/`

Greps: `keepalive|sendBeacon|visibilitychange|beforeunload|pagehide|unload`
across `src/` returns **exactly 3 hits, all `keepalive: true`**. Zero
`pagehide`, zero `visibilitychange`, zero `beforeunload`, zero `sendBeacon`.
`setTimeout(` across `TasksView`/`HabitsView`/`LiftTracker`/`StatsView`/
`SettingsView` returns one hit, a 150 ms blur-suggestion dismissal — not a
write. So the debounced-write surface is these three files and no others.

| Writer | Debounce | Flush on blur | Unmount flush | Verdict |
|---|---|---|---|---|
| `Scratchpad.tsx:53` notes | 800 ms (**defeated**) | no | `:168` — deps `[notes]`, **wrong** | broken |
| `Scratchpad.tsx:63` checklist | none — `await` per change | n/a | n/a | fine, needs nothing |
| `ProjectsView.tsx:150` notes | 600 ms | no | `:184` — deps `[]`, **correct** | correct, unreachable |
| `ProjectsView.tsx:216` checklist | 250 ms + AbortController | no | `:184` — deps `[]`, **correct** | correct, unreachable |
| `CalendarView.tsx:1034` day note | 800 ms | **yes** `:1039` | **none** | mostly covered |

## 1. The flush fires on an event this app never produces — `risk`

`src/app/` contains exactly one route (`page.tsx`). `Shell.tsx:110,140-143`
lazy-mounts each tab into a `Set` that **only ever grows**, and renders
inactive tabs as `<div className="hidden">` (`Shell.tsx:362`). So a view is
mounted the first time it is opened and stays mounted for the life of the page.

`Scratchpad` is rendered in exactly one place — `CalendarView.tsx:350`,
unconditional inside the Calendar view. `ProjectsView` is a Shell tab. Neither
unmounts on tab switch, and there is no other route to navigate to.

**Therefore both `keepalive` cleanups are dead code in normal use.** The
comment at `Scratchpad.tsx:166-167` even says so out loud — *"tab switch w/
keep-mounted shouldn't unmount, but a full page nav will"* — except there is no
full page nav in this app.

The events that *do* end a session are tab close, reload, PWA swipe-away, and
iOS killing a backgrounded PWA. **React cleanup runs for none of them.** That
is precisely the case `pagehide`/`visibilitychange` exists for, and the brief
already records that `beforeunload` is unreliable on mobile Safari — this app
uses neither.

Concrete loss, closing the tab / reloading / swiping the PWA away:

- **Projects notes** — up to **600 ms of typing**, ~3–6 characters at normal
  speed, or a whole paste if the paste was the last event. Worse if a PATCH is
  already in flight: `ProjectsView.tsx:151` sends **no** `keepalive`, so a
  teardown mid-flight cancels it — exposure becomes 600 ms + a Turso round trip.
- **Projects checklist** — 250 ms. Tick a box and close the tab in the same
  motion and the tick is gone. Same in-flight caveat (`:220`, no `keepalive`).
- **Calendar day note** — 800 ms, but only while the textarea still has focus;
  `handleBlur` (`CalendarView.tsx:1039`) flushes on focus loss, so this is the
  least exposed of the three.

## 2. `Scratchpad.tsx:168-182` — deps `[notes]` cancels the debounce it exists to protect — `bug`

```js
useEffect(() => {
  return () => {
    if (saveTimer.current && notes !== '') {
      try { fetch('/api/scratchpad', { …, body: JSON.stringify({ notes }), keepalive: true }) } catch {}
      clearTimeout(saveTimer.current)
    }
  }
}, [notes])          // ← runs cleanup on EVERY keystroke, not on unmount
```

The effect has no body, only a cleanup, and `notes` is in the deps. React
re-runs cleanup + setup on every change, and the cleanup closes over the
**previous** render's `notes`. `saveTimer.current` is set in
`handleNotesChange` (`:53`) and **never nulled**, so it is permanently truthy
after the first keystroke.

Traced, typing `hi`:

| step | action | effect |
|---|---|---|
| 1 | type `h` | `saveTimer = T1` (post `h` @800 ms) |
| 2 | re-render, cleanup captures `notes=''` | guard `'' !== ''` false → no-op |
| 3 | type `i` @200 ms | `clearTimeout(T1)`, `saveTimer = T2` (post `hi` @800 ms) |
| 4 | re-render, cleanup captures `notes='h'` | **POSTs `h`**, then **`clearTimeout(T2)`** |
| 5 | user stops | no timer pending. Server holds `h`. |

Three consequences, all live:

- **The 800 ms debounce never fires.** Every keystroke both sends a request and
  kills the pending one. A 200-character note is ~200 `prisma.scratchpad.upsert`
  round trips to Turso, one per keypress, instead of one.
- **The scratchpad is permanently one keystroke behind.** Reload and the last
  keystroke is gone. If that keystroke was a **paste**, the entire pasted block
  is gone — type `note`, paste 2,000 characters, walk away: the server still
  holds `note`. The unmount flush that would fix this is the dead code in §1.
- **Clearing the notes never saves.** Guard is `notes !== ''`. Select-all-delete
  → the cleanup for the previous value posts the *old* text and cancels the
  timer carrying `''`; the empty value is then blocked by the guard forever.
  `/api/scratchpad/route.ts:29` uses `notes !== undefined`, so an empty POST
  *would* clear the row — the component simply never sends it. Erase the
  scratchpad, reload, the text is back.

## What I tried to kill it with

- **"It saves on every keystroke, so it needs no flush."** True for
  `Scratchpad`'s **checklist** (`:63` `await`s on every mutation) — that one is
  correctly exempt and is not a finding. Not true for the four debounced paths.
- **"The Calendar note flushes on blur, so it's covered."** Mostly. Closing the
  DayModal while the textarea is focused fires **no** `blur` event (browsers
  don't fire blur when a focused node is removed), but the pending
  `setTimeout` is never cleared on unmount either, so it still fires and
  `onSave` belongs to the still-mounted `CalendarView`. The save survives. Only
  tab-close within 800 ms loses it. Downgraded, not dropped.
- **"`react-hooks/exhaustive-deps` (brief finding 1) would catch the Scratchpad
  bug."** It would **not**. `[notes]` is exactly what exhaustive-deps demands,
  since `notes` is read in the cleanup. The rule is satisfied and the code is
  still wrong. This sharpens finding 1 rather than duplicating it.
- **"`ProjectsView`'s flush is also miswritten."** It is not — deps `[]`, state
  read from refs (`pendingNotes`/`pendingChecklist`), timers cleared. It is
  correct code that never runs.
- **Already raised?** brief.md finding 1 lists "unmount `keepalive` flushes" as
  a class the missing linter cannot see; it asserts nothing about whether they
  work. Nothing in `## Rejected`, `HANDOFF.md` or `TRAPS.md` touches this.

## Defect or taste

**Defect**, both parts. §2 loses user data with no warning and no guard. §1 is a
rule that is satisfied on paper by a mechanism that cannot fire — the worse
failure, because `CLAUDE.md` reads as though the hazard is handled.

## Adjacent, noted not raised separately

- `ProjectsView.tsx:150` notes has **no `AbortController`** (the checklist at
  `:216` does), so two note PATCHes can land out of order.
- `ProjectsView.tsx:155` nulls `pendingNotes.current` on *any* response, so a
  slow request resolving after a newer keystroke clears the pending marker for
  an edit that has not been sent. Narrow, but it defeats the flush in §1 when
  the flush is eventually made to work.
- `CalendarView.tsx:1020` resets `value` from the `note` prop whenever it
  changes; `saveNote` (`:226`) sets that prop after its `await`, so characters
  typed during the round trip are clobbered.

## Fix, one line each

**§2:** give the flush `[]` deps, read the text from a `notesRef` updated in
`handleNotesChange`, drop the `notes !== ''` guard, and set
`saveTimer.current = null` when it fires.
**§1:** add one shared `useFlushOnHide(flush)` hook — `pagehide` +
`visibilitychange` (`document.visibilityState === 'hidden'`), **not**
`beforeunload` — and call the same `keepalive` flush from it in all three
components; add `keepalive: true` to the debounced PATCHes themselves.

**Effort:** §2 ~15 minutes. §1 ~1 hour including wiring all three call sites.
Verification needs a browser (type, close the tab, reload) — not runnable here.
