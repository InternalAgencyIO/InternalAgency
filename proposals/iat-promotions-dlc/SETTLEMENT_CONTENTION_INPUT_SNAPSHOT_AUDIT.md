# Settlement contention immutable-input snapshot audit

> **DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE**

This compact audit fixes the byte ownership boundary before fatal UTF-8 decode.
It does not accept a campaign vector, complete review, prepare a transaction,
access a wallet, or contact a validator or network.

## Snapshot rule

The Node reference parser accepts a `Uint8Array` backed by an ordinary
`ArrayBuffer`, copies exactly the visible bytes, and decodes that immutable
snapshot. Later alias mutations cannot change its bytes or candidate
commitment. A `Uint8Array` backed by `SharedArrayBuffer` rejects as
`SHARED_BYTE_VIEW_UNSAFE` before snapshot creation, UTF-8 decoding, JSON
parsing, or candidate production.

Three controls copy a bounded ordinary view, then mutate a candidate byte, a
marker byte, or an excluded prefix byte through the original backing buffer.
The live input changes where expected while the snapshot remains identical.
Three shared-buffer cases cover full, bounded, and empty views. Python
independently reconstructs copy isolation and the same fail-closed contract.

Published evidence contains only offsets, lengths, backing-type labels, hashes,
error boundaries, outcomes, and commitments. Backing, visible, and snapshot
bytes plus runtime candidates remain runtime-only.

## Replay

```powershell
node proposals/iat-promotions-dlc/generate-settlement-contention-composition-input-snapshot-audit.mjs --write
node proposals/iat-promotions-dlc/validate-settlement-contention-composition-input-snapshot-audit.mjs
python proposals/iat-promotions-dlc/verify-settlement-contention-transport-limits.py --verify-input-snapshot-audit --json
node --test proposals/iat-promotions-dlc/tests/settlement-contention-input-snapshot-audit.test.mjs
```

These commands are offline and proposal-only. Passing them is evidence for
review, not permission to activate, deploy, sign, broadcast, or transfer IAT.
