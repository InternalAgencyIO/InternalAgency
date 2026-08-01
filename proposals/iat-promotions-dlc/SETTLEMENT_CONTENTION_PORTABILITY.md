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
The strict escape companion adds 72 equivalent escaped-Unicode, solidus,
key-order, and line-ending encodings plus six pre-mutation malformed escape and
surrogate rejections; see
`SETTLEMENT_CONTENTION_ESCAPE_REPRESENTATION_AUDIT.md`.
The bounded transport companion adds two accepted controls and eight
pre-mutation rejections for duplicate keys and fixed byte, depth, object,
array, and total-node limits; see
`SETTLEMENT_CONTENTION_TRANSPORT_LIMIT_AUDIT.md`.
The numeric-token companion adds four canonical safe-integer controls and
sixteen pre-candidate rejections for fractional or exponent equivalents,
negative zero, unsafe integers, non-finite equivalents, and non-JSON numeric
constants; see `SETTLEMENT_CONTENTION_NUMERIC_TOKEN_AUDIT.md`.
The delimiter companion adds four standard-whitespace controls and sixteen
pre-candidate rejections for BOM, seven other Unicode whitespace characters,
trailing values, and concatenated documents; see
`SETTLEMENT_CONTENTION_DELIMITER_WHITESPACE_AUDIT.md`.
The string-token companion adds three exact-key controls and twenty
pre-candidate rejections for raw controls, escaped controls in required keys,
and NFKC-equivalent key lookalikes; see
`SETTLEMENT_CONTENTION_STRING_TOKEN_AUDIT.md`.
The key-collision companion adds three controls and twelve pre-candidate
rejections proving decoded aliases collide while normalization lookalikes stay
distinct but invalid; see `SETTLEMENT_CONTENTION_KEY_COLLISION_AUDIT.md`.
The marker-value companion adds four canonical controls and sixteen
pre-candidate rejections proving exact decoded marker comparison without case
folding, normalization, or confusable mapping; see
`SETTLEMENT_CONTENTION_MARKER_VALUE_AUDIT.md`.
The fatal UTF-8 ingress companion adds four valid scalar-width controls and
sixteen pre-JSON byte rejections for truncated, overlong, surrogate-encoded,
and invalid-continuation sequences; see
`SETTLEMENT_CONTENTION_FATAL_UTF8_INGRESS_AUDIT.md`.
The UTF-8 boundary companion adds four exact scalar-boundary controls and
sixteen pre-JSON rejections for out-of-range scalar encodings, obsolete long
forms, FE/FF leads, and redundant continuation runs; see
`SETTLEMENT_CONTENTION_UTF8_BOUNDARY_AUDIT.md`.
The UTF-8 BOM-position companion accepts U+FEFF inside a candidate string and
rejects leading, post-whitespace, and trailing BOM bytes after successful
decoding but before candidate production; see
`SETTLEMENT_CONTENTION_UTF8_BOM_POSITION_AUDIT.md`.
The byte-view boundary companion accepts only the visible bytes of a bounded
`Uint8Array` view and rejects `ArrayBuffer`, `DataView`, string, and numeric
array inputs before decoding; see
`SETTLEMENT_CONTENTION_BYTE_VIEW_BOUNDARY_AUDIT.md`.

## Reproduce locally

```text
node proposals/iat-promotions-dlc/validate-settlement-contention-vectors.mjs
python proposals/iat-promotions-dlc/verify-settlement-contention-vectors.py --json
python proposals/iat-promotions-dlc/verify-settlement-contention-vectors.py --verify-mutation-vectors --json
python proposals/iat-promotions-dlc/verify-settlement-contention-vectors.py --verify-composition-vectors --json
python proposals/iat-promotions-dlc/verify-settlement-contention-vectors.py --verify-composition-schema-vectors --json
python proposals/iat-promotions-dlc/verify-settlement-contention-vectors.py --verify-diagnostic-representation-audit --json
python proposals/iat-promotions-dlc/verify-settlement-contention-escape-representations.py --json
python proposals/iat-promotions-dlc/verify-settlement-contention-transport-limits.py --json
python proposals/iat-promotions-dlc/verify-settlement-contention-transport-limits.py --verify-numeric-token-audit --json
python proposals/iat-promotions-dlc/verify-settlement-contention-transport-limits.py --verify-delimiter-whitespace-audit --json
python proposals/iat-promotions-dlc/verify-settlement-contention-transport-limits.py --verify-string-token-audit --json
python proposals/iat-promotions-dlc/verify-settlement-contention-transport-limits.py --verify-key-collision-audit --json
python proposals/iat-promotions-dlc/verify-settlement-contention-transport-limits.py --verify-marker-value-audit --json
python proposals/iat-promotions-dlc/verify-settlement-contention-transport-limits.py --verify-fatal-utf8-ingress-audit --json
python proposals/iat-promotions-dlc/verify-settlement-contention-transport-limits.py --verify-utf8-boundary-audit --json
python proposals/iat-promotions-dlc/verify-settlement-contention-transport-limits.py --verify-utf8-bom-position-audit --json
python proposals/iat-promotions-dlc/verify-settlement-contention-transport-limits.py --verify-byte-view-boundary-audit --json
node --test proposals/iat-promotions-dlc/tests/settlement-contention-schema.test.mjs
node --test proposals/iat-promotions-dlc/tests/settlement-contention-python.test.mjs
node --test proposals/iat-promotions-dlc/tests/settlement-contention-mutations.test.mjs
node --test proposals/iat-promotions-dlc/tests/settlement-contention-compositions.test.mjs
node --test proposals/iat-promotions-dlc/tests/settlement-contention-composition-schema.test.mjs
node --test proposals/iat-promotions-dlc/tests/settlement-contention-composition-schema-vectors.test.mjs
node --test proposals/iat-promotions-dlc/tests/settlement-contention-diagnostic-representation-audit.test.mjs
node --test proposals/iat-promotions-dlc/tests/settlement-contention-escape-representation-audit.test.mjs
node --test proposals/iat-promotions-dlc/tests/settlement-contention-transport-limit-audit.test.mjs
node --test proposals/iat-promotions-dlc/tests/settlement-contention-numeric-token-audit.test.mjs
node --test proposals/iat-promotions-dlc/tests/settlement-contention-delimiter-whitespace-audit.test.mjs
node --test proposals/iat-promotions-dlc/tests/settlement-contention-string-token-audit.test.mjs
node --test proposals/iat-promotions-dlc/tests/settlement-contention-key-collision-audit.test.mjs
node --test proposals/iat-promotions-dlc/tests/settlement-contention-marker-value-audit.test.mjs
node --test proposals/iat-promotions-dlc/tests/settlement-contention-fatal-utf8-ingress-audit.test.mjs
node --test proposals/iat-promotions-dlc/tests/settlement-contention-utf8-boundary-audit.test.mjs
node --test proposals/iat-promotions-dlc/tests/settlement-contention-utf8-bom-position-audit.test.mjs
node --test proposals/iat-promotions-dlc/tests/settlement-contention-byte-view-boundary-audit.test.mjs
```

These are local, read-only verification commands. They do not start a local
validator, contact Devnet or Mainnet, access a wallet, prepare or sign a
transaction, broadcast, move IAT, issue a review receipt, complete review, or
authorize activation.
