# 017 — three of the four orrery gates are real; the IntersectionObserver is real code that gates nothing

**Verdict:** none of the four conditions is aspirational. All four exist as
executable code, and the bundle claim is **measured**, not reasoned — the
`.next/` tree on disk was built 2026-08-10 17:42 against orrery sources last
touched 2026-08-07, so it is current. `three` is isolated in exactly one chunk
that is reachable only through a promise-returning loader.

The finding is narrower than "is it enforced": **the IntersectionObserver
defers nothing.** `OrreryHero` is the first element rendered by `CalendarView`
(`CalendarView.tsx:289`), and `calendar` is the hard-coded default tab
(`page.tsx:15`), which `Shell` mounts immediately (`Shell.tsx:110`). So the
observed node is on screen at scroll-top on every desktop app load, the gate
passes at once, and **347 KB gzipped / 1.15 MB raw of WebGL downloads
automatically on every desktop session**, without the user scrolling, clicking
the Calendar tab, or opting in. `CLAUDE.md`'s literal words ("never the initial
bundle") hold; the thing the words are for — you don't pay for it unless you
look at it — does not, on desktop.

**Severity: `cleanup`.** No user-visible break, no data at risk, desktop-only,
and it is a personal PWA. **Defect or taste: taste**, with one factual defect
attached (the size comment is wrong by 2×).

---

## Condition-by-condition

### 1. `dynamic()` with `ssr: false`, not a static import — **PASS, verified**

`src/components/orrery/OrreryHero.tsx:9`

```js
const Orrery3D = dynamic(() => import('./Orrery3D'), { ssr: false })
```

The only other reference to the module is `OrreryHero.tsx:4`
`import type { OrreryScores } from './Orrery3D'` — a type-only import, erased at
compile time, so it opens no runtime edge.

**What I tried to kill it with:** grepped all of `src/` for
`three|@react-three|drei` — hits in exactly two files, `Orrery3D.tsx` (the five
package imports, lines 3–6) and `OrreryHero.tsx` (the comment and the type
import). Grepped `src/` for `dynamic\(|next/dynamic|React.lazy` — **two hits,
both line 3 and line 9 of `OrreryHero.tsx`**. There is no second, static path to
`Orrery3D` anywhere in the tree, and no other lazy boundary in the app to
confuse it with.

**Fix:** none needed. **Effort:** n/a.

### 2. A real IntersectionObserver, not a `useState` toggle — **PASS as code, VACUOUS in place**

`src/components/orrery/OrreryHero.tsx:36-44`

```js
const io = new IntersectionObserver(
  ([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect() } },
  { rootMargin: '150px' },
)
io.observe(node)
return () => io.disconnect()
```

Genuine constructor, genuine `observe`, disconnect-on-first-hit, cleanup on
unmount, keyed off a ref-callback node (`:27`, `:103`) rather than a `useRef`,
so it cannot observe `null`. As a piece of code this is not a fake.

It is structurally unable to defer anything:

| Link | Evidence |
|---|---|
| Calendar is the landing tab | `src/app/page.tsx:15` — `useState<Tab>('calendar')`, a literal. No `localStorage`, no hash, no `searchParams` in the file (grepped). |
| The landing tab mounts at once | `src/components/Shell.tsx:110` — `useState<Set<Tab>>(() => new Set([activeTab]))` |
| The hero is the first child | `src/components/CalendarView.tsx:289` — first element inside the returned `<div>` at `:285` |

So the observed node sits at scroll-top of the page the app opens on. It
intersects on its first observation, every time.

The one thing that delays it: `CalendarView.tsx:280` returns a loading
placeholder until the initial fetches resolve, so the hero mounts after first
data rather than at first paint. That is a delay of a few hundred ms, not a
gate.

**What I tried to kill it with:** looked for tab persistence or deep-linking
that would let the app open on a non-Calendar tab and make the observer
meaningful — none exists; `activeTab` is a hard-coded initial state and nothing
restores it. Checked whether the hero might be below the fold on a short
desktop window — it is the first element and the container is `h-[380px]`
(`:105`), so no. Checked `rootMargin: '150px'` — it only widens the trigger.

**Defect or taste:** taste. The comment at `:17` says *"IntersectionObserver, so
nothing loads until the hero is actually on screen"* — accurate and useless,
because the hero is always on screen.

**Fix, one line:** gate the whole hero on the Calendar tab being *chosen* rather
than defaulted (e.g. keep `page.tsx`'s initial tab but only mount `OrreryHero`
after a user-initiated tab change or a first scroll), or accept it and rewrite
the `:17` comment to say the observer is belt-and-braces, not a gate.
**Effort:** ~15 minutes either way.

