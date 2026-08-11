# 17 — `docs/DESIGN.md` specs the previous design system

**Severity** risk · **Effort** ~2h · **Approved** 2026-08-10
**Source** run-3 finding 19 · evidence `../overnight/audits/005-notes-design-drift.md`

## Change

Rewrite it against the current tokens, or delete it and re-point `CLAUDE.md:67` and
the See-also line. ~6 of ~40 statements survive, so a rewrite is close to a fresh
document.

**Connor still owes this call: rewrite or delete.**

## Where

`docs/DESIGN.md`; citations at `CLAUDE.md:67` and `CLAUDE.md`'s See-also line

## Why

`CLAUDE.md` cites it as "Full spec". Last committed **2026-05-06, before** the
2026-08-06 palette rework. All 7 surface hexes are wrong, 0 of 6 type-scale names
exist, 4 of 6 radius rows record the *pre-fix* inverted ladder, and gradient and
motion values are wrong. Two sections document deleted machinery — the five-accent
`[data-theme]` switcher and the `!important` override block it tells you to append
to.

Worst: `:78` and `:183` assert **in bold** that `.glass` is "92% opaque (NOT 60%)",
directly contradicting the 62% that `CLAUDE.md` pins and the CSS implements. Anyone
reconciling the two reverts the design.

Note: run 3 verified all five documented token rules **hold in the CSS**. The drift
is entirely in this document.

## Verify

Every hex, type name and radius in the doc matches `globals.css` — or the file and
both citations are gone.
