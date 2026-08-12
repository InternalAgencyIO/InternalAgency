# DRAFT localization, usability, and accessibility QA

**STATIC QA / NOT LAUNCH APPROVAL / MAINNET HOLD / NO DEPLOYMENT PERFORMED**

Generated: 2026-08-05T13:44:35.843Z

Active-artifact refresh: 2026-08-08T09:15:18Z

## Outcome

- Catalog completeness: **PASS** across 50 locales and 985 canonical strings.
- Reviewed-runtime policy gate: **PASS** with 0 reviewed cells and 48265 canonical-English fallback cells.
- Pending visible-source ledger: **48 strings across 13 routes** remain runtime-inactive until translation and accountable native review.
- Native-language signoff: **HOLD**. Every non-English locale still requires an accountable native review before it can be described as native-quality.
- Mainnet decision: **HOLD, unchanged**. This package is not launch approval.

Unreviewed target-language drafts are not served. Safety-critical copy remains canonical English until exact review evidence is committed.

## Validation

- Exact scorecard: **4700 PASS / 0 FAIL / 300 HOLD / 0 NOT_RUN** across 5000 results.
- HOLD remediation ledger: [`hold-remediation-ledger.json`](./hold-remediation-ledger.json) separates **300 external-evidence gates** from **0 heuristic editorial reviews** without closing or downgrading any result.
- Source-bound browser/render evidence: **PASS** for 1250/1250 recorded checks.
- Pending visible-source ledger: **48 strings across 13 routes**, all runtime-inactive and held for translation plus accountable native review.
- Public process: [`TRANSLATION-PROCESS.md`](./TRANSLATION-PROCESS.md) records the model revision, runtime, generation parameters, deterministic repair stages, public commit chain, and future append-only update protocol.
- Machine-readable provenance: [`translation-provenance.v1.json`](./translation-provenance.v1.json) is append-only and is validated separately against exact tracked bytes and commit ancestry.
- Data license: [`CC0-DATA-DEDICATION.md`](./CC0-DATA-DEDICATION.md) dedicates the project-owned, non-secret localization data and QA evidence under CC0 1.0 while explicitly excluding software, third-party model weights and runtimes, trademarks, secrets, and material the project does not own.

No heuristic editorial queue remains because unreviewed target-language drafts are inactive. Language-identification and native-review gates remain HOLD for every locale.

Historical command record from 2026-08-03; regenerating this summary does not claim these commands were rerun:

- `npm test`: **PASS** (45 tests)
- `npm run lint`: **PASS** (0 errors, 0 warnings)
- `npm run check:future-teasers`: **PASS** (4 tests)

## Locale matrix

| Route locale | Content locale | Runtime status | Empty | Reviewed cells | Fallback cells | Policy violations | Native review |
|---|---|---|---:|---:|---:|---:|---|
| en | en | SOURCE | 0 | 0 | 0 | 0 | source |
| zh | en | HOLD | 0 | 0 | 985 | 0 | required |
| es | en | HOLD | 0 | 0 | 985 | 0 | required |
| hi | en | HOLD | 0 | 0 | 985 | 0 | required |
| fr | en | HOLD | 0 | 0 | 985 | 0 | required |
| ar | en | HOLD | 0 | 0 | 985 | 0 | required |
| bn | en | HOLD | 0 | 0 | 985 | 0 | required |
| pt | en | HOLD | 0 | 0 | 985 | 0 | required |
| id | en | HOLD | 0 | 0 | 985 | 0 | required |
| ur | en | HOLD | 0 | 0 | 985 | 0 | required |
| ru | en | HOLD | 0 | 0 | 985 | 0 | required |
| de | en | HOLD | 0 | 0 | 985 | 0 | required |
| ja | en | HOLD | 0 | 0 | 985 | 0 | required |
| pcm | en | HOLD | 0 | 0 | 985 | 0 | required |
| tr | en | HOLD | 0 | 0 | 985 | 0 | required |
| sq | en | HOLD | 0 | 0 | 985 | 0 | required |
| ca | en | HOLD | 0 | 0 | 985 | 0 | required |
| be | en | HOLD | 0 | 0 | 985 | 0 | required |
| nl | en | HOLD | 0 | 0 | 985 | 0 | required |
| bs | en | HOLD | 0 | 0 | 985 | 0 | required |
| bg | en | HOLD | 0 | 0 | 985 | 0 | required |
| hr | en | HOLD | 0 | 0 | 985 | 0 | required |
| el | en | HOLD | 0 | 0 | 985 | 0 | required |
| cs | en | HOLD | 0 | 0 | 985 | 0 | required |
| da | en | HOLD | 0 | 0 | 985 | 0 | required |
| et | en | HOLD | 0 | 0 | 985 | 0 | required |
| fi | en | HOLD | 0 | 0 | 985 | 0 | required |
| hu | en | HOLD | 0 | 0 | 985 | 0 | required |
| is | en | HOLD | 0 | 0 | 985 | 0 | required |
| ga | en | HOLD | 0 | 0 | 985 | 0 | required |
| it | en | HOLD | 0 | 0 | 985 | 0 | required |
| lv | en | HOLD | 0 | 0 | 985 | 0 | required |
| lt | en | HOLD | 0 | 0 | 985 | 0 | required |
| lb | en | HOLD | 0 | 0 | 985 | 0 | required |
| mk | en | HOLD | 0 | 0 | 985 | 0 | required |
| mt | en | HOLD | 0 | 0 | 985 | 0 | required |
| no | en | HOLD | 0 | 0 | 985 | 0 | required |
| pl | en | HOLD | 0 | 0 | 985 | 0 | required |
| ro | en | HOLD | 0 | 0 | 985 | 0 | required |
| sr | en | HOLD | 0 | 0 | 985 | 0 | required |
| sk | en | HOLD | 0 | 0 | 985 | 0 | required |
| sl | en | HOLD | 0 | 0 | 985 | 0 | required |
| sv | en | HOLD | 0 | 0 | 985 | 0 | required |
| uk | en | HOLD | 0 | 0 | 985 | 0 | required |
| ht | en | HOLD | 0 | 0 | 985 | 0 | required |
| gn | en | HOLD | 0 | 0 | 985 | 0 | required |
| qu | en | HOLD | 0 | 0 | 985 | 0 | required |
| hy | en | HOLD | 0 | 0 | 985 | 0 | required |
| az | en | HOLD | 0 | 0 | 985 | 0 | required |
| ka | en | HOLD | 0 | 0 | 985 | 0 | required |

## Limitations

- Automated completeness proves that a static value exists; it does not prove idiomatic or culturally fluent language.
- Legacy editorial and critical-copy drafts are AI-assisted evidence only and are not active runtime translations.
- Canonical English fallback is an intentional safety state, not native-language approval.
- 48 newly captured English source strings remain outside the active catalog and require translation plus accountable native review before any non-English activation.
- Exact source-match counts inspect reviewed cells only and remain a triage heuristic, not a standalone defect count.
- Rendered browser checks are representative, not an exhaustive physical-device or assistive-technology certification.
- This package does not authorize deployment, signing, broadcasting, funding, or mainnet launch.

See [report.json](./report.json) for source digests, samples, and machine-readable results. Run `npm run check:i18n:provenance` from `projects/star-ascent/site` to verify public commit ancestry, historical mutation counts, file hashes, evidence totals, HOLD boundaries, and the append-only run policy.
