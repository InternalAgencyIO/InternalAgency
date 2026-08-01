# Settlement contention transport-marker value audit

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This compact audit fixes the exact value contract for the transport marker. It
does not accept a campaign vector, complete review, prepare a transaction,
access a wallet, or contact a validator or network.

## Exact value rule

The decoded marker must equal `DRAFT/INACTIVE` as an exact Unicode scalar
sequence. JSON escapes that decode to that sequence are canonical and accept.
No case folding, Unicode normalization, or confusable mapping is applied.
Raw controls fail JSON parsing; escaped controls, case variants,
normalization-equivalent variants, and cross-script confusables decode but do
not equal the marker and fail the envelope before candidate production.

Four controls and sixteen rejection cases are generated independently in Node
and Python. Published evidence contains descriptors, hashes, byte counts,
relation flags, error boundaries, and outcomes only. Serialized inputs and
runtime candidates are never stored.

## Replay

```powershell
node proposals/iat-promotions-dlc/generate-settlement-contention-composition-marker-value-audit.mjs --write
node proposals/iat-promotions-dlc/validate-settlement-contention-composition-marker-value-audit.mjs
python proposals/iat-promotions-dlc/verify-settlement-contention-transport-limits.py --verify-marker-value-audit --json
node --test proposals/iat-promotions-dlc/tests/settlement-contention-marker-value-audit.test.mjs
```

These commands are offline and proposal-only. Passing them is evidence for
review, not permission to activate, deploy, sign, broadcast, or transfer IAT.

The companion
[`SETTLEMENT_CONTENTION_FATAL_UTF8_INGRESS_AUDIT.md`](./SETTLEMENT_CONTENTION_FATAL_UTF8_INGRESS_AUDIT.md)
fixes strict byte decoding before this decoded marker rule is evaluated.
