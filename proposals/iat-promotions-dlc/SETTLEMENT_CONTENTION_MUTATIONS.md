# Settlement contention mutation corpus

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This compact corpus proves that the Node validation boundary and independent
zero-dependency Python replay reject the same sixteen deterministic candidate
commitments. Mutated candidates exist in memory only. The public artifact
stores mutation descriptors, commitments, rejection metadata, and HOLD gates;
it stores no expanded candidate, state, schedule, trace, or attempt input.

## Failure coverage

The sixteen cases cover eight primary gates:

- two closed-structure failures, including an attempted expanded schedule;
- one released-status claim;
- four validator/RPC/wallet/transaction capability claims;
- two review/activation authority claims;
- two exact-economic mutations;
- two schema-valid semantic replay mutations;
- two schema-valid commitment mutations; and
- one schema-valid source-binding mutation.

Five mutations deliberately rebuild the affected scenario and ordered
scenario-set commitments. Changed authority, 119.999999999-IAT hero reward,
one-base-unit final vault balance, winner identity, and timeline commitment
therefore remain rejected even after their public hash layers are internally
consistent.

Eleven candidates are rejected structurally by the closed schema. Five remain
structurally valid and are rejected by semantic replay, commitment, or source
binding. All sixteen reject in both runtimes. Their shared compact replay
commitment is
`949fe48b3ae1d63bf31ead5a7e4ff251100de6fed0749654e9baef112db08032`.

## Reproduce locally

```text
node proposals/iat-promotions-dlc/generate-settlement-contention-mutation-vectors.mjs --write
node proposals/iat-promotions-dlc/validate-settlement-contention-mutation-vectors.mjs
python proposals/iat-promotions-dlc/verify-settlement-contention-vectors.py --verify-mutation-vectors --json
node --test proposals/iat-promotions-dlc/tests/settlement-contention-mutations.test.mjs
```

These commands are proposal-only and offline. They do not start a validator,
contact Devnet or Mainnet, access a wallet, prepare, sign, or broadcast a
transaction, move tokens, issue a receipt, complete review, deploy, or activate
anything.

The companion [two-gate composition matrix](./SETTLEMENT_CONTENTION_COMPOSITIONS.md)
combines every unordered pair of these eight gates and proves fixed rejection
precedence plus absence of masking without publishing any combined candidate.
