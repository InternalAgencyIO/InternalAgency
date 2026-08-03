# DRAFT localization, usability, and accessibility QA

**STATIC QA / NOT LAUNCH APPROVAL / MAINNET HOLD / NO DEPLOYMENT PERFORMED**

Generated: 2026-08-03T09:51:58.696Z

## Outcome

- Catalog completeness: **PASS** across 50 locales and 1280 canonical strings.
- Critical hydration-only English fallback gate: **PASS** for 8 launch-control strings.
- Native-language signoff: **HOLD**. Every non-English locale still requires a native-speaker review before it can be described as native-quality.
- Mainnet decision: **HOLD, unchanged**. This package is not launch approval.

The launch-checklist word “GO” is treated semantically as “ready,” not as an instruction to move. The critical override keeps this cadence explicit.

## Validation

- `npm test`: **PASS** (37 tests)
- `npm run lint`: **PASS_WITH_WARNINGS** (0 errors, 8 warnings)
- `npm run check:future-teasers`: **PASS** (4 tests)

## Locale matrix

| Locale | Empty | Critical English fallbacks | Exact-source heuristic | Native review |
|---|---:|---:|---:|---|
| en | 0 | 0 | 0 | source |
| zh | 0 | 0 | 22 | required |
| es | 0 | 0 | 123 | required |
| hi | 0 | 0 | 76 | required |
| fr | 0 | 0 | 112 | required |
| ar | 0 | 0 | 44 | required |
| bn | 0 | 0 | 89 | required |
| pt | 0 | 0 | 178 | required |
| id | 0 | 0 | 218 | required |
| ur | 0 | 0 | 98 | required |
| ru | 0 | 0 | 53 | required |
| de | 0 | 0 | 185 | required |
| ja | 0 | 0 | 65 | required |
| pcm | 0 | 0 | 728 | required |
| tr | 0 | 0 | 230 | required |
| sq | 0 | 0 | 249 | required |
| ca | 0 | 0 | 235 | required |
| be | 0 | 0 | 53 | required |
| nl | 0 | 0 | 194 | required |
| bs | 0 | 0 | 207 | required |
| bg | 0 | 0 | 66 | required |
| hr | 0 | 0 | 177 | required |
| el | 0 | 0 | 62 | required |
| cs | 0 | 0 | 198 | required |
| da | 0 | 0 | 215 | required |
| et | 0 | 0 | 188 | required |
| fi | 0 | 0 | 171 | required |
| hu | 0 | 0 | 203 | required |
| is | 0 | 0 | 166 | required |
| ga | 0 | 0 | 245 | required |
| it | 0 | 0 | 189 | required |
| lv | 0 | 0 | 232 | required |
| lt | 0 | 0 | 174 | required |
| lb | 0 | 0 | 250 | required |
| mk | 0 | 0 | 48 | required |
| mt | 0 | 0 | 202 | required |
| no | 0 | 0 | 230 | required |
| pl | 0 | 0 | 186 | required |
| ro | 0 | 0 | 209 | required |
| sr | 0 | 0 | 38 | required |
| sk | 0 | 0 | 219 | required |
| sl | 0 | 0 | 210 | required |
| sv | 0 | 0 | 188 | required |
| uk | 0 | 0 | 82 | required |
| ht | 0 | 0 | 264 | required |
| gn | 0 | 0 | 227 | required |
| qu | 0 | 0 | 242 | required |
| hy | 0 | 0 | 126 | required |
| az | 0 | 0 | 236 | required |
| ka | 0 | 0 | 75 | required |

## Limitations

- Automated completeness proves that a static value exists; it does not prove idiomatic or culturally fluent language.
- The editorial critical-copy pass is AI-assisted and must not be described as native-speaker reviewed.
- Exact source-match counts are a triage heuristic, not a standalone defect count.
- Rendered browser checks are representative, not an exhaustive physical-device or assistive-technology certification.
- This package does not authorize deployment, signing, broadcasting, funding, or mainnet launch.

See [report.json](./report.json) for source digests, samples, and machine-readable results.
