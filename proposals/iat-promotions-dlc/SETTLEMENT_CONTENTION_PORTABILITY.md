# Settlement contention portability

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

The compact contention artifact now has two portable verification boundaries:

- `settlement-contention-evidence.schema.v1.json` is a closed Draft-07 schema;
  every object rejects unknown properties, all HOLD and non-authority fields are
  constants, and expanded state, schedules, traces, and attempt inputs have no
  publishable field; and
- `verify-settlement-contention-vectors.py` independently replays the six
  seven-step lock/economic outcomes with the Python 3 standard library only.

Structural schema validity is not semantic validity. The Python replay checks
the fixed admission order and fault contract, one conflict per scenario,
rollback or terminal behavior, the single committed final slot, exact 120/60
IAT balances, zero losing balances, exact 1,000-pair and zero-vault outcomes,
source bindings, scenario commitments, and the ordered scenario-set
commitment. It does not import or execute the JavaScript reference engine.

## Compact-public boundary

The public artifact contains commitments and summary outcomes only. The schema
cannot accept expanded state, timelines, traces, attempt inputs, RPC data,
wallet data, transactions, receipts, completed-review claims, or activation
authority. The Python replay reconstructs its seven operations in memory and
does not publish or retain the expanded schedule.

The independent replay commitment over its six compact semantic results is
`34049424beac2fd7869365de35419cf86a3824f4eb2a6e5b1a8f9110475ed914`.
The existing ordered public scenario-set commitment remains
`87dad1a11f005cbb3ea25a857026a6a009522a1a6f735e428e7bba45e510f7d8`.

The companion compact mutation corpus exercises sixteen structure, status,
capability, authority, economics, semantic replay, commitment, and source-
binding failures in both runtimes. See `SETTLEMENT_CONTENTION_MUTATIONS.md`.
Its composition companion covers all 28 unordered pairs of those gates, with
fixed precedence, a closed Draft-07 shape, and 56 independent one-removal
minimality checks. See
`SETTLEMENT_CONTENTION_COMPOSITIONS.md`.
Twelve compact schema mutations additionally bind exact Node/Python instance
and schema pointers, keywords, and messages; see
`SETTLEMENT_CONTENTION_COMPOSITION_SCHEMA_MUTATIONS.md`.
The 36-trial diagnostic representation audit separately binds raw key-order
and line-ending digests while requiring canonical candidates and exact
diagnostics to remain identical; see
`SETTLEMENT_CONTENTION_DIAGNOSTIC_REPRESENTATION_AUDIT.md`.

## Reproduce locally

```text
node proposals/iat-promotions-dlc/validate-settlement-contention-vectors.mjs
python proposals/iat-promotions-dlc/verify-settlement-contention-vectors.py --json
python proposals/iat-promotions-dlc/verify-settlement-contention-vectors.py --verify-mutation-vectors --json
python proposals/iat-promotions-dlc/verify-settlement-contention-vectors.py --verify-composition-vectors --json
python proposals/iat-promotions-dlc/verify-settlement-contention-vectors.py --verify-composition-schema-vectors --json
python proposals/iat-promotions-dlc/verify-settlement-contention-vectors.py --verify-diagnostic-representation-audit --json
node --test proposals/iat-promotions-dlc/tests/settlement-contention-schema.test.mjs
node --test proposals/iat-promotions-dlc/tests/settlement-contention-python.test.mjs
node --test proposals/iat-promotions-dlc/tests/settlement-contention-mutations.test.mjs
node --test proposals/iat-promotions-dlc/tests/settlement-contention-compositions.test.mjs
node --test proposals/iat-promotions-dlc/tests/settlement-contention-composition-schema.test.mjs
node --test proposals/iat-promotions-dlc/tests/settlement-contention-composition-schema-vectors.test.mjs
node --test proposals/iat-promotions-dlc/tests/settlement-contention-diagnostic-representation-audit.test.mjs
```

These are local, read-only verification commands. They do not start a local
validator, contact Devnet or Mainnet, access a wallet, prepare or sign a
transaction, broadcast, move IAT, issue a review receipt, complete review, or
authorize activation.