### 3. A real viewport/touch check — **PASS, verified**

`src/components/orrery/OrreryHero.tsx:29-34` and the early return at `:99`

```js
const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
const wide = window.matchMedia('(min-width: 1024px)').matches
const calm = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
setOk(fine && wide && calm)
…
if (!ok) return null
```

`ok` initialises `false` and is only ever set inside a client effect, so the
server render and the pre-hydration DOM contain nothing — a phone never reaches
even the container, let alone the `dynamic()` call. A phone would have to report
`hover: hover`, `pointer: fine` **and** ≥1024px simultaneously to pass.

**What I tried to kill it with:** checked the service worker, since a precache
would download the chunk on a phone regardless of what renders — `public/sw.js`
has no `install` precache at all (`:2` is a bare `skipWaiting`) and force-fetches
anything containing `/_next/` (`:8-14`), so nothing is stored. Checked that the
gate is not bypassed by an SSR path: `ssr:false` plus `ok=false`-on-first-render
means two independent reasons it cannot server-render.

**Taste-level gap, not raised as its own item:** the three media queries are
sampled **once**, in a `[]` effect, with no `change` listener. A desktop window
dragged below 1024px keeps rendering and animating the scene; a window that
starts below 1024px never gets it even when widened; toggling OS reduced-motion
does nothing until reload. **Fix, one line:** attach
`mql.addEventListener('change', …)` to the three queries and re-evaluate.
**Effort:** ~10 minutes.

### 4. `three` / `@react-three/*` stay out of the initial bundle — **PASS, MEASURED**

Measured against `.next/` on disk, not reasoned, and not by running a build
(`prisma generate` EPERM). Freshness proof: `.next/BUILD_ID` written
2026-08-10 17:42:58, orrery sources 2026-08-07 00:25–00:26, and the gate string
`pointer: fine` plus the legend colour `#c9a4ff` from the current
`OrreryHero.tsx` both appear in the built page chunk.

```
grep -c WebGLRenderer  → 0 in all 9 other chunks, 6 in static/chunks/14~od8u0_4l60.js
static/chunks/14~od8u0_4l60.js   1,174,179 bytes raw · 355,688 bytes gzip -9
```

That chunk is referenced from exactly two places in the whole build:

- `.next/server/app/page/react-loadable-manifest.json` → `{"19125": {"files": ["static/chunks/14~od8u0_4l60.js"]}}`
- `.next/static/chunks/0jfgqar4atblu.js` (215 bytes), whose entire body is
  `o.v(t=>Promise.all(["static/chunks/14~od8u0_4l60.js"].map(t=>o.l(t))).then(()=>t(19125)))`
  — a Turbopack async chunk loader, not a synchronous require.

It appears in **none** of `build-manifest.json`'s `rootMainFiles`,
`polyfillFiles` or `lowPriorityFiles`, and not in `.next/server/app/page.js`.
For scale, the entire eager JS is `rootMainFiles` 131 KB gzip + polyfill 39 KB
gzip; the orrery chunk alone is **347 KB gzip, ~2.6× the whole rest of the app**.

**Attached factual defect — `OrreryHero.tsx:6`:**

> `// three + R3F is ~170 KB gzipped.`

Measured: **347 KB gzipped**. The comment understates the thing it exists to
justify by more than 2×. **Fix, one line:** change the number to ~347 KB.
**Effort:** minutes.

---

## Not re-raised

Nothing here overlaps `brief.md`'s ten findings or its `## Rejected` list —
neither mentions the orrery; `brief.md` records `orrery/*` as **unread** (resume
item K). `HANDOFF.md`'s open item is orrery *tuning* plus the Chrome-extension
wedge, not gating. `TRAPS.md`'s R3F-9.7-zero-size entry is the reason
`OrreryHero.tsx:59-97` exists (ResizeObserver + explicit parent size + the
resize burst); that workaround is present and commented and is not challenged
here.

## Adjacent, noted not raised

`OrreryHero.tsx:92-97` dispatches six global `window resize` events to break the
R3F deadlock. Blast radius checked: `src/` has exactly one other
`addEventListener('resize')`, `FloatingStopwatch.tsx:64`, which recomputes a
clamped position — harmless. Worth remembering if a second resize consumer is
ever added.

## Not verified

Nothing was rendered in a browser — read-only, and `HANDOFF.md` warns that
mounting the Calendar tab wedges the Chrome extension. The claim that the chunk
is fetched on every desktop load is inferred from the mount chain above and the
async-loader shape, not from a network trace.
