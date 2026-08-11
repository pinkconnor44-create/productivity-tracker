# 003 — `docs/BEVEL-OPEN-ISSUES.md` is entirely superseded, and three of its live claims are now false

**Verdict: STANDS — delete the file.** Both of its two issues are closed. Nothing
in it is unique except one table that is accurate but incomplete. Six of its
statements now contradict `HANDOFF.md`, `CLAUDE.md`, `src/lib/health.ts` or the
repository itself, which is a direct breach of the workspace rule *"supersede in
place — never leave two live claims that disagree."*

- **True severity:** `cleanup`, with one `risk` line inside it (see D3).
- **Defect or taste:** defect against the doc rules; the content is not a taste call.
- **Verified**, not reasoned — every claim below was checked against the file on
  disk or a `git` command, not against another document.
- **Effort:** minutes.
- **Fix, one line:** `git rm docs/BEVEL-OPEN-ISSUES.md` and repoint
  `HANDOFF.md:164` at its own `## ✅ RESOLVED 2026-08-09` section instead.

The file was last written `66292b4` (2026-08-09) and was **not touched by any of
`3d6672d`, `6c1d265`, `5e72bfc`, `2b84222`, `64d0b0f`** — confirmed by
`git log --oneline -- docs/BEVEL-OPEN-ISSUES.md`. It is a snapshot of a state
that no longer exists.

---

## Issue-by-issue

### Issue 1 — "HAE reports success but nothing arrives" — **CLOSED**

`docs/BEVEL-OPEN-ISSUES.md:8-98`.

