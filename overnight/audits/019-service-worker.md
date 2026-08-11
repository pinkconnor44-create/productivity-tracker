# 019 — `public/sw.js` and `src/components/PWASetup.tsx`

**Verdict: the item's hypothesis is FALSE and is killed. The service worker
caches nothing — not the HTML shell, not anything.** It cannot be the cause of
the `dev\TRAPS.md` PWA-staleness entry. What remains is a smaller, real finding:
the whole fetch handler is dead weight that misrepresents itself, and the trap
entry misattributes a cause.

---

## A. The SW does not cache the document — or anything — `cleanup` · minutes · **verified**

`public/sw.js:17-19` is the only place the Cache Storage API appears in the
entire repo:

```js
e.respondWith(
  fetch(e.request).catch(() => caches.match(e.request))
)
```

**`caches.match` is the only Cache Storage call in the tree, and it is a read.**
Grepped the whole project for `caches.|cache.put|addAll|CACHE_NAME|workbox|next-pwa`
— two hits, both shown above plus the `register()` call. There is no `install`
handler that opens a cache, no `cache.put` on any response path, no precache
manifest, no `next-pwa`/`workbox` dependency. **Nothing ever writes to Cache
Storage, so `caches.match()` resolves `undefined` on every request, forever.**

Consequences, in order:

1. **The fetch handler reduces to a pure passthrough.** Both branches are
   `e.respondWith(fetch(e.request))` — the `/api/` `/_next/` `/__nextjs` branch
   explicitly (`:13`), and the "network-first" branch effectively, because its
   fallback can never produce a `Response`.
2. **The offline fallback is dead code, and slightly worse than dead.** Per the
   Service Workers spec, a promise passed to `respondWith` that fulfils with a
   non-`Response` value fails the fetch and reports a `TypeError`. So offline
   navigations error *through* the SW rather than hitting the browser's own
   offline path. Impact is near-zero — the request fails either way — but the
   comment `// Network-first for everything else` (`:16`) describes a cache
   fallback that does not exist.
3. **`skipWaiting` + `clients.claim` (`:2-3`) are currently harmless.** Their
   classic hazard — a new SW serving new hashed chunks into a page still running
   the old bundle — requires a cache to serve from. There isn't one.
4. **No cache name, no versioning, no `activate` cleanup — correctly so.** There
   is nothing to version and nothing to clean. Not a gap.

The item asked whether this fights the app's cache policy: **it does not touch
it.** Every request goes down the browser's normal HTTP path with its original
cache mode preserved, so `/_next/static/**` still gets Vercel's
`immutable` year and the document still gets `no-store` (measured in
`brief.md` `## Rejected` #1 — not re-raised).

**Defect or taste:** defect, but a cosmetic one — the file claims a caching
strategy it does not implement, and a future reader (or agent) will reason about
a cache that is permanently empty. The cost today is one service-worker thread
boot in front of every cold navigation, buying nothing.

**What I tried to kill it with:** I went looking for the cache write that would
make the hypothesis true — a precache list, a `next-pwa` build step generating a
second SW, a differently-named SW file, an older version of `sw.js` that cached
and left populated Cache Storage on Connor's device. All negative: `public/`
contains exactly `sw.js` and `manifest.json`; `git log --follow -- public/sw.js`
returns a **single commit** (`a526650` "Initial commit"), so this file has never
had a different body; and production serves it **byte-identical** to the working
copy (`Content-Length: 599`, `Etag: "1a781f238452ea576a4bb0f2a0ece5d4"`, body
diffed by eye against the local file).

**Fix (one line):** replace the whole fetch handler with
`self.addEventListener('fetch', () => {})` — an empty handler still satisfies
Chrome's installability criterion (which is what the `:1` comment says the file
is for) while letting every request take the browser's normal path.

**Effort:** minutes.

---

## B. `TRAPS.md` names the wrong cause for the PWA staleness — `cleanup` · minutes · **reasoned**

`dev\TRAPS.md:220` — *"After any deploy, fully close and reopen an installed
PWA, or the service worker keeps serving the old bundle."*

**The advice is right; the stated cause is wrong**, at least for this project.
Finding A rules the SW out mechanically. The server side is also ruled out:
`src/app/layout.tsx:2` sets `export const dynamic = 'force-dynamic'` and the
document is served `no-store`, so a fresh navigation can never get a stale shell.

