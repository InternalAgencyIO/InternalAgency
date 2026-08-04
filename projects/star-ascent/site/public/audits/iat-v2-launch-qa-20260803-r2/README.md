# IAT V2 launch QA consolidation — revision 2

**DRAFT QA / MAINNET HOLD / NOT DEPLOYED BY THIS PACKAGE / NO SIGNING OR BROADCAST AUTHORITY**

Source commit: `58d6976f3217831c57a1a5858cb32406f88d1fcd`
Audited at: 2026-08-03T13:23:14Z

## Decision

Automated source, browser, localization, public-route, release-chain, and production-dependency checks pass. Mainnet remains **UNSCHEDULED_HOLD** because funding, fresh source-bound Devnet rehearsal and independent signoff, sole-authority risk handling, development-tooling review, and unavailable human/environment coverage remain open.

This revision supersedes the observations in `iat-v2-launch-qa-20260803` without rewriting that historical package. In particular, the live public contract now passes 76/76 checks and lint passes with zero warnings.

## Evidence summary

- `npm test`: 45/45 tests passed.
- `npm run check:ui-regression`: 35/35 browser cases passed across seven profiles.
- `npm run check:iat-v2`: 65/65 Node security and policy tests passed in HOLD.
- `npm run check:launch-gates`: full release, ceremony, rollback, and reconciliation chain passed in HOLD.
- `npm run check:public`: 76/76 current read-only live checks passed.
- `npm run lint`: 0 errors, 0 warnings.
- Production dependency audit: 0 vulnerabilities; full development audit: 22 advisories under review.

See `FINDINGS.md`, `checks.json`, `findings.json`, `scope.json`, and `environment-matrix.json` for the auditable record and limitations.
