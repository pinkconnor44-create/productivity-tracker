# 002 — `update.md` at the repo root

**Verdict:** `refined` — the file does not earn its place, but **5 of its 31
lines are live and recorded nowhere else**, so "delete it" alone loses real
information.

**Severity:** `cleanup` · **Verified** (git history + grep + read against
current source) · **Defect**, not taste — a still-accurate known-issues list
sitting in a file nothing references is the exact failure the project's own doc
rules exist to prevent.

**File:** `update.md:1-31` (repo root, 4,527 B, tracked).
Live remainder: `update.md:26-30`.

---

## What it is

A `# Update log` with **exactly one entry**, `## 2026-05-11 — UX pass + bug
fixes`, in four sections: Features (6), Bug fixes (10), Deferred / known issues
(4).

It was created in a single commit and **never touched again**:

    $ git log --follow --format="%h %ad %s" --date=short -- update.md
    eddeb80 2026-05-11 cleanup: z-index drift, theme-aware chart colors, abortable fetches, lift-groups race

    $ git rev-list --count eddeb80..HEAD
    41

41 commits and three months (2026-05-11 → 2026-08-10) with no second entry. A
changelog convention that was started once and abandoned.

## What I tried in order to kill it

1. **Referenced anywhere?** Repo-wide grep for `update.md` returns only
   `overnight/candidates.md` (this review). `CLAUDE.md`'s `See also` line lists
   `HANDOFF.md · docs/NOTES.md · docs/DESIGN.md · dev\TRAPS.md` — not this.
2. **Is git already the changelog?** Largely yes. `eddeb80`'s own commit message
   reproduces the Bug-fixes section almost verbatim (z-index ladder, `#7c3aed`
   → `var(--c-p-hex)`, AbortController, defensive `clearInterval`,
   `visibility:hidden`, Safari try/catch, `$transaction` on lift-groups) and
   even ends *"Adds update.md documenting today's pass and deferred items"*.
   The file is a second copy of the commit message it shipped in.
3. **Is the one durable invariant duplicated?** Yes. The n-1 rule — the most
   valuable line in the Features section — is written into all three consumers
   as comments naming it:
   - `src/components/HabitsView.tsx:55` — `// Exclude today (n-1 rule): …`
   - `src/components/CalendarView.tsx:124` — `// n-1: aggregate windows end at yesterday …`
   - `src/components/StatsView.tsx:181` — same comment
   Deleting the file loses nothing here.
4. **Duplicated in `HANDOFF.md` / `docs/` / `plan.md`?** No — grepped all of
   them plus `overnight/brief.md` for `parseInt`, `try/catch`, `N+1`,
   `400 completion`, `n-1`, `excludes today`: **zero hits**. This is what stops
   the kill.

## Is it current?

**Two claims are now false.** `update.md:18` justifies the chart-color fix as
*"wouldn't recolor with the accent theme"* and `:23` justifies the Settings
try/catch as *"could prevent theme load"*. `CLAUDE.md` states there is **no
accent-theme switcher** — it was deleted, nothing sets `data-theme`, and
`src/components/SettingsView.tsx:12` carries the comment confirming the
`accent-theme` key is inert. A dated log entry may fairly describe 2026-05-11,
but the file carries no "historical, do not trust" header, so both read live.

**The Deferred section is entirely still true.** All four verified against
current source:

| `update.md` line | Claim | Verified today |
|---|---|---|
| :27 | API routes don't wrap `req.json()` / Prisma mutations | 16 `await req.json()` sites across `src/app/api`; only 10 of 19 `route.ts` files contain the string `try` at all. `habits`, `tasks`, `lifts`, `notes`, `task-completions`, `habit-skips` … are bare. |
| :28 | `parseInt(idStr)` → `NaN` on malformed params | 5 sites (`habits/[id]:9,31`, `tasks/[id]:17,53`, `lifts/[id]:6`). **Zero `isNaN` / `Number.isInteger` guards anywhere under `src/app/api`.** |
| :29 | N+1 / fat include on `/api/scores` and `/api/habits` | `src/app/api/habits/route.ts:10` — `completions: { orderBy: {date:'desc'}, take: 400 }`; `:39` — `include: { completions: true, skips: true }` unbounded. `scores/route.ts:27,40` still nested includes. |
| :30 | `useStopwatch().start()` re-created every 100 ms tick | `src/lib/stopwatch.tsx:52-57` — `const start = useCallback(…, [ms])` with `ms` updating on a 100 ms interval. Unchanged. |

None of these appears in `overnight/brief.md` (findings 1–10, Also-noticed, or
Rejected), so this file is currently the sole record of four live defects.

## Does it earn its place at the root?

No. It breaks the project's own layout rules in two directions at once: it is
**state** (a live known-issues list) that `CLAUDE.md`/`dev\CLAUDE.md` say belongs
in `HANDOFF.md`, wrapped in **historical narrative** that belongs in git. And
because nothing links it, the four live defects have been invisible for three
months — the "an outstanding-items list nobody reads teaches you to stop
reading it" problem, one level worse.

`HANDOFF.md` is 272 lines against a 300 cap, so the four items cannot simply be
pasted in; they are not session state either. `docs/` is the right home.

## Fix

Move `update.md:26-30` (the four deferred items, verbatim) into a general
`docs/OPEN-ISSUES.md`, then `git rm update.md` — history stays in `eddeb80`.

**Effort:** ~15 minutes.

## Adjacent, not part of this item

`docs/BEVEL-OPEN-ISSUES.md:1-4` still opens *"Two unresolved items … Nothing
here is fixed"*, while `HANDOFF.md:209` marks the same automation issue
**RESOLVED 2026-08-09**. Two live claims that disagree. Relevant only because it
is the file a naive "put the deferred items in the existing open-issues doc"
fix would target — that doc is Bevel-scoped and itself stale, so use a new
`docs/OPEN-ISSUES.md`.
