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
