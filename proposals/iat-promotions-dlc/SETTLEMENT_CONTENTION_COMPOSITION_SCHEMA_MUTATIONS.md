# Composition schema mutation diagnostics

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This compact corpus proves exact Node/Python diagnostic parity for twelve
deterministic mutations of the closed two-gate composition artifact. Each
mutated candidate exists in memory only. The published vector stores the
mutation descriptor, exact JSON Pointer diagnostic, and cryptographic
commitments; it stores no candidate, state, schedule, trace, or attempt.

## Fixed coverage

The cases cover:

- unknown root, composition-case, and removal-check fields;
- released network status;
- RPC, wallet, and transaction-preparation capability claims;
- review and activation authority claims;
- removal-gate cardinality drift;
- noncanonical uppercase commitment hex; and
- an unknown failure-gate label.

Both runtimes independently apply each mutation and require exact equality for
the diagnostic `instancePath`, `schemaPath`, `keyword`, and `message`. All
twelve candidates reject. Their common candidate/diagnostic replay commitment
is `f7698b7d87a0d5bdfe0aa5a009662cd837fd015d890c87ad1c45dead3866b7fe`.

## Reproduce locally

```text
node proposals/iat-promotions-dlc/generate-settlement-contention-composition-schema-vectors.mjs --write
node proposals/iat-promotions-dlc/validate-settlement-contention-composition-schema-vectors.mjs
python proposals/iat-promotions-dlc/verify-settlement-contention-vectors.py --verify-composition-schema-vectors --json
node --test proposals/iat-promotions-dlc/tests/settlement-contention-composition-schema-vectors.test.mjs
```

These commands are proposal-only and offline. They do not start a validator,
contact Devnet or Mainnet, access a wallet, prepare, sign, or broadcast a
transaction, move tokens, issue a receipt, complete review, deploy, or activate
anything.

The companion
[`SETTLEMENT_CONTENTION_DIAGNOSTIC_REPRESENTATION_AUDIT.md`](./SETTLEMENT_CONTENTION_DIAGNOSTIC_REPRESENTATION_AUDIT.md)
proves all twelve exact diagnostics remain stable across reversed key order and
LF/CRLF serialization in both runtimes.

The strict companion
[`SETTLEMENT_CONTENTION_ESCAPE_REPRESENTATION_AUDIT.md`](./SETTLEMENT_CONTENTION_ESCAPE_REPRESENTATION_AUDIT.md)
adds 72 escaped-Unicode, escaped-solidus, key-order, and line-ending trials,
then rejects six malformed escape or surrogate encodings before mutation.

The bounded-transport companion
[`SETTLEMENT_CONTENTION_TRANSPORT_LIMIT_AUDIT.md`](./SETTLEMENT_CONTENTION_TRANSPORT_LIMIT_AUDIT.md)
accepts two exact-limit controls and rejects duplicate keys at any depth plus
UTF-8 byte, depth, object-member, array-length, and total-node overflows before
mutation in both runtimes.

The numeric-token companion
[`SETTLEMENT_CONTENTION_NUMERIC_TOKEN_AUDIT.md`](./SETTLEMENT_CONTENTION_NUMERIC_TOKEN_AUDIT.md)
requires canonical safe-integer JSON tokens and rejects fractional or exponent
equivalents, negative zero, unsafe integers, non-finite equivalents, and
non-JSON constants before a candidate is returned in both runtimes.

The delimiter companion
[`SETTLEMENT_CONTENTION_DELIMITER_WHITESPACE_AUDIT.md`](./SETTLEMENT_CONTENTION_DELIMITER_WHITESPACE_AUDIT.md)
accepts only standard JSON whitespace and one complete document, rejecting
BOM, other Unicode whitespace, trailing values, and concatenated documents
before candidate production in both runtimes.

The string-token companion
[`SETTLEMENT_CONTENTION_STRING_TOKEN_AUDIT.md`](./SETTLEMENT_CONTENTION_STRING_TOKEN_AUDIT.md)
requires exact decoded required-key equality, rejecting raw controls, escaped
controls in required keys, and NFKC-equivalent lookalikes before candidate
production in both runtimes.

The key-collision companion
[`SETTLEMENT_CONTENTION_KEY_COLLISION_AUDIT.md`](./SETTLEMENT_CONTENTION_KEY_COLLISION_AUDIT.md)
proves escaped aliases collide after decoding while normalization lookalikes
remain distinct but invalid unexpected keys in both runtimes.
