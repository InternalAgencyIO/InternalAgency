# IAT V2 CCC randomness remediation review

> **DRAFT REMEDIATION REVIEW — MAINNET HOLD — NOT AN EXTERNAL AUDIT — NOT DEPLOYED — NO CLAIM ROUTE — NO LAUNCH AUTHORITY**

## Decision

**HOLD. Do not deploy, fund, sign, or broadcast the IAT V2 Mainnet program.**

Commit `1df716ccd93c47ee1732af6ae1f43b8e6958afe6` removes the permanent
CCC position deadlock identified as `IAT-SEC-001`, but it does not yet remove
selective reveal withholding. The finding therefore remains an open critical
blocker in revised form.

## What changed

- Every CCC round records its commit Unix timestamp.
- A reveal may settle only before `commit_timestamp + 86,400`.
- At that exact boundary, any caller may finalize the same round as
  `EXPIRED_NEUTRAL`.
- Expiry cannot replace the randomness account, candidate count, registry hash,
  decision context, week, or commit slot. It selects no agency and permits no
  second oracle roll.
- Each linked position receives
  `floor(full_weekly_reward * (N - 1) / N)`, the exact per-position expected
  value of a fair one-of-`N` pause. `N = 1` pays zero.
- Client parsing, the admin rehearsal surface, pure model, Rust policy tests,
  and exact time-boundary tests were updated together.

The revised source passed 17 Rust unit tests, six independent Rust time-warp
tests, 22 targeted JavaScript tests, policy validation, lint with eight
pre-existing image warnings, the admin-console production build, and a local
verifiable SBF build. The SBF artifact was 606,320 bytes with SHA-256
`d01d56161396ce7de28c1ff8c7386bf2fdf1014f6f62935c29106054b0e93e22`.

## What remains unsafe

Switchboard's reveal is controlled by the randomness authority. A controller
aligned with agency `A` can reveal when another agency is selected and withhold
when `A` is selected. Neutral expiry prevents permanent lock and preserves
ex-ante expected value, but gives the controller an option between two payout
vectors after learning the oracle result. This is not a reroll, yet it remains
economically exploitable.

Before this critical can close, the final design must remove that unilateral
option or make it irrational through independently reviewed authority and
collateral/slashing controls. It then needs adversarial local-validator tests,
a fresh signed Devnet rehearsal, and independent Solana/randomness and
game-theory review.

## Evidence boundary

The prior signed Devnet rehearsal remains valid evidence for the exact binary
and account layout it recorded. It is **not** evidence for this remediation
commit: `Round` grew by eight bytes and a new instruction and terminal state
were added. No old transaction, hash, Explorer record, or independent signoff
has been relabeled as proof of the revised source.

## Package map

- [scope.json](scope.json) — source, tree, source-file, and SBF bindings.
- [findings.json](findings.json) — remediated and residual findings.
- [attack-matrix.json](attack-matrix.json) — exact boundary and incentive cases.
- [GAME-THEORY.md](GAME-THEORY.md) — why liveness recovery is not yet incentive safety.
- [checks.json](checks.json) — commands, results, and limitations.
- [manifest.json](manifest.json) — package decision and artifact digests.

## External design references

- [Switchboard randomness tutorial](https://docs.switchboard.xyz/docs-by-chain/solana-svm/randomness/randomness-tutorial)
- [Switchboard Solana randomness overview](https://docs.switchboard.xyz/docs-by-chain/solana-svm/randomness)
- [Switchboard On-Demand examples](https://github.com/switchboard-xyz/sb-on-demand-examples)

## Limitations

This is an internal Codex-assisted source review, not an independent audit,
formal proof, production penetration test, custody review, or legal opinion.
No wallet, secret, key, signing device, production system, Mainnet account,
Devnet account, funds, DNS, or deployment was accessed or changed.
