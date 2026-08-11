# 006 — API error handling: 11 routes with no `try/catch`

**Verdict: the fact is right, the frame is wrong. Re-pointed, kept, downgraded.**
The 11 routes really do contain zero `try`. But the missing `try/catch` is not
the defect — the read/write split that produces it is coherent and looks
deliberate. The defect is one layer down, in the client, and it is worse than a
missing handler: **one path wedges the UI permanently.**

- **True severity:** `risk` overall, with one `bug` inside it (LiftTracker, below).
- **Defect or taste:** the server-side asymmetry is **taste, and defensible**.
  The client-side `res.ok` gap is a **defect** — drift, not design.
- **Verified**, by reading every route, every call site, and Next's own 500 path
  in `node_modules`. Nothing was POSTed; no row was written. `npx tsc --noEmit`
  → exit 0.
- **Effort:** ~1–2h for the client fix; +30 min for the optional server hardening.

---

## What I tried to kill it with, and what survived

**Kill attempt 1 — "the wrapped routes prove the others are careless."** Dead.
The boundary is not route-by-route, it is **method-by-method inside the same
file**:

| File | GET | POST/PATCH/DELETE |
|---|---|---|
| `api/tasks/route.ts` | wrapped `:5–15` → returns `[]` | **not wrapped** `:20–44` |
| `api/habits/route.ts` | wrapped `:5–19` → returns `[]` | **not wrapped** `:21–42` |
| `api/scores/route.ts` | wrapped `:93–96` → returns `{}` | — (read-only) |
| `api/health/route.ts` | wrapped → shaped empty | — (read-only) |
| `api/scratchpad/route.ts` | wrapped `:11–14` | wrapped `:34–37` |
| `api/projects/*` | wrapped | wrapped |

Every wrapped read returns a **renderable empty payload** — `[]`, `{}`,
`{notes:'',checklist:[]}`. That is the actual purpose of those handlers: give the
renderer something to render. A write has no such payload, and `500` is the
correct answer for a write that failed. So `api/scores` and `api/health` are not
a "contrast" with the 11 — they are read-only routes and not comparable to a
`DELETE` handler.

`api/projects/*` is the only module that wraps writes, and comparing it to its
unwrapped twins shows exactly what the wrapper buys: a labelled `console.error`
and a JSON body. The status code is 500 either way, and `res.ok` is `false`
either way. **The wrapper changes client behaviour in exactly one situation**,
which is kill attempt 3.

**Kill attempt 2 — "Next's error boundary already handles it."** Dead, twice
over. There is no `error.tsx`, `global-error.tsx` or `not-found.tsx` anywhere
under `src/` (globbed). And it would not matter if there were: these are route
handlers, so the throw happens on the server, and React error boundaries do not
catch rejections from `fetch` inside event handlers either. Verified in Next
16.2.3's own source — `node_modules/next/dist/server/base-server.js:973–974`:

```js
this.logError(getProperError(err))
res.statusCode = 500
res.body('Internal Server Error').send()
```

**text/plain, never JSON.** (On Vercel `minimalMode` is true, so `:969` rethrows
and Vercel serves its own HTML `FUNCTION_INVOCATION_FAILED` page — also never
JSON.) The client `fetch` resolves normally with `res.ok === false`. No
unhandled rejection, no crash, no boundary. Whether the user sees anything is
decided **entirely by the call site**.

**Kill attempt 3 — "the call sites all check `res.ok`."** Dead for two of the
five views.

---

## So: what actually happens to the user

### `TasksView`, `HabitsView`, `ProjectsView` — covered, and it works
Every mutation checks `res.ok`, throws, and toasts. `TasksView:164, 173, 183,
192, 200, 208` · `HabitsView:182, 191, 199, 207, 214` · `ProjectsView:109, 132`.
A 500 here produces *"Failed to update task"* and the list refetches unchanged.
This is the reference implementation, and it is the answer to "is the
inconsistency deliberate": **the same functions exist in `CalendarView` with the
guard dropped.** Same author, same shape, half the checks. That is drift.

One caveat even here: `src/lib/toast.ts:1` offers only `'success' | 'info' |
'warning'`. **There is no error type.** Every failure in this app renders as the
same amber chip as *"Skipped for today"* and *"Task deleted"*.

### `CalendarView` — nine unchecked calls, five of which toast **success**
Only the two toggles are guarded (`:204`, `:219`, plus an in-flight `togglingIds`
guard at `:194`/`:213`). The rest:

| Line | Call | On a 500 the user sees |
|---|---|---|
| `:227` `saveNote` | `/api/notes` | **Worst.** Sets local state, **never refetches**. Note looks saved, survives until reload, then is gone. |
| `:235` `addTask` | `/api/tasks` POST | toast *"Task added"* — then the refetch shows no task |
| `:241` `skipTask` | `/api/task-skips` | toast *"Skipped for today"* — item still there |
| `:247` `deleteTask` | `/api/tasks/[id]` DELETE | toast **"Task deleted"** — task still on screen |
| `:253` `deleteHabit` | `/api/habits/[id]` DELETE | toast **"Habit deleted"** — habit still on screen |
| `:259` `skipHabit` | `/api/habit-skips` | toast *"Skipped for today"* — no effect |
| `:265` `updateTask` | `/api/tasks/[id]` PATCH | nothing; edit silently reverts |
| `:270–271` `replaceRecurringDay` | skip **then** create, both unchecked | if the skip lands and the create fails, **the day is skipped with nothing to replace it** — real data loss, no message |
| `:276` `updateHabit` | `/api/habits/[id]` PATCH | nothing; edit silently reverts |

