# 007 — the AbortController rule holds everywhere it was written, and CalendarView was never written

**Verdict:** the rule is **held at 3 of 4 surfaces that need it**. The three
guarded surfaces (`Shell`, `bevel/shared`, `ProjectsView` checklist) are the
only ones anyone thought about; the fourth — `CalendarView` — has **17 fetch
calls and zero guards of any kind**, and it is the one view in the app whose
reads are keyed by a user-controlled request key (month / week / day) that the
user can change faster than Turso answers.

**The item's stated hypothesis is dead.** Bevel day scrubbing issues **no
request at all**, and `StatsView` issues exactly one request in its entire
lifetime. Both were killed before writing (§ *What I tried to kill it with*).
The surviving hazard is **calendar month navigation**, which the item did name.

**Severity: `risk`.** A stale response blanks the scores and note dots for the
month on screen — silently, indistinguishably from a month with nothing
recorded, and it does not self-heal. **One escalation path reaches `bug`** (§3):
both completion endpoints are *toggles*, so a stale read that visually un-ticks
a box invites a corrective re-click that **deletes the real row**.

**Verified by reading** for the absence of guards, the response scoping, and the
render path — all traced to source below. **Reasoned, not observed** for the
response-ordering inversion itself: two independent HTTP requests have no
ordering guarantee, and I cannot drive a browser here. `npx tsc --noEmit`
**clean, exit 0**. Nothing was changed.

**Correcting the item's premise:** `grep -o "fetch(" src/components/*.tsx | wc -l`
= **53** (54 including `bevel/`). `AbortController` appears in **three** files,
not two — the missed one is `src/components/bevel/shared.tsx:55`, which is the
best-written fetch in the repo and covers the whole Bevel surface single-handed.

## Inventory — every fetch read in `src/components`, and what guards it

| Site | Request key | Refetched? | Guard | Verdict |
|---|---|---|---|---|
| `Shell.tsx:155` scores | none | every tab change + `score-refresh` | **AbortController** | correct |
| `bevel/shared.tsx:65` health | `days` | window widen + `score-refresh` | **AbortController** + `aborted` check + offscreen skip | correct |
| `ProjectsView.tsx:62` projects | none | **never** (`useCallback([])`, called only at `:71`) | none needed | safe |
| `Scratchpad.tsx:36` | none | never (mount only) | none needed | safe |
| `StatsView.tsx:175` scores | none | **never** — deps `[]` | none needed | safe |
| `LiftTracker.tsx:61,62` | none | **never** — deps `[]` | none needed | safe |
| `TasksView.tsx:140` tasks | none | after **every** mutation (6 sites) | **none** | § 3 |
| `HabitsView.tsx:159` habits | none | after **every** mutation (5 sites) | **none** | § 3 |
| `CalendarView.tsx:130` tasks+habits | none | nav **and** every mutation (10 sites) | **none** | § 3 |
| `CalendarView.tsx:140` summary | none | nav + every mutation | **none** | minor, self-heals |
| `CalendarView.tsx:154,155` scores+notes | **`(currentDate, view)`** | **every month/week/day navigation** | **none** | § 1 — the finding |

Writes are a separate class and are mostly fine: `CalendarView`'s mutations
await the server and refetch rather than writing optimistically, so there is no
closure-captured optimistic state to lose. Two write-side gaps are noted in § 4.

## 1. `CalendarView.tsx:144-159` — a keyed read with no key check — `risk`

```js
const fetchScores = useCallback(async () => {
  …                                        // start/end derived from currentDate + view
  const [scoresRes, notesRes] = await Promise.all([
    fetch(`/api/scores?startDate=${start}&endDate=${end}`),
    fetch(`/api/notes?startDate=${start}&endDate=${end}`, { cache: 'no-store' })
  ])
  if (scoresRes.ok) setScores(await scoresRes.json())     // ← no key check, no signal
  if (notesRes.ok) setNotes(await notesRes.json())
}, [currentDate, view])

useEffect(() => {
  setLoading(true)
  Promise.all([fetchData(), fetchScores(), fetchSummary()]).finally(() => setLoading(false))
}, [fetchData, fetchScores, fetchSummary])              // ← no cleanup at all
```