The remaining explanation that fits the observed symptom exactly is **iOS
web-view lifetime, not caching**: an installed standalone PWA that is
backgrounded is not re-navigated when you tap back into it — iOS restores the
same web view with the same JS heap and the same already-loaded bundle, for days.
No request is made, so no cache policy of any kind can help. "Fully close and
reopen" is required precisely because it is the only action that forces a new
navigation. That also explains why a plain reload inside the PWA does fix it.

I flag this because `TRAPS.md` is the file that exists to stop the next person
debugging the wrong layer, and as written it points them at a service worker
that provably does nothing.

**Defect or taste:** defect (doc), low stakes.

**What I tried to kill it with:** I looked for a way the SW could still hold a
stale bundle without a cache — a stale SW *script* pinning old behaviour
(no: `/sw.js` is served `no-cache, no-store, must-revalidate`, confirmed live,
and browsers bypass the HTTP cache for SW update checks regardless), or the
`/_next/` passthrough re-serving old chunks (no: passthrough preserves the
request's own cache mode, and the chunks are content-hashed, so an old hash is
only requested by an already-old document).

**Fix (one line):** amend the `TRAPS.md` line to say the installed PWA keeps the
old **web view**, not that the service worker serves an old bundle.

**Effort:** minutes. ⚠️ Unverified on-device — I have no iPhone here, and
`HANDOFF.md` records device QA as unrun. Confirmable in 30 seconds:
DevTools/Web Inspector → Application → Cache Storage on the installed PWA should
show **zero caches**.

---

## C. `PWASetup.tsx` — nothing structural, three small notes · **verified**

Read in full. It does not fight any `CLAUDE.md` rule:

- Mounted as a **direct child of `<body>`** (`src/app/layout.tsx:46`), outside
  `ConfirmProvider` and outside anything with a `transform` — so the
  `fixed bottom-20` banner (`PWASetup.tsx:53`) is **not** subject to the
  transform-traps-`fixed` trap. Checked specifically.
- Registration is fire-and-forget (`:12`), with **no `updatefound` listener, no
  `registration.update()`, and no "new version available" prompt**. Normally
  that would be the fix for a staleness complaint — here it would change nothing,
  because a new SW would serve exactly what the old one serves. Correctly a
  non-issue, listed so it is not re-opened.
- `:18` `/iphone|ipad|ipod/i` — iPadOS 13+ Safari sends a desktop-class UA
  containing `Macintosh`, so **iPads fall to the Android branch and see no
  banner at all** (`beforeinstallprompt` never fires in Safari). Real, and
  irrelevant to a user on an iPhone. Not worth fixing.
- `:38` dismissal is `sessionStorage`, so the banner returns every new session.
  Taste, plausibly deliberate.
- `:72` hardcodes `linear-gradient(135deg, #8052ff, #4f46e5)`. I initially had
  this as an off-palette violation and **killed it**: the identical gradient is
  the app icon (`src/app/api/pwa-icon/route.tsx:19`), so the Install button
  deliberately matches the icon. Consistent, not drift.
- `:53` `border-primary-200` at full opacity is the only full-strength
  `primary-200` border in the codebase — `HabitsView` uses `primary-200/40`.
  On a dark-only surface that is a conspicuously bright hairline. Taste, one
  character to change if Connor dislikes it on-device.

---

## D. Secondary, adjacent: the PWA icon re-renders per request · `cleanup` · minutes · **verified**

Not part of the item, found while confirming the PWA surface. Measured in
production:

```
/api/pwa-icon?size=192 → Cache-Control: public, max-age=0, must-revalidate
                         X-Vercel-Cache: MISS   Age: 0
```

`ImageResponse`'s own default header wins over the `next.config.mjs` blanket
rule, and every request re-renders the PNG in an edge function
(`route.tsx:4,10`) for an image that is a fixed gradient plus a static
checkmark and can never change. Cost is small (icons are fetched at install
time, not per page load). **Fix:** ship two static PNGs in `public/` and point
the manifest at them, or set a long `immutable` cache header on the response.

Also noted while there: `public/manifest.json:8` declares
`"theme_color": "#8052ff"` while `layout.tsx:37` declares
`<meta name="theme-color" content="#000000">`. Two different answers to the same
question; the black one matches the dark-only surface.

---

## Bottom line

`public/sw.js` is 20 lines that cache nothing and change nothing. **The item
should be closed as "not a defect" on its central question** — no HTML shell
caching, no fight with the app's cache policy, no contribution to the deploy
staleness trap. Worth doing anyway, both minutes-scale: reduce the fetch handler
to an honest no-op (A), and correct the cause named in `TRAPS.md` (B).