The refetch means most of these self-correct within a second — so the symptom is
not silence, it is **a success toast contradicted by the list underneath it**.

### `LiftTracker` — nothing at all, and one path wedges the UI
`toast` **is not imported in this file** (checked: only `CalendarView`,
`HabitsView`, `ProjectsView`, `TasksView` import `@/lib/toast`). Five unchecked
calls: `:71, :81, :88, :107, :126`. Two of them call `await res.json()` on the
failure body — which is `Internal Server Error` or Vercel HTML, so it rejects
with a `SyntaxError`.

**This is the `bug`, and it is a stuck UI, not a silent no-op:**

```
LiftTracker.tsx:723   await onAdd(g.weight, g.reps)   // → logSession → res.json() rejects
LiftTracker.tsx:727   setSaving(false)                // never runs
LiftTracker.tsx:728   setOpen(false)                  // never runs
LiftTracker.tsx:815   disabled={saving || ...}
LiftTracker.tsx:817   {saving ? 'Saving…' : 'Finish session · N sets'}
```

Log a lift while Turso is unreachable and the **"Finish session" button reads
"Saving…" and stays disabled forever**. The sheet will not close, `clearDraft`
(`:725`) never runs, and the only escape is a reload. Same shape at `:412–415`
(`setAdding(false)` unreachable) and at `:93` (`createGroup` reads `group.id`
off a value that never arrived).

The two deletes (`:81`, `:107`) are the mirror image: optimistic removal with
**no refetch**, so the row vanishes from the UI, stays in the DB, and reappears
on the next mount.

---

## Ranking the 11 by how likely a throw actually is

Every one of them shares one dominant trigger — **Turso unreachable or timing
out** — which hits the eight wrapped routes identically and is therefore not a
discriminator. Ranked on *route-specific* causes on top of that:

1. **`lifts/[id]/route.ts:6`** — `liftEntry.delete` with no existence check →
   `P2025` on any repeat delete. Reachable from a stale PWA tab on the phone
   after the entry was deleted on desktop. Client removes optimistically with no
   refetch, so the divergence is invisible.
2. **`lift-groups/[id]/route.ts:23`** — same bare `delete` → `P2025`. Gated by
   `useConfirm`, so a same-client double-tap is harder.
3. **`tasks/[id]/route.ts:26`** — `body.title.trim()` with no type guard: a
   caller sending `title: null` is a `TypeError`. Plus `update` → `P2025` on an
   already-soft-deleted row, plus `parseInt(idStr)` → `NaN`. Widest surface here.
4. **`habits/[id]/route.ts:16, 32`** — `name.trim()` unguarded; `update` →
   `P2025`.
5. **`habit-skips/route.ts:7`** and **`task-skips/route.ts:7`** — **zero
   validation.** `habitId`/`date` go straight into a compound-unique `where`;
   `undefined` there is a `PrismaClientValidationError`. Their siblings
   `habit-completions:9` / `task-completions:9` return a clean **400** for
   exactly that input. Same shape, opposite answer, adjacent files — this is the
   real inconsistency in the set, not the `try/catch`.
6. **`habit-completions/route.ts:22`** and **`task-completions/route.ts:21`** —
   the double-tap `P2002` the item names. **Near the bottom, not the top.**
   Read-then-create only races if two requests *overlap*; an ordinary fast
   double-tap resolves as create-then-delete, which is a normal toggle, not an
   error. `CalendarView:194/:213` guards it with `togglingIds`; `HabitsView:188`
   `toggleToday` has **no** in-flight guard, so it is the one reachable spot —
   and only if the second tap lands inside one Turso round trip.
7. **`lifts/route.ts:37`** — `parseFloat(weight)` → `NaN` into a Float column.
   Caller passes an already-typed number.
8. **`notes/route.ts:35`** — `upsert` → `P2002` race on `date`. Single user,
   debounced. Near-unreachable.
9. **`lift-groups/route.ts:9`** — `JSON.parse(g.exercises)` on a corrupt column.
   Only writer is `JSON.stringify` at `[id]:15`.
10. **`lifts/route.ts:13`** and **`notes/route.ts:13`** (the GET halves) — plain
    `findMany`. **No route-specific failure mode at all.** These two do not
    belong in the finding.

---

## The fix

**Do not add `try/catch` to the 11.** Add the missing `if (!res.ok) throw new
Error()` to the nine `CalendarView` calls (`:227, 235, 241, 247, 253, 259, 265,
270, 271`) and the five `LiftTracker` calls (`:71, 81, 88, 107, 126`), move each
success toast inside the success branch, and give `src/lib/toast.ts` an
`'error'` type so a failure does not look like a notice.

Optional, ~30 min: swap the six bare `delete`/`update` calls in `lifts/[id]`,
`lift-groups/[id]`, `habits/[id]` and `tasks/[id]` for `deleteMany`/`updateMany`,
so a repeat delete is a no-op instead of a `P2025`. That removes the single most
likely route-specific throw without a single `try` block.

**Effort:** ~1–2h.

## What this does not settle

`LiftTracker.tsx` and `CalendarView.tsx` were read only at their fetch call sites
and the specific line ranges quoted above — neither has had the line-by-line
review that `brief.md`'s resume list still has open under **J** and **K**.
