# IAT 50-locale independent-review templates

These files make the remaining language QA gates actionable. They do **not**
approve a locale, change Mainnet state, or turn automated heuristics into native
review.

The current public scorecard has 4,544 PASS, 0 FAIL, 456 HOLD, and 0 NOT_RUN
results. Of the HOLD results, 250 are the five native-review checks across 50
locales and 50 require independent language-identification evidence. The other
156 are editorial heuristics that reviewers should use as a focused queue.

## Safe workflow

1. Run `npm run check:i18n` so the static catalog and compiled locale payloads
   are deterministic.
2. Run `npm run generate:i18n:review-templates` to bind fresh templates to the
   exact catalog and per-locale message digests.
3. Give one locale at a time to an accountable reviewer with documented locale
   competency. Do not record `PASS` until all 1,468 keys and the required route
   coverage have actually been reviewed.
4. For LQA-096 through LQA-100, fill the reviewer identity, role, competency,
   independence statement, evidence note, UTC review time, and any required
   region or route fields. A blank field keeps the result on HOLD.
5. Run an independent language-identification engine against each locale
   catalog. Record the engine, its identified locale, confidence, and threshold.
   Do not infer or prefill the result from the expected locale.
6. Place completed, reviewed records at
   `app/i18n/native-review-signoffs.v1.json` and
   `app/i18n/language-id-evidence.v1.json`, then regenerate the scorecard.

Any catalog change makes completed records stale by design. The generator
validates record completeness and hashes, but it cannot establish a reviewer's
real-world identity, independence, or language competence. Do not include
private contact details; use a stable public reviewer identifier and a concise
evidence note.

The templates remain explicitly `UNREVIEWED_HOLD` / `UNEXECUTED_HOLD` until
independent evidence exists.
