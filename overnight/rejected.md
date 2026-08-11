# Rejected — productivity-tracker

**Permanent.** Read this before enumerating in `/overnight` and before promoting
in `/audit`. Everything here was investigated and killed **with evidence**. None
of it is re-raised; if one is ever reopened, it needs new evidence and a note
saying what changed.

_Migrated 2026-08-10 from the run-1→3 briefs, before `brief.md` / `map.md` /
`watch.md` were retired in favour of the `/overnight` → `/audit` pipeline._

---

## Declined by Connor — not a mistake, a decision

**Excused days count as misses in every habit percentage** (`HabitsView.tsx:57-72`).
Declined 2026-08-10. The 30-day card reading **65% (119/183)** rather than
**83% (118/143)** is the **intended** behaviour. ⚠️ Do not re-raise it, and do
not "fix" it as a side effect of work orders **03** or **08** — those touch the
same denominators.

## Killed by audit — with the evidence

1. **`no-store` on `/(.*)` kills caching of hashed chunks.** Production returns
   `public,max-age=31536000,immutable` for `/_next/static/**`; only the HTML
   document gets `no-store`. Correct for a PWA. *(verified against production)*
2. **The UTC-day bug in `/api/scores` drags down the calendar's monthly
   percentage.** `aggregatePct` is only called with `end = yesterday` over
   `summaryScores`, fetched with a browser-local `endDate`. The spurious day is
   fetched, never rendered, never summed. *(full path traced)*
3. **Task DELETE stamps `deletedAt` with the UTC day.** Both callers pass an
   explicit `?date=${today()}` from the browser — `CalendarView:247`,
   `TasksView:191`. The UTC default is unreachable.
4. **`monthly` recurrence is broken.** Unimplemented, but the UI cannot produce
   it. Recorded instead as the silent `default: return false` candidate.
5. **The service worker caches the app shell.** It caches nothing — `public/sw.js`
   has one `caches.match` read and **zero** writes, and has never had a different
   body since the initial commit.
6. **`useEffect` cleanup leaks.** 17 effects register something outliving the
   render; **16 return a matching cleanup.** No leak survives an unmount/remount
   cycle. *(The one real defect here was the Scratchpad flush effect, which is a
   wrong-value bug, not a leak — promoted separately.)*
7. **CSS token drift.** All five documented token rules **hold in the CSS** —
   `.glass` 62%/24px with correct prefix order, `primary.500 #8052ff`, `accent
   #ffb829`, zero live `violet-`, zero `dark:`, blooms static. The drift is
   entirely in the docs.
8. **`LiftEntry.sets` can disagree with `totalReps`.** No UPDATE route exists;
   36/36 live rows verify `sum(sets) === totalReps`.
9. **`DayScroller` needs an `AbortController`.** It contains no `fetch` —
   selection is a pure array lookup over already-loaded days.
10. **Dead UI primitives.** All 16 exported components have call sites outside
    the folder.
11. **Scratchpad cross-column clobber, and its delete paths.** The API does a
    conditional partial update and the two writers send disjoint bodies; both
    deletes go through `useConfirm()`.
12. **`ChartTip` trapped under a transformed ancestor.** `.tab-fade` has no
    `forwards`, so no containing block survives the animation.
