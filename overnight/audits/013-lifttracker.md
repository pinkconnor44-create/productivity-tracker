# 013 — `src/components/LiftTracker.tsx` (40,352 B), first review

_Reviewed 2026-08-10. Read in full: `LiftTracker.tsx` (865 lines), `api/lifts`,
`api/lifts/[id]`, `api/lift-groups`, `api/lift-groups/[id]`, `lib/stopwatch.tsx`,
`FloatingStopwatch`, `DockedStopwatch`, `Shell.tsx:355–381`, `BevelView.tsx:40–140`,
`ui/ConfirmDialog.tsx`, `globals.css:155–176`, `schema.prisma:95–111`.
`npx tsc --noEmit` → **exit 0, 0 errors**. No writes made; the DB was queried
**SELECT-only** (36 `LiftEntry` rows, 2 `LiftGroup` rows)._

## Answers to the three questions asked

**Can `sets` and `totalReps` disagree?** **No, not through the app.**
`api/lifts/route.ts:31` derives `totalReps` from `sets` on create, and there is
**no UPDATE route for `LiftEntry` at all** — only POST-create and DELETE. Checked
every live row: **36/36 parse as arrays, 36/36 have `sum(sets) === totalReps`,
0 rows with `weight = 0`, 0 rows unparsable.** The column is redundant, not
divergent. What is *not* safe is the malformed-parse path — see issue 2.

**Are optimistic writes safe?** Partly. `logSession`/`deleteEntry` use functional
updaters as the rule requires; `assignExerciseToGroup` does not (issue 5). No
write path in the file checks `res.ok`, has a rollback, a try/catch, or an
`AbortController` (issues 2, 3).

**Is the rest-timer coupling sound?** The *reason* for the arrangement holds and
is correctly implemented; the *gate* is narrower than the comments claim
(issue 4). `.tab-fade` is `animation: tab-fade-in 0.22s ease` with **no
fill-mode** (`globals.css:162–164`), so the `transform` containing block exists
for 220 ms after every tab switch — exactly the window in which an already-running
timer is first painted. Rendering the overlays from `Shell` (outside `.tab-fade`)
is therefore right, and `BevelView.tsx:74–77` sets/clears `liftsActive` with a
correct unmount cleanup.

---

## 1. The 90-day fetch window is presented as all-time — 29 of 36 live rows are invisible and the volume chart currently renders for **zero** exercises

`src/components/LiftTracker.tsx:57` · `:61` · `:490` · `:509–521` · `:553–557`
**risk (high) · verified against live Turso, read-only · defect · minutes**

`startDate = addDays(t, -89)` scopes the only fetch of `entries`, and `entries`
is the sole source of `byExercise` — the exercise list, per-exercise session
counts, `max … lbs`, `VolumeChart` and both `VolumeDelta` pills. Nothing in the
UI says "90 days"; the pill at `:553` is labelled **"All-time"**.

Live numbers (SELECT-only, 2026-08-10):

| | rows | distinct exercises |
|---|---|---|
| in DB | **36** (2026-04-24 → 2026-08-07) | 16 |
| inside the 90-day window (≥ 2026-05-13) | **7** | 7 |

So **81% of the user's lift history is not rendered anywhere.** Every one of the
7 visible exercises has exactly **one** session, so the `sessions.length >= 2`
gate at `:490` is false for all of them: **the volume chart and both delta pills
are dark for the entire feature right now**, and it reads as "no history yet"
rather than "history outside the window". `Close Grip BP` (4 sessions,
2026-04-30 → 2026-08-07) and `Incline Hammer` (4 sessions) both have exact-name
history and would chart immediately; `Bench`, `Barbell Row`, `Shoulder Shrugs`,
`Shoulder Flys`, `Incline DB bench`, `Back Squat`, `RDL` (29 rows) do not appear
at all, in any list, grouped or ungrouped.

**What I tried to kill it with:** a scale argument. There is none — the whole
table is 36 rows, and `api/lifts/route.ts:13–18` already returns everything when
no date params are supplied (`where: undefined`), so the fix costs one query
string and no new code.

**Fix:** fetch `/api/lifts` with no `startDate`/`endDate`; keep the 30-day
windows for the stat strip only.

## 2. A non-OK POST is appended to `entries` as if it were a row, and `SessionRow` parses `sets` in render with **no error boundary anywhere in the app**

