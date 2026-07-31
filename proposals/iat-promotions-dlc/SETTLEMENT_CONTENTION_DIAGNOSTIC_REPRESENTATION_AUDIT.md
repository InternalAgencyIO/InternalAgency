# Diagnostic representation audit

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This compact audit proves that the twelve closed-schema rejection diagnostics
are stable across three different JSON representations:

- baseline insertion order serialized with LF;
- recursively reversed object-key order serialized with LF; and
- baseline insertion order serialized with CRLF.

The 36 represented inputs have distinct raw representation digests within each
mutation case. After parsing, each representation must produce the same
canonical mutated-candidate commitment and the exact same diagnostic instance
pointer, schema pointer, keyword, message, and diagnostic commitment. Every
candidate remains rejected.

Only compact digests, diagnostics, and outcomes are published. Serialized
representations and mutated candidates exist in memory only and are not stored.
Node and independent zero-dependency Python reproduce the same common replay
commitment:
`e878654551b14af9516e725230dadabdca72433890ff6c8a67cfbba111d0a68a`.

## Reproduce locally

```text
node proposals/iat-promotions-dlc/generate-settlement-contention-composition-diagnostic-representation-audit.mjs --write
node proposals/iat-promotions-dlc/validate-settlement-contention-composition-diagnostic-representation-audit.mjs
python proposals/iat-promotions-dlc/verify-settlement-contention-vectors.py --verify-diagnostic-representation-audit --json
node --test proposals/iat-promotions-dlc/tests/settlement-contention-diagnostic-representation-audit.test.mjs
```

These commands are proposal-only and offline. They do not start a validator,
contact Devnet or Mainnet, access a wallet, prepare, sign, or broadcast a
transaction, move tokens, issue a receipt, complete review, deploy, or activate
anything.
