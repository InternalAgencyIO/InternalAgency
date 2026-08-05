# DRAFT localization, usability, and accessibility QA

**STATIC QA / NOT LAUNCH APPROVAL / MAINNET HOLD / NO DEPLOYMENT PERFORMED**

Generated: 2026-08-04T15:08:21.468Z

## Outcome

- Catalog completeness: **PASS** across 50 locales and 1468 canonical strings.
- Critical hydration-only English fallback gate: **PASS** for 8 launch-control strings.
- Native-language signoff: **HOLD**. Every non-English locale still requires a native-speaker review before it can be described as native-quality.
- Mainnet decision: **HOLD, unchanged**. This package is not launch approval.

The launch-checklist word “GO” is treated semantically as “ready,” not as an instruction to move. The critical override keeps this cadence explicit.

## Validation

- Exact scorecard: **4538 PASS / 0 FAIL / 462 HOLD / 0 NOT_RUN** across 5000 results.
- HOLD remediation ledger: [`hold-remediation-ledger.json`](./hold-remediation-ledger.json) separates **300 external-evidence gates** from **162 heuristic editorial reviews** without closing or downgrading any result.
- Source-bound browser/render evidence: **PASS** for 1250/1250 recorded checks.
- Public process: [`TRANSLATION-PROCESS.md`](./TRANSLATION-PROCESS.md) records the model revision, runtime, generation parameters, deterministic repair stages, public commit chain, and future append-only update protocol.
- Machine-readable provenance: [`translation-provenance.v1.json`](./translation-provenance.v1.json) binds 32 artifacts by raw SHA-256 and byte count and classifies all 0 catalog mutations from the public baseline.
- Data license: [`CC0-DATA-DEDICATION.md`](./CC0-DATA-DEDICATION.md) dedicates the project-owned, non-secret localization data and QA evidence under CC0 1.0 while explicitly excluding software, third-party model weights and runtimes, trademarks, secrets, and material the project does not own.

The remediation ledger prioritizes `pcm`, `zh`, `ar`, `ja`, `bs` because each has five heuristic HOLDs, while preserving all language-identification and native-review gates. Automation may prepare candidates and evidence inventories; it may not approve native quality or independent language identification.

Historical command record from 2026-08-03; regenerating this summary does not claim these commands were rerun:

- `npm test`: **PASS** (45 tests)
- `npm run lint`: **PASS** (0 errors, 0 warnings)
- `npm run check:future-teasers`: **PASS** (4 tests)

## Locale matrix

| Locale | Empty | Critical English fallbacks | Exact-source heuristic | Native review |
|---|---:|---:|---:|---|
| en | 0 | 0 | 0 | source |
| zh | 0 | 0 | 25 | required |
| es | 0 | 0 | 54 | required |
| hi | 0 | 0 | 41 | required |
| fr | 0 | 0 | 53 | required |
| ar | 0 | 0 | 30 | required |
| bn | 0 | 0 | 44 | required |
| pt | 0 | 0 | 67 | required |
| id | 0 | 0 | 79 | required |
| ur | 0 | 0 | 41 | required |
| ru | 0 | 0 | 32 | required |
| de | 0 | 0 | 87 | required |
| ja | 0 | 0 | 40 | required |
| pcm | 0 | 0 | 269 | required |
| tr | 0 | 0 | 256 | required |
| sq | 0 | 0 | 114 | required |
| ca | 0 | 0 | 111 | required |
| be | 0 | 0 | 33 | required |
| nl | 0 | 0 | 99 | required |
| bs | 0 | 0 | 96 | required |
| bg | 0 | 0 | 31 | required |
| hr | 0 | 0 | 83 | required |
| el | 0 | 0 | 31 | required |
| cs | 0 | 0 | 85 | required |
| da | 0 | 0 | 105 | required |
| et | 0 | 0 | 77 | required |
| fi | 0 | 0 | 65 | required |
| hu | 0 | 0 | 79 | required |
| is | 0 | 0 | 70 | required |
| ga | 0 | 0 | 120 | required |
| it | 0 | 0 | 82 | required |
| lv | 0 | 0 | 108 | required |
| lt | 0 | 0 | 69 | required |
| lb | 0 | 0 | 132 | required |
| mk | 0 | 0 | 32 | required |
| mt | 0 | 0 | 94 | required |
| no | 0 | 0 | 116 | required |
| pl | 0 | 0 | 75 | required |
| ro | 0 | 0 | 78 | required |
| sr | 0 | 0 | 31 | required |
| sk | 0 | 0 | 99 | required |
| sl | 0 | 0 | 97 | required |
| sv | 0 | 0 | 88 | required |
| uk | 0 | 0 | 45 | required |
| ht | 0 | 0 | 116 | required |
| gn | 0 | 0 | 79 | required |
| qu | 0 | 0 | 95 | required |
| hy | 0 | 0 | 50 | required |
| az | 0 | 0 | 98 | required |
| ka | 0 | 0 | 32 | required |

## Limitations

- Automated completeness proves that a static value exists; it does not prove idiomatic or culturally fluent language.
- The editorial critical-copy pass is AI-assisted and must not be described as native-speaker reviewed.
- Exact source-match counts are a triage heuristic, not a standalone defect count.
- Rendered browser checks are representative, not an exhaustive physical-device or assistive-technology certification.
- This package does not authorize deployment, signing, broadcasting, funding, or mainnet launch.

See [report.json](./report.json) for source digests, samples, and machine-readable results. Run `npm run check:i18n:provenance` from `projects/star-ascent/site` to verify public commit ancestry, historical mutation counts, file hashes, evidence totals, HOLD boundaries, and the append-only run policy.