`:70–78` (esp. `:76–77`) · `:824` · `src/app/` has no `error.tsx` / `global-error.tsx`
**risk (high) · reasoned (writes are forbidden here, so not induced) · defect · minutes**

```ts
const entry = await res.json()          // :76 — res.ok never checked
setEntries(prev => [...prev, entry])    // :77
```
```ts
const sets: number[] = JSON.parse(entry.sets)   // :824, in the render body
```

On a 400/500 from `/api/lifts` the error body (`{ error: 'missing fields' }`) is
pushed into `entries`. It then reduces into `byExercise` under the key
`"undefined"` (`:135–138`), surfaces as a phantom exercise in the Ungrouped list
with `max NaN lbs` and `Invalid Date`, and the moment it is opened
`JSON.parse(undefined)` throws `SyntaxError` **out of render**. I grepped for
`componentDidCatch`, `ErrorBoundary`, `error.tsx` and `global-error.tsx` across
`src/` — **there are none** — so the blast radius is not the modal, it is the
whole App Router tree.

**What I tried to kill it with:** I checked whether the server could ever be the
source of a bad `sets` value. It cannot (see the answers above: totalReps is
derived, no UPDATE route, 36/36 rows clean). That rules out the database and
leaves exactly one producer of a malformed entry — this unchecked append. If the
POST *rejects* rather than returning an error body, `res.json()` throws instead
and you get issue 3.

**Fix:** `if (!res.ok) throw new Error(...)` in `logSession`, and a
`safeSets(entry)` helper that returns `[]` on a failed parse.

## 3. No write path has a try/catch: a failed submit leaves the form permanently stuck on "Saving…", and a partial multi-weight submit duplicates entries on retry

`:708–729` (loop at `:722–724`) · `:409–416` · `:59–68`
**risk · verified by reading · defect · ~1h**

`InlineLogForm.submit()` sets `saving` true, awaits, and calls `setSaving(false)`
only on the success path. Any rejected fetch (offline — this is a PWA) skips it:
the button stays `disabled` and labelled **"Saving…"** until the modal is closed
and reopened. `AddExerciseToGroup.submit` (`:409–416`) has the identical shape
with `adding`. The initial load (`:59–68`) is a bare `Promise.all().then()` with
no `.catch`, so one failed fetch leaves `loaded === false` and the spinner spins
forever.

Worse is the loop. Rows of differing weight (45 / 95 / 135 — a warm-up ramp)
become **N sequential POSTs**. If #2 fails, #1 is already persisted; the draft is
correctly *not* cleared (`clearDraft` is after the loop, `:725`) but the rows
still hold all three sets, so pressing "Finish session" again re-posts #1 →
**a duplicate `LiftEntry`**.

**What I tried to kill it with:** live data. 0 of 36 rows are part of a
multi-entry (date, name) group — every session logged so far used a single
weight, so neither the loop nor the duplicate has ever fired. Latent, not
historic.

**Fix:** wrap both submits in `try/finally`, and drop successfully-posted groups
from `rows` before re-throwing.

## 4. A running timer does **not** survive a top-level tab change, and both overlay components' comments say it does

`src/components/Shell.tsx:375` · `DockedStopwatch.tsx:4–6` · `FloatingStopwatch.tsx:5–7`
**risk · verified by reading · defect (docs) / taste (behaviour) · minutes**

```tsx
{activeTab === 'bevel' && (liftsActive || running) && ( … )}   // Shell.tsx:375
```

The `running` exemption sits **inside** the `activeTab === 'bevel'` gate, so it
only exempts Bevel *sub*-tab changes. Open Tasks mid-rest and the overlay
unmounts. The interval itself lives in the provider above `Shell`
(`stopwatch.tsx:52–57`), so no time is lost — but the count is gone from the
screen, which is the thing the exemption exists to prevent.

Two comments now state the opposite: `DockedStopwatch.tsx:4–6` — *"Rendered
globally by Shell so the timer stays visible when the user switches away from
the Lifts tab"* — and `FloatingStopwatch.tsx:5–7` — *"so it survives tab
switches"*. Both were true when Lifts was a top-level tab. The consequence is
that **dock mode has no remaining purpose**: a narrow right-edge strip exists to
be watched while you work elsewhere, and it is now visible only on the one tab
where the full floating widget is also available.

