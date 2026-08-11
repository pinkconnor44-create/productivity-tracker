# 008 — cleanup discipline across all 39 `useEffect`s: one uncancelled rAF, zero listener leaks, three dependency defects

**Verdict on the question asked:** **the cleanup rule is followed.** Of the 39
effects in `src/components/*.tsx`, **17 register something that outlives the
render** (listener, timer, interval, observer, body-style mutation, in-flight
fetch). **16 return a matching cleanup.** The one that does not is
`FloatingStopwatch.tsx:45` (a `requestAnimationFrame` with no
`cancelAnimationFrame`) — one frame, on a component that *does* mount and
unmount repeatedly, and it costs nothing measurable.

**No listener, interval, observer or subscription leaks across an
unmount/remount cycle anywhere in the tree.** I looked for the accumulating
kind specifically and there isn't one.

**The real defects in this population are dependency arrays, not cleanups** —
three of them, below. That is the finding worth having: the thing the missing
linter (`brief.md` finding 1) would have caught is *not* the missing-cleanup
class, which is clean by hand; it is the deps class, which is not.

**Verified by:** reading all 39 effects and every call site that mounts them ·
`npx tsc --noEmit` **clean, 0 errors** · effect ordering reasoned from React's
documented semantics (cleanup for a deps change runs with the *previous*
render's closure, before the next setup). **Not driven in a browser** —
read-only, and the DB is shared with production.

⚠️ **Overlap:** `Scratchpad.tsx:168` is fully owned by **finding 009**, which
traces it keystroke by keystroke. It is listed here only as one of the three
deps defects so this audit is complete; **do not fix it from this file.**

## The registration inventory — what each of the 17 sets up, and what it tears down

| # | `file:line` | Registers | Cleanup |
|---|---|---|---|
| 1 | `Shell.tsx:148` | `score-refresh` listener + `AbortController` per fetch | ✅ aborts **and** removes |
| 2 | `Shell.tsx:172` | `keydown` + `body.style.overflow` | ✅ removes, restores **prior** value |
| 3 | `Shell.tsx:205` | 4× document touch listeners | ✅ all four removed |
| 4 | `CalendarView.tsx:78` | 2× `setTimeout` + rAF | ✅ all three, on both return paths |
| 5 | `CalendarView.tsx:607` | `setInterval` 60 s | ✅ `clearInterval` |
| 6 | `FloatingStopwatch.tsx:45` | `requestAnimationFrame` | ❌ **none** — see below |
| 7 | `FloatingStopwatch.tsx:57` | `resize` listener | ✅ |
| 8 | `PWASetup.tsx:9` | SW register + `beforeinstallprompt` | ✅ on the branch that registers |
| 9 | `ToastContainer.tsx:20` | `app-toast` listener | ✅ (nested timeouts — see below) |
| 10 | `ProjectsView.tsx:49` | `keydown` | ✅ |
| 11 | `ProjectsView.tsx:84` | rAF | ✅ `cancelAnimationFrame` |
| 12 | `ProjectsView.tsx:184` | unmount flush, deps `[]`, state via refs | ✅ **the correct pattern** |
| 13 | `ui/ConfirmDialog.tsx:51` | `keydown` + `body.style.overflow` | ✅ both, prior value restored |
| 14 | `LiftTracker.tsx:456` | `body.style.overflow` | ✅ |
| 15 | `HabitsView.tsx:483` | `body.style.overflow` | ✅ |
| 16 | `bevel/shared.tsx:77` | fetch + `AbortController` | ✅ |
| 17 | `bevel/shared.tsx:89` | `score-refresh` listener | ✅ |

Outside `src/components/*.tsx` but in the same blast radius, all clean:
`lib/stopwatch.tsx:67` (`clearInterval` on unmount), `bevel/ImportStatus.tsx:24`
(`clearInterval`), and all four of `orrery/OrreryHero.tsx:29/36/49/59` —
`IntersectionObserver.disconnect()`, `cancelAnimationFrame`,
`ResizeObserver.disconnect()`, and a 6-timer burst cleared as an array.

The remaining 22 effects register nothing that survives the render: one-shot
fetches, `setX(prop)` mirrors, ref syncs, `scrollIntoView`, `setMounted(true)`.
Per the brief for this item, they are not padded into the list.

### The `mousedown` + `touchstart` rule has no live instance to violate

Grepped `mousedown|touchstart|pointerdown` across all of `src/`: **two hits,
both `touchstart` in `Shell.tsx:247/252`** — the swipe handler, and it is
removed. **There is not a single outside-click handler in this codebase.** The
one place that would want one, the exercise-name suggestion dropdown
(`LiftTracker.tsx:425`), dismisses on `onBlur` with a 150 ms `setTimeout`
instead — which works on touch and needs no document listener. So the rule is
un-violated because it is currently un-exercised, not because it was followed.
Worth knowing before the next dropdown is written.

## 1. `FloatingStopwatch.tsx:45` — the only uncancelled registration — `cleanup` · 2 min · verified

```js
requestAnimationFrame(measure)   // measure() calls setPos(); nothing cancels it
```

This is the one component in the app the user can genuinely mount and unmount
over and over: `Shell.tsx:375` renders it only when
`activeTab === 'bevel' && (liftsActive || running)`, so every hop onto and off
the Bevel/Lifts sub-tab is a full mount/unmount cycle.

**What I tried to kill it with, and could not fully:** it fires exactly once
per mount, one frame later, and `setPos` on an unmounted component is a silent
no-op in React 18+ — nothing accumulates, nothing warns. It only runs at all on
first-ever use (the `if (saved) return` above it short-circuits once a position
is in `localStorage`). So the honest severity is **cosmetic**. It is listed
because it is the sole exception in an otherwise complete set, and because the
file carries an `// eslint-disable-next-line react-hooks/exhaustive-deps` on
line 54 for a linter that does not exist in this project — a suppression with
nothing to suppress.

**Fix:** `const id = requestAnimationFrame(measure); return () => cancelAnimationFrame(id)`.

## 2. `CalendarView.tsx:161` — the only refetching effect in the app with no `AbortController` — `risk` · ~30 min · verified by reading

```js
useEffect(() => {
  setLoading(true)
  Promise.all([fetchData(), fetchScores(), fetchSummary()]).finally(() => setLoading(false))
}, [fetchData, fetchScores, fetchSummary])
```

`fetchScores` is a `useCallback` over `[currentDate, view]` (`:159`), so **this
effect re-runs on every month/week arrow press and every view switch**, firing
two fetches each time (`/api/scores` + `/api/notes`, `:153-158`). No signal, no
generation counter, no `ignore` flag. Hold the ‹ arrow down through six months
and six overlapping pairs are in flight; whichever Turso answers last wins
`setScores`/`setNotes`, so the grid can settle showing **another month's scores
and notes under the current month's header** — with `loading` already false,
because `.finally` fired on the newest promise. Self-healing only if the user
navigates again.

This is not a general "fetches should abort" nag. It is the *one* place that
re-fetches on user input without the guard, and the codebase already knows the
pattern in two other spots — `Shell.tsx:148-166` and `bevel/shared.tsx:58-80`,
both of which carry the comment explaining exactly this hazard
(*"a stale 365-day response must not overwrite a fresh 30-day one"*). Calendar
is the heaviest navigator of the three and the only one without it.

**What I tried to kill it with:** *"month navigation is slow enough that
responses can't overlap."* Not on these routes — `/api/scores` recomputes across
the whole range and `/api/notes` is `cache: 'no-store'`; both are Turso round
trips from a Vercel function, and the arrows have no disabled state or debounce
(`:171-179`), so input rate is bounded only by how fast the user clicks.

**Defect or taste:** defect, but latent — the visible symptom needs two
navigations inside one round trip.

**Fix:** thread one `AbortController` (or a monotonic request id) through
`fetchScores`/`fetchSummary`/`fetchData` and drop responses whose signal is
aborted, exactly as `bevel/shared.tsx:58` does.

## 3. `Shell.tsx:205` — the swipe handler decides "is this a phone?" once, forever — `cleanup` · 15 min · verified by reading

```js
useEffect(() => {
  if (typeof window === 'undefined') return
  if (window.matchMedia('(min-width: 768px)').matches) return   // read once, [] deps
  …
}, [])
```

`matchMedia(...).matches` is sampled at mount and the effect never re-runs — no
`mql.addEventListener('change', …)`. Load the app in a window wider than 768px
and narrow it (or open the PWA in Split View / Slide Over on an iPad) and the
mobile tab-swipe is **never registered for the life of the page**; a reload is
the only recovery. It cannot leak — the desktop branch returns before
registering anything — it just silently doesn't exist.

The same read-once shape appears at `CalendarView.tsx:426`
(`matchMedia('(hover: hover)')` into `canHoverRef`) and
`OrreryHero.tsx:29-33`. Both of those are defensible: the orrery gate is
deliberately conservative and one-way, and hover-capability changing mid-session
is a fringe case. The swipe one is the one a real device configuration reaches.

**Defect or taste:** taste, verging on defect on iPad. A feature that exists or
not depending on the width at page load, with no way to tell, is the kind of
thing that gets reported as "swiping sometimes doesn't work".

**Fix:** move the media query into state driven by `mql.addEventListener('change', …)`
and let the effect re-run on it (the existing cleanup already removes all four
listeners correctly).

## 4. Dependency defects — the class the cleanup audit actually turned up

| `file:line` | Deps | What goes wrong | Status |
|---|---|---|---|
| `Scratchpad.tsx:168` | `[notes]` on a cleanup-only effect | cleanup runs per keystroke with the *previous* `notes`; POSTs stale text and `clearTimeout`s the live debounce | **Owned by finding 009** — do not duplicate |
| `CalendarView.tsx:161` | correct deps, missing abort | §2 above | new |
| `Shell.tsx:205` | `[]` with a live media query read inside | §3 above | new |
| `LiftTracker.tsx:688` / `:691` | `[exName, rows]` then `[exName]` | ordering, below | new, **unreachable today** |

### `LiftTracker.tsx:688/691` — draft cross-contamination, currently unreachable

```js
useEffect(() => { saveDraft(exName, rows) }, [exName, rows])   // :688
useEffect(() => { setRows(loadDraft(exName)) }, [exName])      // :691
```

If `exName` ever changed on a mounted `InlineLogForm`, `:688` would run **first**
— with the *new* name and the *old* rows — writing exercise A's in-progress sets
to `lift-draft-<today>-B`. `:691` then reads back the key `:688` just
overwrote, so the "reload the draft" line loads the contamination rather than
correcting it. Exercise B's real draft is destroyed.

**What kills it:** `exName` cannot change in place. `ExerciseModal` is rendered
as `{selectedExercise && <ExerciseModal exName={selectedExercise} …/>}`
(`LiftTracker.tsx:229/276/387`) and the only way to leave an exercise is
`onClose → setSelectedExercise(null)`, which unmounts the subtree. So the
comment at `:690` — *"modal could be reused, defensive"* — describes a defence
that is inert, and the defence is itself the hazard. Costs one extra render and
two extra `localStorage` writes per mount today; becomes real data loss the day
anyone adds a next/prev-exercise control inside the modal.

**Fix, one line:** delete `:691` and give the modal `key={selectedExercise}`, so
a name change remounts with a fresh `useState(() => loadDraft(exName))`.

## Things I checked and am *not* raising

- **`ToastContainer.tsx:25-27`** — `setTimeout` inside the event handler, never
  cleared, and it schedules a second nested one. Not a finding: rendered at
  `page.tsx:57` in a **single-route** app, so it never unmounts; and if it did,
  the callbacks are `setToasts` no-ops. Same reasoning clears `PWASetup`
  (`layout.tsx:46`), `ConfirmProvider` (`layout.tsx:47`) and
  `StopwatchProvider` (`page.tsx:53`).
- **`CalendarView.tsx:1017-1018`** — `NoteEditor`'s two `setTimeout` refs have
  no unmount clear, and `NoteEditor` genuinely unmounts when the day modal
  closes. Not a leak: `setTimeout` is not tied to React, so the pending save
  still fires, and `onSave` belongs to the still-mounted `CalendarView`. The
  save survives the unmount — which is the desired behaviour, reached by
  accident. (Finding 009 already covers the tab-close exposure.)
- **`LiftTracker.tsx:425`** — `onBlur={() => setTimeout(…, 150)}`, uncleared.
  Fires into an unmounted component at worst; no-op.
- **`Shell.tsx:148` + `:167`** — mount fires `refresh()` directly *and*
  dispatches `score-refresh`, so `/api/scores` is requested twice on load. The
  first is aborted by the `AbortController` at `:152`, so it is one wasted
  connection, not a double read. Noted, not raised.
- **Body-scroll locking is done three times** (`Shell.tsx:172`,
  `ConfirmDialog.tsx:51`, `LiftTracker.tsx:456` / `HabitsView.tsx:483`) with two
  different restore strategies — save-and-restore vs reset-to-`''`. Nesting a
  confirm inside a modal and closing them out of order would unlock the body
  early. Cosmetic; the two save-and-restore copies are the correct ones.

## Rough effort

§1 2 minutes · §2 ~30 minutes · §3 ~15 minutes · §4 (LiftTracker) ~5 minutes.
Total under an hour, and none of it is on the critical path — the only one that
loses user-visible correctness today is `Scratchpad.tsx:168`, which belongs to
finding 009.
