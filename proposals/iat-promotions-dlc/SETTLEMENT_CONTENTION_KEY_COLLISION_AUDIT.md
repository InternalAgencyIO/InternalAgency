# Settlement contention required-key collision audit

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This compact audit fixes the relationship between JSON escape decoding,
duplicate detection, and exact required-key lookup. It does not accept a
campaign vector, complete review, prepare a transaction, access a wallet, or
contact a validator or network.

## Collision rule

Duplicate detection compares decoded Unicode scalar sequences. Consequently,
literal and escaped spellings of the same ASCII required key collide and
reject as `DUPLICATE_JSON_KEY`. No Unicode normalization runs before duplicate
detection or field lookup. NFKC-equivalent lookalikes therefore remain
distinct decoded keys, but the extra unexpected key makes the transport
envelope invalid.

Three canonical controls accept. Twelve isolated inputs reject:

- six decoded duplicates covering literal/escaped order in both directions
  and two distinct escape spellings for each required key; and
- six fullwidth, circled, or mathematical lookalikes that normalize under NFKC
  to `candidate` or `transportMarker` but remain distinct unexpected keys.

Only descriptors, required-key names, representation hashes, byte counts,
error classes, collision/normalization relations, and outcomes are published.
Serialized envelopes and runtime candidates are not.

## Independent replay

The zero-dependency Python mode reconstructs all fifteen inputs independently
and must match every digest, error, outcome, and commitment. Changed evidence
exits with status `2`.

This audit is review material only. It grants no receipt, deployment,
activation, claim, wallet, signing, RPC, transaction, or chain capability.

The companion
[`SETTLEMENT_CONTENTION_MARKER_VALUE_AUDIT.md`](./SETTLEMENT_CONTENTION_MARKER_VALUE_AUDIT.md)
applies the same decoded-scalar discipline to the required marker value,
including control, case, normalization, and cross-script negative cases.
