# Public localization process and traceability

**MACHINE DRAFT / NATIVE REVIEW HOLD / MAINNET UNSCHEDULED_HOLD / NO DEPLOYMENT**

This document describes how the 50-locale static catalog was refreshed,
checked, and bound to public Git history. The machine-readable companion is
[`translation-provenance.v1.json`](./translation-provenance.v1.json), and the
scoped public-domain dedication is
[`CC0-DATA-DEDICATION.md`](./CC0-DATA-DEDICATION.md).

## What this run changed

The 2026-08-04 run refreshed only catalog values that still exactly matched
their English or Turkish source text. It did not regenerate every existing
translation and it did not claim native authorship.

Compared with baseline commit `6290df543ab7471ae5ce6320675173eded73908b`,
output commit `93532d459114cb6d30923a19cd42a199d89d70e1`
contains 4,748 changed locale entries:

- 4,560 source-equal prose values replaced with local NLLB machine drafts;
- 187 translated or corrupted literal-only values restored exactly to source;
- 109 corrupted SHA-256 values included within those 187 restorations; and
- one French punctuation normalization from the deterministic/editorial
  pipeline.

There are zero unexplained mutations under this classification.

## Source extraction and scope

The catalog contains 1,468 canonical strings for 50 locales. Its extraction
surface is the 25 canonical rendered routes recorded in `messages.json`, plus
the critical hydration-only strings and route SEO inputs. Source locales are
English and Turkish. Brand, protocol, financial-safety, and launch-state terms
are deliberately protected.

The refresh command used the committed generator with private workstation paths
replaced by public placeholders:

```powershell
$env:I18N_PYTHON_RUNTIME='<local-nllb-runtime>'
$env:I18N_REFRESH_SOURCE_MATCHES='1'
$env:I18N_BATCH_SIZE='96'
& '<local-python-3.12>' scripts/generate-i18n-local.py
```

The generator used `facebook/nllb-200-distilled-600M` at Hugging Face snapshot
revision `f8d333a098d19b4fd9a8b18f94170487ad3f821d`. The recorded runtime was
Python 3.12.13, PyTorch 2.11.0+cu128, Transformers 5.14.1, Tokenizers 0.22.2,
SentencePiece 0.2.2, CUDA 12.8, and an NVIDIA GeForce RTX 3080 Ti on Windows.
No model weights, local cache paths, secrets, or workstation identifiers are
published.

Generation was greedy (`num_beams=1`) with `max_length=384`,
`no_repeat_ngram_size=3`, and `repetition_penalty=1.15`. Batch size was 96.
Language detection selected English or Turkish source mode, then the committed
locale-to-NLLB mapping selected each target language.

## Deterministic repair pipeline

After draft generation, the committed scripts run in this order:

1. prune catalog keys that are no longer canonical;
2. apply reviewed editorial overrides;
3. repair protected literal and structural invariants; and
4. compile route metadata and static locale assets.

URLs, handles, token tickers, canonical 64-character hashes, time-gate tokens,
numeric/unit tokens, and protocol terms are protected. Literal-only strings are
restored exactly, never translated. The catalog is static at build time; there
is no runtime translation service.

## Evidence and public commit chain

The public chain is intentionally split into reviewable increments:

1. `93532d4` — catalog output and deterministic repairs;
2. `3989241` — 0 pending visible source strings across 25 routes;
3. `7965f4b` — 1,250/1,250 source-bound render checks pass;
4. `ebc5b6b` — 5,000-result scorecard generated;
5. `814f600` — public report refreshed; and
6. `02ebead` — report-to-scorecard regression binding.

The exact full commits, raw file hashes, byte counts, environment, parameters,
outcomes, and limitations are in the provenance manifest. Run
`npm run check:i18n:provenance` to re-hash the artifacts, inspect the historical
Git blobs, recompute the mutation classes, verify commit ancestry, and compare
the live QA summaries with the manifest.

## How future model improvements are published

Every material model-assisted improvement must create a new run object with a
new stable ID. Prior run objects are append-only and must not be overwritten.
Each new run records the baseline and output commits, exact model identifier and
revision, runtime versions, generation parameters, deterministic repair stages,
raw artifact hashes, test outcomes, and honest limitations. A coherent,
validated run is committed and pushed separately so reviewers can reproduce the
delta from public Git history.

Failed experiments, private paths, model caches, credentials, wallet material,
and transient files are not public evidence. A failed gate is reported but not
published as passing.

Before report generation, `npm run check:i18n:active-artifacts` verifies every
file bound by the active public report. Any content, size, missing-file, or path
ownership drift fails before generated evidence can be rewritten. A deliberate
change to a bound file therefore requires a new append-only provenance run; it
must never silently overwrite the active run's hashes.

## Read-only live deployment parity

Run `npm run check:i18n:live` to compare every one of the 50 committed locale
payloads byte-for-byte on both active public domains. The verifier also checks
one rendered Network page for every locale on both domains: 100 route checks
for successful HTML responses, exact origin/path without redirects, HTML
content type, exact `Content-Language`, a non-trivial response body, and the
expected `lang` and LTR/RTL attributes. Payload checks likewise require JSON
content type and exact no-redirect origin/path ownership before comparing
SHA-256. Cache-busting request parameters and no-cache headers reduce stale
edge-cache ambiguity. For each active domain, it additionally resolves the
fingerprinted `LocaleRuntime` bundle referenced by the rendered HTML, requires
exact no-redirect host/path ownership and JavaScript content type, and verifies
that the bundle embeds the committed payload schema, namespace, full and short
catalog digests, fail-closed payload marker, and no legacy `/i18n/` payload
path. The command is deliberately separate from offline CI: it requires
network access, changes no hosting or chain state, and does not deploy.
Before the network requests, mutation-based local tests prove that redirected
or cross-origin responses, wrong content types, undersized bundles, missing
contract markers, and the retired payload path all fail closed.

Passing proves that the checked public payload bytes match the committed
catalog, every locale has a checked public route on each domain, and each
checked domain's referenced hydration runtime is bound to the current payload
contract. It does not prove native meaning, cadence, slang, cultural fluency,
browser layout quality, full application behavior, or universal cache eviction
for responses that were not requested.

## Assurance boundary

The current scorecard is 4,538 PASS, 0 FAIL, 462 HOLD, and 0 NOT_RUN. The 462
HOLD results remain open: 300 require external evidence, including native
review and independent language identification, and 162 are conservative
editorial heuristics. Catalog completeness and browser rendering do not prove
meaning, cadence, slang, cultural fluency, or native quality.

This process does not authorize deployment, signing, broadcasting, funding, or
mainnet launch. Mainnet remains `UNSCHEDULED_HOLD`.
