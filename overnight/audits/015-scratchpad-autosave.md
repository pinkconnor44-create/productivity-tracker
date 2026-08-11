# 015 — Scratchpad autosave: the headline is already finding 009; two smaller defects beside it are not

**Verdict on the item as posed:** the autosave defect is **real and already
written up in `overnight/findings/009-keepalive-flush.md` §2**, in more detail
than this item asked for. I re-derived it independently from the source before
opening 009 and reached the identical trace, so treat 009 as **confirmed by a
second reading**, not as an unverified claim. **Do not raise it twice.**

Of the three questions this item asked, **two are killed** (no cross-column
clobber; both delete paths are compliant), and the one that stands is 009's.
Two defects in the same file that 009 does **not** cover are raised below.

**Verified by reading**, not by driving a browser — every write path here hits
the shared production Turso row (`Scratchpad id: 1`), so typing into the
scratchpad to observe it is a production write. `tsc` not re-run; it is
irrelevant to all three items and the brief already records it clean.

## Correction to the item's premise

The item hypothesised *"if the debounce is 800 ms and there is no flush, up to
800 ms of typing is lost per tab switch."* Both halves are wrong, in a worse
direction:

- **The 800 ms debounce (`Scratchpad.tsx:59`) never fires at all.** The flush
  effect at `:168-182` carries deps `[notes]`, so its cleanup runs on **every
  keystroke**, and the cleanup calls `clearTimeout(saveTimer.current)`
  (`:179`) on the timer the same keystroke just scheduled. `saveTimer.current`
  is never nulled, so it is permanently truthy after keystroke one.
- **So the loss is not a 800 ms window — it is unbounded in time.** The cleanup
  POSTs the *previous* render's `notes`, so the stored row is permanently one
  change event stale, and stays stale until the next change event. Type
  `buy milk`, walk away for a day, reload → the row holds `buy mil`.
- **Magnitude is one change event, not one character.** A change event is one
  keystroke *or one whole paste*. Paste as the last action and the entire block
  is never sent.
- **The trigger is not tab-away.** `Shell.tsx:110,141-143` grows a mounted-tab
  `Set` and hides inactive tabs with `className="hidden"` (`:362`);
  `docs/NOTES.md:17` states the keep-mounted rule outright, and `Scratchpad` has
  exactly one mount site (`CalendarView.tsx:350`, unconditional). **Nothing in
  this app unmounts it**, so the `keepalive` flush is unreachable and tab-away
  loses nothing extra — the row was already stale. The action that exposes it is
  **reload / tab close / iOS killing the backgrounded PWA**, and there is no
  `pagehide`, `visibilitychange` or `beforeunload` anywhere in `src/` (grep: 0
  hits; the only 3 `keepalive` hits are `Scratchpad:176` and
  `ProjectsView:194,203`).

All of the above is §1 and §2 of finding 009, including the consequence I had
not reached — the `notes !== ''` guard at `:170` means **erasing the notes never
persists the empty value**. Severity, fix and effort: as stated there.

## Killed — question 2: concurrent note and checklist saves cannot clobber each other

`src/app/api/scratchpad/route.ts:28-31` does a **conditional partial update**:

```js
update: {
  ...(notes    !== undefined && { notes }),
  ...(checklist !== undefined && { checklist: JSON.stringify(checklist) }),
}
```

`handleNotesChange` (`:54`) sends `{ notes }` only and `saveChecklist` (`:65`)
sends `{ checklist }` only, so neither request names the other's column and
Prisma emits an `UPDATE` touching one column. There is no whole-row
last-write-wins. **Not a finding.**

Residual, narrow enough to note and not raise: the `create` branch (`:22-26`)
defaults the *other* column, so if row 1 did not exist, two concurrent
first-ever POSTs would each `create` and one would land with an empty
counterpart. Reachable only on a database with no scratchpad row, once.

## Killed — question 3: both delete paths go through `useConfirm()`

`:84` takes the hook from `@/components/ui`; `deleteItem` (`:85-93`) and
`clearDone` (`:96-105`) both `await confirm({…})` and return early on `!ok`.
No `window.confirm`, no inline `setConfirming`. Rule satisfied.

## New — not in 009, not in `brief.md`

### A. The load fetch has no `.catch`, so an offline PWA shows a spinner forever — `risk` · ~10 min

`Scratchpad.tsx:35-43`. The chain is
`fetch(...).then(r => r.json().catch(fallback)).then(setLoaded(true))`. The
`.catch` guards only the **JSON parse**. If the *request* rejects, `setLoaded`
never runs and `:184-188` renders the spinner permanently — the whole scratchpad
column on the Calendar tab is a spinning circle with no error, no retry and no
offline copy of the user's own notes.

Reachable, and this is a PWA: `public/sw.js:9-13` sends anything containing
`/api/` straight to `e.respondWith(fetch(e.request))` with **no `.catch`**, so
offline the request rejects rather than falling back to cache. Same outcome on
a Turso outage — `route.ts:14` returns HTTP 500 with a valid JSON body, which
*does* parse, so that path degrades to blank-notes rather than a hang.

**Fix, one line:** append
`.catch(() => setLoaded(true))` to the load chain (and ideally surface a retry).

### B. Every checklist mutation is closure-captured, against the `CLAUDE.md` functional-updater rule — `risk` (latent) · ~20 min

`saveChecklist(items)` (`:63`) takes an already-computed array; all six callers
build it from the render closure — `addItem:75`, `toggleItem:81`,
`deleteItem:93`, `clearDone:105`, `commitEdit:117`, `handleDrop:150`. `CLAUDE.md`
requires `setX(prev => …)` explicitly, *never* closure-captured state.

The two that matter are `deleteItem` and `clearDone`: they read `checklist`
**before** `await confirm(...)` and write the derived array **after** it — a
genuine async read-modify-write gap, and the only such gap in the file.

**What I tried to kill it with, and it survived only as latent:**
`ConfirmDialog.tsx:66-68` portals a `fixed inset-0` backdrop over the page and
sets `body.overflow = 'hidden'`, and the confirm button is `autoFocus`ed with
Enter/Escape bound — so no checklist control can be clicked while the dialog is
open, and I could not construct a UI path that mutates `checklist` inside the
gap. **Unreachable today**; it is the "a client-side guard makes a real flaw
unreachable" pattern the brief already names as this codebase's dominant one.
Also unwritable *by* the second device: a stale array simply overwrites.

**Fix, one line:** have `saveChecklist` take an updater
(`saveChecklist(prev => prev.filter(...))`), resolving the array inside
`setChecklist` and POSTing from there.

### C. No write in this file checks its response — `cleanup` · minutes

`:54` (debounced notes), `:65` (`saveChecklist`) and `:172` (flush) all ignore
the result; `:65` `await`s it and discards it. `route.ts:35-36` returns **200-
shaped JSON on the 500 path** (`{notes:'',checklist:[]}` with `status: 500`), so
a failed save is indistinguishable from a good one and the header still reads
*"auto-saved"* (`:208`). Combined with A, a user can add checklist items against
a dead API and see nothing wrong until reload. Roll into the fix for A.

## Defect or taste

**A** and the 009 headline are defects — silent data loss / a permanent hang
with no error surface. **B** is a rule violation with no live trigger, so it is
a hardening item. **C** is taste until A is fixed, then it is the other half of
the same fix.

## Effort

009 owns its own estimate. A + C together ~20 minutes; B ~20 minutes. All three
are in one 337-line file and should be done in one pass with 009 §2, which
rewrites the same effect.
