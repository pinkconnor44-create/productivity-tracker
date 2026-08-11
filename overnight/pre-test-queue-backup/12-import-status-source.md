# 12 — `ImportStatus` cannot answer the question it exists for

**Severity** risk · **Effort** ~20min · **Approved** 2026-08-10
**Source** run-3 finding 13 · evidence `../overnight/audits/020-ui-render-sweep.md`

## Change

Add a branch for `source: "other"` (and any unrecognised value), and surface a
non-zero row count rather than a bare "· 0 rows".

## Where

`src/components/bevel/ImportStatus.tsx:66-68`

## Why

Rendered live it reads **"Last import 2 hours ago · 0 rows"** with a green dot — not
"· from phone". The stored row has `source: "other"`, a value `sourceOf()` genuinely
returns but which has **no branch**, plus 0/0/0 counts.

`HANDOFF.md`'s next-step 1 — *does the HAE automation run unattended?* — depends on
this line to answer it, and it currently cannot.

## Verify

After a phone push, the line reads "· from phone" and a real row count. After a
`curl` probe it reads something other than the phone label.
