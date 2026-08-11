# 04 — Fix the Scratchpad flush effect

**Severity** bug · **Effort** ~30min · **Approved** 2026-08-10
**Source** run-3 finding 4 · evidence `../overnight/audits/009-keepalive-flush.md`,
`../overnight/audits/015-scratchpad-autosave.md`

## Change

Move the flush effect off `[notes]` onto refs (`[]` deps plus a `notesRef`), null
`saveTimer.current` after clearing it, and drop the `notes !== ''` guard so
clearing persists.

## Where

`src/components/Scratchpad.tsx:168-182`

## Why

A cleanup-only effect with deps `[notes]`: its cleanup closes over the *previous*
render's notes and calls `clearTimeout(saveTimer.current)`, which is never nulled.
So every keystroke POSTs the prior value **and cancels the timer that keystroke
just scheduled**.

Consequences: the 800 ms debounce never fires (one Turso upsert per keypress); the
stored row is permanently one change event stale; **a trailing paste is lost
entirely**; and the `notes !== ''` guard means **clearing the notes never
persists**, though the API would accept it.

Two agents derived this independently and produced the identical trace.
`react-hooks/exhaustive-deps` would **not** flag it — `[notes]` is exactly what
that rule demands, which sharpens item 18 rather than duplicating it.

## Verify

Type a word, wait 1 s, reload — the full word is there. Clear the field, reload —
it stays cleared. Network tab shows one PATCH per pause, not one per keypress.
