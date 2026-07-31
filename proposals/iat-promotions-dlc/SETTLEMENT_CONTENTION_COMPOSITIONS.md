# Settlement contention two-gate compositions

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This compact matrix proves deterministic failure precedence, absence of
masking, and one-step rejection minimality when any two of the eight contention
mutation gates are combined. All 28 unordered gate pairs and 56 one-mutation
removals are reconstructed in memory by Node and by an independent
zero-dependency Python verifier. No combined or reduced candidate, expanded
state, schedule, trace, or attempt input is written into the public artifact.

The companion `settlement-contention-composition-vectors.schema.v1.json` is a
closed Draft-07 shape. It rejects unknown root, case, and removal fields and
fixes every network, wallet, transaction, receipt, review, deployment, and
activation field to its HOLD value.

## Fixed precedence

The closed order is:

1. `STRUCTURE`
2. `STATUS`
3. `CAPABILITY`
4. `AUTHORITY`
5. `ECONOMICS`
6. `SEMANTIC_REPLAY`
7. `COMMITMENT`
8. `SOURCE_BINDING`

Each case must expose exactly its two expected gates in that order. The same
two constituent mutations must also reject independently, proving that one
failure did not make the other disappear. The combined candidate must reject
the semantic boundary as well.

For each pair, the verifier then removes each mutation in turn. The reduced
candidate must expose exactly the other gate and remain rejected. These 56
checks prove that every published pair is minimal with respect to its two fixed
mutation descriptors.

Scenario and scenario-set commitments are rebuilt after semantic mutations.
An explicit commitment mutation is then applied last. This preserves the
intended semantic failure while making the independently observable commitment
failure unambiguous.

## Compact result

- eight gates;
- 28 complete unordered pairs;
- 28 combined candidates rejected;
- 56 isolated constituent checks rejected;
- 56 removal candidates expose exactly one remaining gate and reject;
- zero masked failures;
- zero candidates stored; and
- shared Node/Python replay commitment
  `4584f45b37ca33a07b5c85e68643d11ce41d4e44e3f4174d36052788f55a2faa`.
- shared Node/Python removal replay commitment
  `951bd99fd43aa9f519f6cf1b817debba1e3b1b22430c96c0c683f21f1831be1d`.

## Reproduce locally

```text
node proposals/iat-promotions-dlc/generate-settlement-contention-composition-vectors.mjs --write
node proposals/iat-promotions-dlc/validate-settlement-contention-composition-vectors.mjs
python proposals/iat-promotions-dlc/verify-settlement-contention-vectors.py --verify-composition-vectors --json
node --test proposals/iat-promotions-dlc/tests/settlement-contention-compositions.test.mjs
node --test proposals/iat-promotions-dlc/tests/settlement-contention-composition-schema.test.mjs
```

These commands are proposal-only and offline. They do not start a validator,
contact Devnet or Mainnet, access a wallet, prepare, sign, or broadcast a
transaction, move tokens, issue a receipt, complete review, deploy, or activate
anything.
