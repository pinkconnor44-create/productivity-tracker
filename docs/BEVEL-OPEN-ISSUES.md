# Bevel — open issues (parked 2026-08-07)

Two unresolved items, both raised by Connor after the first real import.
Nothing here is fixed; this is the state to pick up from.

---

## 1. HAE reports success but nothing arrives

**Symptom.** The Health Auto Export automation shows "sync in progress 100%"
and reports sending, but no data reaches the server.

**Hard evidence — this is not a guess.** Vercel runtime logs for
`productivity-tracker-murex.vercel.app` show **zero POST requests** to
`/api/health-import`, ever. Only GETs, all of them mine. So this is not an
auth failure, not a parse failure, and not a silent no-op: no request is being
made at all. A request that arrived and failed would appear as a 4xx/5xx line.

**Ruled out:**
- Endpoint is alive and reachable — returns row counts for a valid key.
- Auth works. Correct key → 200, wrong key → 401, key with trailing
  whitespace → 200 (trimmed). This was genuinely broken earlier (the Vercel
  env var was set through a PowerShell pipe and didn't land); fixed, redeployed
  and verified. It is not the current cause, because a bad key would still
  produce a logged 401.
- The URL is right and the automation is enabled (per Connor).

**Still to check, roughly in order of likelihood:**
0. **Is HAE Premium actually purchased?** REST API automations are a paid
   feature. Connor produced a manual export, which the free tier allows, but it
   was never confirmed that the Premium tier was bought — and this was written
   up assuming it had been. A free-tier install can show automation UI and
   report success while never making the request, which matches the symptom
   exactly: *configured, claims to send, zero requests arrive*. **Check this
   first — it is the cheapest to rule out and it fits the evidence better than
   anything below.**
1. **"Sync" vs "Automation" are different things in HAE.** The 100% progress
   indicator is HAE loading data *from HealthKit into its own database*. It
   says nothing about whether a REST automation fired. Look for a per-automation
   run history / last-run timestamp instead.
2. **Automation type.** Confirm it is REST API, not an Export/iCloud/Dropbox
   destination that happens to have a URL field.
3. **Press Run Now on the automation itself** (not a global sync/refresh). This
   is the single most informative action — it forces an immediate POST and the
   logs will show exactly what status came back.
4. **Metric selection.** With nothing selected, some HAE builds no-op instead
   of erroring.
5. **Background App Refresh** must be on for HAE, and Low Power Mode
   suppresses it entirely.
6. If a POST still never appears, try pointing the automation at a request-bin
   style URL to prove HAE is capable of sending anything at all. That isolates
   HAE from this app completely.

**How to check whether it worked, now:** open Bevel. The status line under the
sub-tab bar reads the import log directly — "No imports received yet" vs "Last
import 4 min ago · 47 rows". No need to read Vercel logs or ask Claude.

### 2026-08-09 — re-checked, and the log itself had a hole in it

**Still nothing arriving.** Prod row counts are unchanged from the backfill
(1,708 metrics / 62 nights / 11 workouts) and `HealthImportLog` is **empty**,
though Connor reports the automation ran and said it exported minutes earlier.

**But an empty log was never the proof it looked like.** `recordImport` was
only reached *after* auth and JSON parsing had already passed. A request
rejected with **401** (wrong or missing key) or **400** (unparseable body)
wrote no row at all — so "the log is empty" meant BOTH "no request ever
arrived" and "requests arrived and were turned away at the door". Opposite
diagnoses, opposite fixes, and the second was invisible from the app.

**Fixed.** `POST /api/health-import` now logs rejections too, noting the
reason, whether an `x-api-key` header arrived and its length after trimming,
and the **User-Agent** — the field that settles whether the request came from
Health Auto Export at all. The key itself is never logged. Rejection logging is
rate limited to one row per 5 minutes: that path is reachable *without* the
key, and an unlimited version would let anyone on the internet push real
imports out of the log.

Bevel's status line renders the reason under a failed row, so the next run is
diagnosable **from the phone**:

| What you see | What it means |
|---|---|
| `No imports received yet` | Nothing is reaching the server. HAE is not making the request — item 0 above (Premium) stays the leading candidate. |
| `unauthorized — key absent; ua HealthAutoExport/…` | HAE **is** reaching the server and sending no key. Fix the header in the automation. |
| `unauthorized — key N chars; ua HealthAutoExport/…` | Reaching the server with the **wrong** key. Compare N to the real key's length. |
| `unauthorized — … ua <not HAE>` | Something else is posting. Not your automation. |
| `invalid JSON` | Arriving and authenticated, wrong body — likely the wrong HAE export format. |

⚠️ **Useless until deployed** — the phone posts to prod, so this does nothing
until `npx vercel --prod` runs. **No `db:push` needed**: it reuses the existing
`note` column, so there is no schema change.

Verified end to end against a local server on 2026-08-09 — a POST with a wrong
key and a spoofed HAE user agent produced
`rejected: unauthorized — key 22 chars; ua HealthAutoExport/8.1 (iPhone; iOS 26.1)`
and Bevel rendered it. The test row was then deleted from the shared Turso
database, so the log is genuinely empty again rather than carrying a fake.

---

## 2. Recovery score does not match Bevel's

**Symptom.** The app showed 89% recovery for 2026-08-07. Connor reports never
having seen that number in Bevel, and that recovery/sleep "don't match up on
the correct days".

**It is not an average.** Worth stating plainly because that was the guess.
Recovery is a weighted blend of three components, each mapped through
piecewise-linear anchors defined in `HEALTH_CONSTANTS.RECOVERY`
(`src/lib/health.ts`):

| Component | Weight | On 2026-08-07 | Score |
|---|---|---|---|
| HRV vs 30-day baseline | 0.50 | 71.0ms vs 57.5ms (ratio 1.23) | ~93 |
| Resting HR vs baseline | 0.30 | 49bpm vs 50.0bpm (ratio 0.98) | ~77 |
| Last night's sleep score | 0.20 | 7.6h, 96.6 | 96.6 |

`0.5(93) + 0.3(77) + 0.2(96.6) ≈ 89`. The Recovery sub-tab already shows this
breakdown live under "How this score was reached", including the weight
actually applied after renormalisation.

**Why it legitimately differs from Bevel — three separate reasons:**

1. **These were always approximations.** Bevel's scoring is proprietary; this
   reimplements the *idea* from the same inputs. Matching digit-for-digit was
   never achievable and was flagged as a risk in `plan.md` from the start.

2. **Probably the real one: HRV source.** Bevel (like Whoop) uses **sleeping**
   HRV — the overnight average during the sleep window. This app uses HAE's
   `heart_rate_variability` **daily aggregate**, which averages every reading
   across the whole day, including waking measurements. Those are different
   quantities and will diverge systematically, not randomly. **This is the
   first thing to investigate**, and it is fixable: HAE can export
   minute-level HRV, so overnight readings could be isolated to the sleep
   window. That means storing samples rather than daily aggregates for HRV —
   a schema addition, not a rewrite.

3. **Today is a partial day.** The daily HRV aggregate for the current day
   covers only the hours elapsed so far, which on 2026-08-07 was a morning of
   mostly-resting readings — biased high. Any score for today is provisional
   until the day closes. Yesterday's numbers are the fair comparison.

**On "not matching up on the correct days":** sleep *duration* day-attribution
was verified against Apple Health for Aug 4–7 and matched exactly (6.8 / 7.1 /
8.6 / 7.6h), so nights are filed on the right days. If the day misalignment
Connor is seeing is specifically in *recovery*, reason 2 above is the likely
explanation — a whole-day HRV average is not the number Bevel attributes to
that morning. Worth confirming which of the two he means before changing
anything.

**Do not tune the constants first.** Fixing the input (sleeping HRV) before
tuning weights avoids calibrating the model against the wrong signal.

---

## Where things stand otherwise

- 91 days of real data imported and verified (2026-05-09 → 2026-08-07).
- Baselines full, not calibrating.
- The three parser bugs the real export exposed are fixed and deployed.
- Prod is live and correct; `main` is 24 commits ahead of origin, never pushed.