Closed on 2026-08-09, one day after the file was written, and recorded at
`HANDOFF.md:209-233` under `## ✅ RESOLVED 2026-08-09 — the phone automation`.
The three stacked faults were: HAE Premium not active, HAE posting `GET /`
(rejected `413` at Vercel's edge, `source: "static"`), and the key arriving as
1 character against a 64-character secret.

The doc's entire "Still to check" ladder (`:28-52`) is answered — item 0
(*"Is HAE Premium actually purchased? **Check this first**"*) was the right call
and turned out to be true, which is exactly why keeping it as an *open* question
is misleading now.

### Issue 2 — "Recovery score does not match Bevel's" — **CLOSED as stated, replaced by a different open gap**

`docs/BEVEL-OPEN-ISSUES.md:102-154`.

Every mechanical claim in this section is now false:

| Doc claim | Current reality |
|---|---|
| `:113-118` recovery = HRV 0.50 + **Resting HR** 0.30 + sleep score 0.20 | `src/lib/health.ts:104-106` — `W_SLEEP_HR 0.60`, `W_SLEEP_HRV 0.35`, `W_SLEEP_RESP 0.05`. Resting HR is gone; respiratory rate is new. |
| `:117` last night's sleep score carries 0.20 | `src/lib/health.ts:107-111` — *"Sleep DURATION carries no weight. The fit was free to give it any share and chose zero… Kept out rather than kept at zero so nothing reads as a live input that isn't."* |
| `:119` `0.5(93)+0.3(77)+0.2(96.6) ≈ 89` | Arithmetic for a model that no longer exists. |
| `:121` *"The Recovery sub-tab already shows this breakdown"* | `src/components/bevel/BevelRecovery.tsx:125` still has *"How this score was reached"*, but it now names Sleeping heart rate / Sleeping HRV / Sleeping respiratory rate (`:53`, `:59`, `:65`). `3d6672d` fixed precisely this drift. |
| `:129-137` *"Probably the real one: HRV source… uses HAE's daily aggregate… fixable… storing samples rather than daily aggregates — a schema addition, not a rewrite"* | **Done.** `HealthSample` exists (`CLAUDE.md:36`, `prisma/schema.prisma`), `recoveryScore` takes `sleepHrv` (`health.ts:242-251`). The doc's own prescription was executed. |
| `:139-142` *"Today is a partial day… Any score for today is provisional until the day closes."* | **Now the opposite of the rule.** `health.ts:96-103` and `:257` — recovery is locked to the sleep window *by construction* and cannot move after waking. `CLAUDE.md:50-54`: *"Don't add a daytime reading back in; that was the bug."* |
| `:152-154` *"Do not tune the constants first."* | Already the standing rule at `CLAUDE.md:45-49` and `dev\TRAPS.md:137-140`. |

`:144-150` (sleep day attribution verified against Apple Health for Aug 4–7) is
still true and is already carried at `HANDOFF.md:189-191`.

The gap that *is* open is a different one: `RECOVERY_LIMIT` no longer means what
this doc implies. `src/lib/health.ts:154-169` now reads
`'baseline history, not the input'` — the input matches Bevel to 0.10 bpm over
nine nights; sleep-window baseline history only starts 2026-07-27. That is
already action item 2 in `HANDOFF.md:250-252`.

---

## Direct contradictions with `HANDOFF.md` / the repo

- **D1** `:3-4` *"Two unresolved items… **Nothing here is fixed**"* vs
  `HANDOFF.md:209` *"✅ RESOLVED 2026-08-09"*.
- **D2** `:59-60` *"**Still nothing arriving.** Prod row counts are unchanged
  from the backfill (1,708 metrics / 62 nights / 11 workouts) and
  `HealthImportLog` is **empty**"* vs `HANDOFF.md:138-139` *"✅ THE AUTOMATION
  WORKS. First successful automated import at 14:33 local."* Also live counts
  in a docs file, stale.
- **D3 — the one with a real cost.** `:160` *"Baselines full, not calibrating."*
  `HANDOFF.md:128-129`: daily baselines are full, **sleep-window baselines are
  not** — they start 2026-07-27 and *"[are] the whole of the remaining recovery
  gap."* The doc asserts as settled the exact thing that is currently the
  project's only open scoring defect, and the next planned action
  (`HANDOFF.md:250-252`, raw-sample export → refit) exists solely to fix it.
- **D4** `:159` *"91 days… (2026-05-09 → 2026-08-07)"* vs `HANDOFF.md:127`
  *"2026-05-09 → 2026-08-10."*
- **D5** `:162` *"`main` is 24 commits ahead of origin, never pushed."*
  `git rev-list --count origin/main..main` → **0**. `HANDOFF.md:115` records the
  push on 2026-08-07.
- **D6** `:84` table row — *"`No imports received yet` … item 0 above (Premium)
  stays the leading candidate"* — and `:90-92` *"⚠️ **Useless until deployed**"*.
  Both deployed and both answered.

**No contradiction with `CLAUDE.md`.** Note that the `CLAUDE.md` served in the
session-start context block is **stale** — it still says *"recovery scores the
day's minimum heart rate"* and *"Recovery cannot fully match Bevel without
sleep-window readings."* The file on disk (`CLAUDE.md:45-54`) was rewritten by
`3d6672d` and is correct. Do not raise the cached version as a finding.

---

## What I tried to kill it with

I went looking for surviving unique content that would justify keeping the file,
and for a reason the two issues might still be live.

1. **Is issue 1 actually still open?** No. `sourceOf()` at
   `src/app/api/health-import/route.ts:58-64` and the `· from phone` /
   `· manual backfill` render at `src/components/bevel/ImportStatus.tsx:66-67`
   only exist *because* imports now arrive and the question became "who sent
   this one" rather than "did anything arrive". The code postdates the issue.
2. **Is the diagnostic table at `:82-88` worth keeping?** It is the only part
   still string-accurate — `describe()` at `route.ts:44-47` really does emit
   `key absent` / `key N chars` / `ua …`. But it is now **incomplete**: it is
   missing the `not configured — HEALTH_IMPORT_KEY unset` reason
   (`route.ts:71`) and the whole `source` column added by `5e72bfc`
   (`schema.prisma:230`). A partial table inside a file whose framing is false
   is worse than no table.
3. **Is the rate-limit rationale (`:75-77`) unique?** No. It exists twice
   already, in the code that implements it (`route.ts:425-431`) and as a
   cross-project lesson at `dev\TRAPS.md:126-128`.
4. **Is the "fix the input before the weights" lesson unique?** No —
   `dev\TRAPS.md:129-140` carries it as a physiology trap, including the
   `+0.39 wrong sign` measurement.

Nothing unique survives.

---

## Consequence of the fix, and the one thing not to miss

`HANDOFF.md:164` currently reads *"See `docs/BEVEL-OPEN-ISSUES.md`
§ 2026-08-09."* Deleting the file leaves that pointer dangling. `overnight/map.md:47`
also lists the file. Both are one-line edits in the same change.

---

## Not run

`npx tsc --noEmit` was not run — this finding touches no TypeScript. `brief.md:3`
records it clean at review time, and nothing here changes code.
