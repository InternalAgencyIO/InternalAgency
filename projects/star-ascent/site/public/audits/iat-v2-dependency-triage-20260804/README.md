# IAT V2 dependency security triage

**DRAFT / QA HOLD / MAINNET UNSCHEDULED_HOLD / NO DEPLOYMENT AUTHORITY**

This public package separates two different security views that must not be conflated:

- GitHub's default branch currently reports 78 open Dependabot alerts: 38 high, 33 moderate, and 7 low.
- A fresh `npm audit --package-lock-only --json` against the source-bound draft lock reports 26 vulnerable packages: 10 high and 16 moderate.

The totals differ because the default-branch view includes older manifest state, including a `pnpm-lock.yaml` absent from the bound draft source. This report does **not** claim that the draft is dependency-clean.

## Current-lock high findings

Direct: `@solana/spl-token`, `@switchboard-xyz/on-demand`, and `next`.

Transitive: `@solana/buffer-layout-utils`, `bigint-buffer`, `brace-expansion`, `fast-uri`, `postcss`, `sharp`, and `undici`.

`bigint-buffer` has no upstream patched version in the captured Dependabot record. Several automated suggestions require semver-major graph changes or apparent downgrades, so this increment deliberately does not run `npm audit fix`, add overrides, or mutate protocol-facing dependencies.

## Next safe work

1. Build a source/import/bundle reachability matrix for all ten current-lock high findings.
2. Separate browser/runtime exposure from build-only and ceremony-only tooling.
3. Select supported upstream upgrades rather than audit-suggested downgrades.
4. Re-run full UI, protocol, deterministic-build, and signed Devnet rehearsal gates after any protocol-facing dependency change.

The machine-readable record is [`report.json`](./report.json). Its validator binds the report to the exact tracked `package.json` and `package-lock.json` bytes at commit `b5d1c6f055445ee60914d6db80c1259cec7a4267`.
