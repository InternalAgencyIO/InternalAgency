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

## Reachability and ownership

[`reachability.json`](./reachability.json) records the source/import and lock-graph boundary for every current-lock high finding. It confirms direct source references for `@solana/spl-token`, `@switchboard-xyz/on-demand`, and `next`; the other seven findings are transitive. Each finding has one accountable technical owner, an execution boundary, a targeted next action, and a fail-closed launch disposition.

The matrix deliberately does **not** convert "no direct source import" into "unreachable." Build tools, framework adapters, optional dependencies, and protocol serialization paths can execute transitive code. None of the ten vulnerable functions has been proven reachable or unreachable, and production-bundle absence has not been proven for any finding.

Notable graph distinctions:

- The affected `postcss@8.4.31` and `sharp@0.34.5` copies are nested under `next@16.2.12`; newer root/tooling copies do not cancel those nested findings.
- `undici@7.28.0` is introduced through the Miniflare/Cloudflare tool path.
- Both vulnerable `brace-expansion` copies are in lint/TypeScript/build tooling paths.
- `bigint-buffer@1.1.5` remains beneath SPL Token serialization and has no patched upstream release in the captured advisory view.

## Next safe work

1. Map the exact imported APIs and advisory preconditions for the protocol- and runtime-facing paths.
2. Test supported upstream upgrades rather than audit-suggested downgrades.
3. Re-run full UI, protocol, deterministic-build, and signed Devnet rehearsal gates after any protocol-facing dependency change.
4. Obtain independent review for any temporary exception, especially the unpatched `bigint-buffer` path.

The scanner snapshot is [`report.json`](./report.json), and the ten-finding matrix is [`reachability.json`](./reachability.json). The validator binds both records and their key source evidence to exact tracked bytes; the scanner snapshot is bound at `b5d1c6f055445ee60914d6db80c1259cec7a4267`, and the reachability matrix is bound at `ab1d1d28db4f10ddcacdd5ed22b0d8258ac4d7ca`.