**Fix (one line, Connor's call which way):** change the gate to
`(activeTab === 'bevel' && liftsActive) || running`, or delete the two comments
and accept that dock mode is Bevel-only.

## 5. `assignExerciseToGroup` writes optimistically from closure-captured state, with no rollback and no `res.ok`

`:112–133` (`setGroups(updated)` at `:122`, PATCH loop `:123–132`)
**risk · verified by reading · defect (named rule) · ~1h**

`CLAUDE.md`: *"Optimistic writes use functional updaters `setX(prev => …)`,
never closure-captured state, plus a debounced PATCH, an `AbortController` and
an unmount `keepalive` flush."* This handler does none of the four: `updated` is
built from the render-scope `groups`, `setGroups(updated)` is a bare assignment,
each PATCH is awaited in sequence with its result discarded, and `prevGroups` is
captured at `:113` and then **never used** — there is no rollback path, so a
failed PATCH leaves the UI showing a membership the server does not have until
the next reload. Removing an exercise from a day is one tap with no confirm
(`:213`), which is defensible — it is a re-assignment, not a delete — but it
means the silent-revert case is the common one.

**What I tried to kill it with:** the double-tap race the functional-updater rule
exists for. I could not reach it: `AddExerciseToGroup` disables its button while
`adding`, and a second ✕ tap is a separate gesture at least one commit later, so
`groups` is fresh. The rule violation and the missing rollback are real; the
race is not.

**Fix:** `setGroups(prev => …)` and derive the PATCH payload inside the updater;
restore `prevGroups` if any PATCH returns non-OK.

---

## Secondary — real, but below the five above

- **`VolumeChart`'s per-point tooltip is hover-only** (`:629–631`, `onMouseEnter`/
  `onMouseMove`) and the delta pills carry `title=` (`:544`). On the phone PWA the
  per-session volumes are unreachable. Same class as the `hover:` rule in
  `CLAUDE.md`, though reading a data point is not a *primary* action.
- **That tooltip is `position: fixed` and not portaled** (`:645`), against the
  explicit `CLAUDE.md` rule; `ExerciseModal`'s `fixed inset-0` (`:462`) is
  likewise inside `.tab-fade`. Both are correct today only because the 220 ms
  animation is over before either can be opened. A `fill-mode: forwards` added to
  `.tab-fade` would break both silently.
- **`filledRows` requires `parseFloat(weight) > 0`** (`:693`), so a bodyweight
  exercise (0 lbs) can never be logged and the row is dropped with no message —
  the button just stays disabled. `min={0}` on the input says otherwise.
  0 live rows affected (`Pull Ups` is logged at 100).
- **`last7`/`last30` use `date >= subDays(today, 7|30)`** (`:292–293`) — inclusive
  of both ends, so 8- and 31-day windows — and count **distinct dates**, while
  `PageHeader` (`:302`) calls them "sessions".
- **The two `InlineLogForm` effects run in the wrong order on an `exName` change**
  (`:688` save, then `:691` reload): the save fires first with the *new* name and
  the *old* rows, writing the previous exercise's draft into the new key, which
  the reload then reads back. Unreachable today (the modal always unmounts between
  exercises) — the code is commented "defensive" and is the opposite.
- **`lift-draft-{date}-{exercise}` localStorage keys are never garbage-collected**
  (`:660–663`), and a draft typed at 23:59 becomes invisible at 00:00 because the
  key contains `today()`.

## Checked and clean — do not re-raise

- `sets` ↔ `totalReps` consistency (36/36 rows; derived server-side; no UPDATE route).
- Every delete goes through `useConfirm()` — `deleteGroup` (`:101`) and
  `SessionRow.handleDelete` (`:829`). No `window.confirm`, no inline
  `setConfirming`. `ConfirmProvider` is mounted at `app/layout.tsx:47`, so the
  `window.confirm` fallback at `ConfirmDialog.tsx:23` is unreachable.
- Both hover reveals carry the touch guard — `:215` and `:859`, exactly
  `opacity-100 sm:opacity-0 sm:group-hover:opacity-100`.
- Body-scroll locking nests correctly: `ExerciseModal` (`:456–459`) sets
  `hidden`, `ConfirmDialog` (`:58–63`) saves and restores the previous value.
- `POST /api/lift-groups` order race is already fixed (`$transaction`, `route.ts:19`).
- `BevelView.tsx:74–77` sets `liftsActive` with a correct cleanup, and Lifts is
  eagerly mounted (`:64`) so an in-progress draft survives a sub-tab switch.