`navigate()` (`:171-179`) calls `setCurrentDate`, which changes `fetchScores`'s
identity, which re-runs the effect. The effect returns **no cleanup function**,
so nothing aborts, nothing ignores, and nothing records which window the
response belongs to.

### The concrete sequence

1. Open Calendar on **August** (month view). Effect run A issues
   `GET /api/scores?startDate=2026-08-01&endDate=2026-08-31` + the matching notes.
2. Within ~200 ms, click **←** twice: → July, → June. Effect runs B and C fire.
   Three `/api/scores` requests and three `/api/notes` requests are now in
   flight; the header reads **June**.
3. Response **C (June)** returns first — cheap query, warm lambda. `scores` =
   June. Correct.
4. Response **A (August)** returns last — its request happened to land on a cold
   serverless instance. `setScores(augustData)`.
5. The header still says **June**, and `MonthView` now renders June from a
   Record whose only keys are August dates.

### What the user sees, and why it is deceptive

`MonthView.tsx` — `CalendarView.tsx:440` `const score = scores[date]`, `:455`
`const sc = score && !isFuture ? scoreColor(score.pct) : null`, `:475`
`{notes[date] && <span … bg-amber-400 …/>}`.

Every June cell gets `score === undefined` → no score colour, no hairline
percentage, no note dot. But `tasks` and `habits` are **unkeyed** — they cover
all dates — so the cells still render their event ribbons and titles. **The
month looks fully populated and reports 0% on every single day.** That is not a
visibly broken state; it reads as "I did nothing in June".

**It does not self-heal.** `CalendarView` fetches only when
`[fetchData, fetchScores, fetchSummary]` change, or after a mutation. Sitting on
June, the wrong data stays until the user navigates again or ticks something.

### Kill attempt: does the response contain more than the month?

No. `src/app/api/scores/route.ts:56-90` walks `let current = startDate` …
`while (current <= actualEnd)` and writes `scores[date]` only inside that loop,
so the payload's key set is exactly the requested range.
`src/app/api/notes/route.ts:13-21` filters `date: { gte: startDate, lte: endDate }`
identically. The overwrite is total, not a merge. **Kill failed.**

## 2. Two more kills that failed

- **"`loading` gates the render."** `if (loading) return <Loading/>` at `:280`.
  `loading` is set false by `.finally` on **whichever** `Promise.all` settles
  first (`:163`), which under this race is run C. Run A then resolves into a
  rendered tree. The flag sequences nothing.
- **"`key={navKey}` remounts the grid."** It does (`:336`), and it is irrelevant:
  `scores` and `notes` are parent state. A remounted child re-reads the same
  poisoned object.

## 3. Unkeyed refetch + toggle endpoints — the escalation — `risk`, boundary `bug`

`TasksView.tsx:139-144`, `HabitsView.tsx:158-163` and `CalendarView.tsx:129-136`
all refetch the *whole* collection after every mutation, unawaited and
unguarded — e.g. `HabitsView.tsx:188-195`:

```js
const res = await fetch('/api/habit-completions', { … })   // toggle
if (!res.ok) throw new Error()
fetchHabits()                                              // fire-and-forget, no guard
```

