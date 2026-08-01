# Settlement contention byte-view boundary audit

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This compact audit fixes the runtime byte-view accepted by the fatal UTF-8
transport boundary. It does not accept a campaign vector, complete review,
prepare a transaction, access a wallet, or contact a validator or network.

## View rule

The parser accepts a `Uint8Array` and decodes exactly the bytes visible through
its `byteOffset` and `byteLength`. Bytes outside that view are not part of the
transport. An `ArrayBuffer`, `DataView`, string, or ordinary numeric array is
not an accepted byte view and rejects as `INVALID_BYTE_VIEW` before UTF-8
decoding or JSON parsing.

Three controls surround the valid envelope with invalid UTF-8 sentinels: one
excludes a prefix through a nonzero offset, one excludes a suffix through a
bounded length, and one excludes both. All three accept the same candidate.
Four wrong-type inputs carry the same valid payload but reject before decode.
Node exercises the exact JavaScript runtime types; zero-dependency Python
independently reconstructs the visible bytes, descriptors, results, and
commitments with analogous rejected container types.

Published evidence contains view metadata, hashes, byte counts, error
boundaries, and outcomes only. Backing bytes, visible bytes, runtime inputs,
and runtime candidates are never stored.

## Replay

```powershell
node proposals/iat-promotions-dlc/generate-settlement-contention-composition-byte-view-boundary-audit.mjs --write
node proposals/iat-promotions-dlc/validate-settlement-contention-composition-byte-view-boundary-audit.mjs
python proposals/iat-promotions-dlc/verify-settlement-contention-transport-limits.py --verify-byte-view-boundary-audit --json
node --test proposals/iat-promotions-dlc/tests/settlement-contention-byte-view-boundary-audit.test.mjs
```

These commands are offline and proposal-only. Passing them is evidence for
review, not permission to activate, deploy, sign, broadcast, or transfer IAT.
