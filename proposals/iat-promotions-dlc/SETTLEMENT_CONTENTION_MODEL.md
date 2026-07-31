# Settlement contention model

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This proposal-only model makes final-slot serialization and atomic failure
rollback executable without starting a validator, opening an RPC connection,
preparing a transaction, accessing a wallet, signing, or broadcasting. It is a
deterministic state-machine audit, not evidence of Solana runtime behavior.

## Lock contract

Every modeled settlement derives a canonical sorted write-lock set covering:

- the campaign and isolated promotion vault;
- the nomination and next settlement sequence;
- independent hero and proposer node, wallet, and immutable-X markers; and
- the two destination balance records.

The shared campaign, promotion-vault, and sequence locks serialize every pair
competing for the final slot. A blocked attempt cannot execute. After the lock
holder commits or rolls back, all locks must be released before the blocked
attempt can retry. Execute-without-lock, release-without-lock, owner drift, and
unreleased-lock schedules fail closed.

## Compact scenarios

`settlement-contention-vectors.v1.json` commits six seven-step schedules:

1. A commits and B retries against the permanent terminal state;
2. B commits and A retries against the permanent terminal state;
3. A fails after the modeled hero transfer and B recovers;
4. A fails after the modeled proposer transfer and B recovers;
5. B fails after the modeled hero transfer and A recovers; and
6. B fails after the modeled proposer transfer and A recovers.

Across the compact suite there are six lock conflicts, four atomic rollbacks,
six committed final-slot settlements, and two terminal loser rejections. Every
final state has exactly 1,000 completed pairs, a zero promotion-vault balance,
one hero paid exactly 120 IAT, one proposer paid exactly 60 IAT, and an unpaid
losing pair. Every injected-fault before/after state digest is identical.

The ordered scenario set is committed as
`87dad1a11f005cbb3ea25a857026a6a009522a1a6f735e428e7bba45e510f7d8`.
The artifact stores only compact state, timeline, trace, attempt-outcome, and
scenario commitments. It does not store expanded states, timelines, traces, or
attempt inputs.

## Limits and trust boundary

This model intentionally does not claim local-validator, Devnet, or Mainnet
fidelity. A later implementation still requires a separately reviewed program,
account graph, real runtime contention tests, Devnet evidence, independent
security review, separately funded capped vault, and explicit post-Genesis
activation. Nothing here releases any existing HOLD gate.

## Reproduce locally

```text
node proposals/iat-promotions-dlc/generate-settlement-contention-vectors.mjs --write
node proposals/iat-promotions-dlc/validate-settlement-contention-vectors.mjs
node --test proposals/iat-promotions-dlc/tests/settlement-contention-model.test.mjs
```

These commands are local verification only. They cannot deploy, simulate for
signing, broadcast, move tokens, issue a receipt, complete review, or activate
the proposal.