Tick five habits in quick succession and five overlapping `GET /api/habits` are
in flight, each a full snapshot including every completion. If snapshot #3
(taken before ticks #4 and #5) resolves last, habits 4 and 5 render **unticked**.

The escalation: `src/app/api/habit-completions/route.ts` is a **toggle** —
*"if exists, delete it; if not, create it"* (`:19-27`). `/api/task-completions`
is the same shape. So the user, seeing an unticked box they know they ticked,
clicks it again — and that click **deletes the completion that was correctly
recorded**. Score for the day drops, and nothing anywhere says why.

Neither view de-dupes clicks either (`CalendarView` does, via `togglingIds`
`:192-195`, with correct functional updaters). This is one guard short of a
silent data-loss loop.

## 4. Write-side, noted not raised

- `ProjectsView.tsx:150` — the debounced notes PATCH has **no**
  `AbortController` while the checklist PATCH at `:216-226` in the same file
  does, with a comment explaining why. Inconsistent within one file, and the
  rule names both. **Taste, not defect**: aborting a PATCH does not un-send it,
  so abort is a client-side ordering nicety here, not a real serialisation.
  (Already listed as adjacent in finding 009.)
- `Scratchpad.tsx:63` `saveChecklist(checklist.map(…))` reads **closure-captured
  state**, violating the first clause of the same `CLAUDE.md` sentence, and
  POSTs with no debounce, no abort and no ordering. Adjacent to 007, belongs to
  the "functional updaters" clause.
- § 1's stale `setNotes` is the upstream cause of the `NoteEditor` clobber that
  finding 009 records at `CalendarView.tsx:1020` — a stale notes payload flips
  the `note` prop, the `[note]` effect resets `value` **and** `savedValue.current`,
  and typed text is dropped without a save. Fixing § 1 removes the worst input to it.

## What I tried to kill it with

- **"Bevel day scrubbing races."** **Dead.** `bevel/DayScroller.tsx` contains no
  `fetch` — `onSelect` (`:110`) is pure state over `data.days`, already loaded,
  and `dayOf` (`shared.tsx:118`) is an array lookup. Sub-tab switching in
  `BevelView.tsx:65-68` fetches nothing. Widening the window (`:81-84`) goes
  through `useHealthData`, which aborts. Bevel is the **best**-guarded surface
  in the repo; the item's highest-risk guess is its safest view.
- **"`StatsView` races on the range picker."** **Dead.** `StatsView.tsx:171-178`
  has deps `[]` — one request, ever. The 30/90/365 control only changes `range`,
  and `chartData` (`:188-193`) slices `scores365` client-side. Nothing refetches.
- **"`LiftTracker` races."** **Dead.** `:59-68` deps `[]`; every mutation
  (`:77`, `:82`, `:94`, `:108`) is a local functional updater. Never refetches.
- **"`ProjectsView`'s read races."** **Dead.** `fetchProjects` appears at exactly
  two lines — its definition `:61` and `useEffect(… , [fetchProjects])` `:71`,
  with `useCallback([])`. Mount only.
- **"The response is a superset, so the overwrite is harmless."** **Dead** — both
  routes filter to the requested range (§ 1).
- **"`loading` / `key={navKey}` save it."** **Dead** (§ 2).
- **"Already raised."** Checked `brief.md` (findings 1–10, `## Rejected` 1–4,
  `## Also noticed`), `HANDOFF.md`, `TRAPS.md`, and `findings/009`. Finding 1
  names `AbortController` only as a class the missing linter cannot see and
  asserts nothing about whether the guards exist; 009 covers the *unmount flush*
  clause. Nothing covers stale-read ordering. **Not a duplicate.**

## Defect or taste

**Defect** for § 1 and § 3 — `CLAUDE.md` states the guard as a rule, three
components implement it with comments explaining exactly this hazard
(`Shell.tsx:146-147`: *"so an older in-flight request can't overwrite newer
data when the user tab-switches faster than scores resolve"*), and the largest,
most-navigated view has it nowhere. The hazard is understood in this codebase;
it simply was not applied to the file that needs it most.

**Taste** for § 4's `ProjectsView` notes asymmetry.

## Fix, one line

Lift `bevel/shared.tsx`'s pattern into a shared `useKeyedFetch` (abort the
previous request in a ref, and drop any response whose `signal.aborted` is set)
and route `CalendarView`'s three loaders plus `TasksView`/`HabitsView`'s
collection refetch through it — or, minimally, a `useRef` generation counter
bumped on entry with `if (myGen !== gen.current) return` before each `setState`.

**Effort:** ~1 h for `CalendarView` (3 loaders, 4 `setState` sites), ~15 min
each for `TasksView` and `HabitsView`; ~2 h with the shared hook and the
`ProjectsView` notes symmetry. Verification needs a browser with throttled,
jittered network — not runnable here.
